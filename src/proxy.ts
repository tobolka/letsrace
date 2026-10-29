import { NextResponse, type NextRequest } from "next/server";
import { agentLinkHeaders } from "@/lib/agent-discovery";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/messages";
import { LOCALE_COOKIE, savedLocale } from "@/lib/i18n/locale-preference";
import { estimateMarkdownTokens, homepageMarkdown } from "@/lib/markdown-pages";
import { CATALOGUE_CDN_CACHE } from "@/lib/catalogue-cache";
import { routePath, SECTION_SLUGS } from "@/lib/localized-paths";

const LOCALE_PREFIX = new RegExp(`^/(${locales.join("|")})(/|$)`);

function localeFromPath(pathname: string): Locale {
  const match = pathname.match(LOCALE_PREFIX);
  if (match && locales.includes(match[1] as Locale)) return match[1] as Locale;
  return defaultLocale;
}

function wantsMarkdown(request: NextRequest): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/markdown") && !accept.includes("text/html");
}

function isHomepage(pathname: string): boolean {
  if (pathname === "/") return true;
  return new RegExp(`^/(${locales.join("|")})/?$`).test(pathname);
}

/**
 * The reader's first language we have a page in, from Accept-Language.
 * Null when none matches (and for crawlers, which send none): `/` then goes
 * on to its permanent redirect to the default language.
 */
export function preferredLocale(acceptLanguage: string | null): Locale | null {
  if (!acceptLanguage) return null;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = Number(params.find((p) => p.trim().startsWith("q="))?.trim().slice(2) ?? 1);
      return { lang: tag!.trim().toLowerCase().split("-")[0]!, q: Number.isFinite(q) ? q : 0 };
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { lang } of ranked) {
    if ((locales as readonly string[]).includes(lang)) return lang as Locale;
  }
  return null;
}

/** Top-level routes outside the language segment that the matcher lets through. */
const ROOT_ROUTES = new Set(["docs", "auth", "race-card", "opengraph-image"]);

function isAccountPath(pathname: string): boolean {
  const [, locale, section] = pathname.split("/");
  if (!locale || !locales.includes(locale as Locale)) return false;
  return section === "account" || section === SECTION_SLUGS[locale as Locale].account;
}

/**
 * Public pages are the same for every visitor. Hold them on the CDN so
 * crawlers do not pull a fresh copy from compute on every pass. Accounts stay
 * private; map deep links rewrite to a request-time redirect helper.
 */
function holdOnCdn(response: NextResponse, request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") return response;
  const { pathname } = request.nextUrl;
  if (isAccountPath(pathname) || pathname.includes("/map-entry")) {
    return response;
  }
  const isEntry = isHomepage(pathname) || locales.some((locale) =>
    pathname === `/${locale}/${SECTION_SLUGS[locale].list}` ||
    pathname === `/${locale}/${SECTION_SLUGS[locale].schedule}`,
  );
  // Date-based HTML previews refresh daily, rather than remaining behind the
  // general catalogue's week-long CDN lifetime after their ISR has refreshed.
  const cache = isEntry ? "public, s-maxage=86400, stale-while-revalidate=3600" : CATALOGUE_CDN_CACHE;
  response.headers.set("Vercel-CDN-Cache-Control", cache);
  response.headers.set("CDN-Cache-Control", cache);
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const browse = routePath(pathname);
  if (browse && "redirect" in browse) {
    const url = request.nextUrl.clone();
    url.pathname = browse.redirect;
    return holdOnCdn(NextResponse.redirect(url, 308), request);
  }

  // Explicit preference wins over browser language on the next visit.
  if (pathname === "/" && !wantsMarkdown(request)) {
    const preferred = savedLocale(request.cookies.get(LOCALE_COOKIE)?.value)
      ?? preferredLocale(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    url.pathname = `/${preferred ?? defaultLocale}`;
    // Preserve the permanent canonical redirect for crawlers without a language.
    const response = NextResponse.redirect(url, preferred ? 307 : 308);
    response.headers.set("Vary", "Cookie, Accept-Language, Accept");
    // Neither browsers nor shared caches may retain a previous language choice.
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vercel-CDN-Cache-Control", "no-store");
    response.headers.set("CDN-Cache-Control", "no-store");
    return response;
  }

  if (isHomepage(pathname) && wantsMarkdown(request)) {
    const locale = pathname === "/" ? defaultLocale : localeFromPath(pathname);
    const markdown = homepageMarkdown(locale);
    return new NextResponse(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "x-markdown-tokens": String(estimateMarkdownTokens(markdown)),
        Vary: "Accept",
      },
    });
  }

  // Only deep links need a server lookup and date-normalising redirect.
  // Keeping searchParams out of the ordinary home page lets Next cache its
  // five locale variants instead of rendering every visit and filter URL.
  if (isHomepage(pathname) && request.nextUrl.searchParams.get("e")) {
    const url = request.nextUrl.clone();
    const locale = localeFromPath(pathname);
    url.pathname = `/${locale}/map-entry`;
    const response = NextResponse.rewrite(url);
    response.headers.set("x-locale", locale);
    return response;
  }

  // An address that does not start with a language (`/nonsense`) would land in
  // `[locale]` as a language we do not publish, and a root layout's notFound()
  // shows Next's bare 404. Send it somewhere under the default language that
  // no route has, so it gets the site's own 404 page — still a 404.
  const first = pathname.split("/")[1] ?? "";
  if (first && !(locales as readonly string[]).includes(first) && !ROOT_ROUTES.has(first)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}/_missing${pathname}`;
    const missing = NextResponse.rewrite(url);
    missing.headers.set("x-locale", defaultLocale);
    return holdOnCdn(missing, request);
  }

  let response: NextResponse;
  if (browse) {
    const url = request.nextUrl.clone();
    url.pathname = browse.rewrite;
    response = NextResponse.rewrite(url);
  } else {
    response = NextResponse.next();
  }
  response.headers.set("x-locale", localeFromPath(pathname));
  if (isHomepage(pathname)) {
    response.headers.set("Link", agentLinkHeaders().join(", "));
  }
  return holdOnCdn(response, request);
}

export const config = {
  matcher: ["/((?!api|_next|admin|.*\\..*).*)"],
};
