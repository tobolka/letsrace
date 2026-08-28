import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminCookieValue } from "@/lib/auth/admin-token";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/messages";

const LOCALE_PREFIX = new RegExp(`^/(${locales.join("|")})(/|$)`);

function localeFromPath(pathname: string): Locale {
  const match = pathname.match(LOCALE_PREFIX);
  if (match && locales.includes(match[1] as Locale)) return match[1] as Locale;
  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    if (!verifyAdminCookieValue(token)) {
      const login = request.nextUrl.clone();
      login.pathname = "/admin/login";
      login.search = "";
      return NextResponse.redirect(login);
    }
  }

  const response = NextResponse.next();
  response.headers.set("x-locale", localeFromPath(pathname));
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/((?!api|_next|.*\\..*).*)"],
};
