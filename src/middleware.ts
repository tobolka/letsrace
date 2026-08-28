import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, verifyAdminCookieValue } from "@/lib/auth/admin-token";

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

  // Security headers for every route are set in next.config.ts `headers()`.
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
