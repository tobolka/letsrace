/**
 * True when the code runs in a serverless runtime: no local browser, no writable disk,
 * and short-lived invocations. That is Cloudflare Workers today (and was Vercel). The
 * pipeline on the owner's Mac is the opposite and may launch Chrome and cache on disk.
 */
export function isServerless(): boolean {
  if (process.env.VERCEL || process.env.SERVERLESS_RUNTIME === "1") return true;
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}
