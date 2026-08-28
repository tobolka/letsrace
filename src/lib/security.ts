import { createHash, timingSafeEqual } from "crypto";

/** Constant-time string compare (length mismatch always fails). */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    // Still hash both so timing is closer for unequal lengths.
    const ha = createHash("sha256").update(left).digest();
    const hb = createHash("sha256").update(right).digest();
    timingSafeEqual(ha, hb);
    return false;
  }
  return timingSafeEqual(left, right);
}

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
/** Drop expired buckets periodically so a long-lived instance cannot leak keys. */
const SWEEP_EVERY_MS = 60_000;
let lastSweepAt = 0;

function sweep(now: number) {
  if (now - lastSweepAt < SWEEP_EVERY_MS) return;
  lastSweepAt = now;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/**
 * Simple in-process rate limit. Returns true when the request is allowed.
 * Per-instance only — serverless runs several instances, so treat this as
 * abuse damping, not a hard quota.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}
