import { createHash, timingSafeEqual } from "crypto";
import { safeEqual } from "@/lib/security";

export const ADMIN_COOKIE = "letsrace_admin";

export function adminSessionToken(password: string, secret: string) {
  return createHash("sha256").update(`${password}:${secret}`).digest("hex");
}

/** Edge-safe cookie verification (no next/headers). */
export function verifyAdminCookieValue(value: string | undefined): boolean {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!password || !secret || !value) return false;
  try {
    return safeEqual(value, adminSessionToken(password, secret));
  } catch {
    return false;
  }
}

export function passwordsMatch(provided: string, expected: string): boolean {
  try {
    return safeEqual(provided, expected);
  } catch {
    return false;
  }
}

export function cookiesEqual(a: string, b: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
