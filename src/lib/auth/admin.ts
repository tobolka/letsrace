import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  adminSessionToken,
  cookiesEqual,
  passwordsMatch,
} from "@/lib/auth/admin-token";

export { ADMIN_COOKIE, verifyAdminCookieValue } from "@/lib/auth/admin-token";

export async function isAdminAuthenticated(): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!password || !secret) return false;
  const jar = await cookies();
  const value = jar.get(ADMIN_COOKIE)?.value;
  if (!value) return false;
  return cookiesEqual(value, adminSessionToken(password, secret));
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
    maxAge: 60 * 60 * 24 * 14,
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
