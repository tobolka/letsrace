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

  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
  );
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/((?!_next/static|_next/image|favicon.ico|maplibre/).*)"],
};
