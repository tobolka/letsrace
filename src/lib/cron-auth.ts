import { safeEqual } from "@/lib/security";

export function requireCronSecret(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return safeEqual(token, expected);
}
