import { NextResponse, type NextRequest } from "next/server";
import { agentLinkHeaders } from "@/lib/agent-discovery";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/messages";
import { estimateMarkdownTokens, homepageMarkdown } from "@/lib/markdown-pages";

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  const response = NextResponse.next();
  response.headers.set("x-locale", localeFromPath(pathname));
  if (isHomepage(pathname)) {
    response.headers.set("Link", agentLinkHeaders().join(", "));
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next|admin|.*\\..*).*)"],
};
