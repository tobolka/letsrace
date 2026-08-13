import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "crypto";

const COOKIE = "startline_admin";

function tokenForPassword(password: string) {
  return createHash("sha256")
    .update(`${password}:${process.env.ADMIN_SESSION_SECRET || "startline-dev"}`)
    .digest("hex");
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  if (!value) return false;
  const expected = tokenForPassword(password);
  try {
    return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function loginAdmin(password: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || password !== expected) return false;
  const jar = await cookies();
  jar.set(COOKIE, tokenForPassword(expected), {
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
  jar.delete(COOKIE);
}

export async function requireAdmin() {
  const ok = await isAdminAuthenticated();
  if (!ok) throw new Error("Unauthorized");
}
