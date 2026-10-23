import { createHmac } from "crypto";
import { safeEqual } from "@/lib/security";

export const ADMIN_COOKIE = "letsrace_admin";

/** How long a sign-in lasts. The cookie and the token carry the same limit. */
export const ADMIN_SESSION_SECONDS = 60 * 60 * 24 * 14;

const VERSION = "v1";

/**
 * The signature covers the expiry and the password, keyed by the session
 * secret: changing either the password or the secret signs everyone out, and
 * a stolen cookie stops working on its own at `exp` instead of when somebody
 * thinks to rotate a secret.
 */
function sign(exp: number, password: string, secret: string): string {
  return createHmac("sha256", secret).update(`${VERSION}.${exp}.${password}`).digest("hex");
}

/** A cookie value good until `now` plus the session length. */
export function adminSessionToken(password: string, secret: string, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ADMIN_SESSION_SECONDS;
  return `${VERSION}.${exp}.${sign(exp, password, secret)}`;
}

/** Edge-safe cookie verification (no next/headers). */
export function verifyAdminCookieValue(value: string | undefined, now = Date.now()): boolean {
  const password = process.env.ADMIN_PASSWORD;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!password || !secret || !value) return false;
  const [version, expRaw, signature, ...rest] = value.split(".");
  if (version !== VERSION || !expRaw || !signature || rest.length > 0) return false;
  const exp = Number(expRaw);
  if (!Number.isInteger(exp) || exp * 1000 <= now) return false;
  return safeEqual(signature, sign(exp, password, secret));
}

export function passwordsMatch(provided: string, expected: string): boolean {
  return safeEqual(provided, expected);
}
