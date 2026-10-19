import { NextResponse, type NextRequest } from "next/server";
import { agentLinkHeaders } from "@/lib/agent-discovery";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/messages";
import { estimateMarkdownTokens, homepageMarkdown } from "@/lib/markdown-pages";
import { routePath } from "@/lib/localized-paths";

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const browse = routePath(pathname);
  if (browse && "redirect" in browse) {
    const url = request.nextUrl.clone();
    url.pathname = browse.redirect;
    return NextResponse.redirect(url, 308);
  }

  // A Czech reader typing letsrace.cz gets the Czech site, not the English one.
  if (pathname === "/" && !wantsMarkdown(request)) {
    const preferred = preferredLocale(request.headers.get("accept-language"));
    if (preferred && preferred !== defaultLocale) {
      const url = request.nextUrl.clone();
      url.pathname = `/${preferred}`;
      const response = NextResponse.redirect(url, 307);
      response.headers.set("Vary", "Accept-Language");
      return response;
    }
    // Everyone else, crawlers included, to the default language — 308, not
    // 307: a temporary redirect told Google to keep `/` as the canonical and
    // file `/en` as its duplicate. (This was `app/page.tsx`, which needed a
    // root layout above the language segment just to redirect.)
    const url = request.nextUrl.clone();
    url.pathname = `/${defaultLocale}`;
    return NextResponse.redirect(url, 308);
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
    return missing;
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
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|admin|.*\\..*).*)"],
};
