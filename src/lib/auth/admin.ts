import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  adminSessionToken,
  passwordsMatch,
  verifyAdminCookieValue,
} from "@/lib/auth/admin-token";

export { ADMIN_COOKIE, verifyAdminCookieValue } from "@/lib/auth/admin-token";

export async function isAdminAuthenticated(): Promise<boolean> {
  const jar = await cookies();
  return verifyAdminCookieValue(jar.get(ADMIN_COOKIE)?.value);
}

export async function loginAdmin(password: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!expected || !secret) return false;
  if (!passwordsMatch(password, expected)) return false;
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, adminSessionToken(expected, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  return true;
}

export async function logoutAdmin() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export async function requireAdmin() {
  const ok = await isAdminAuthenticated();
  if (!ok) throw new Error("Unauthorized");
}
