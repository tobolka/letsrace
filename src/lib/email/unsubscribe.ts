import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/security";

/**
 * What an unsubscribe link switches off: one watched area's alerts, or one
 * account's plan-change mails, or its Wednesday digest.
 */
export type UnsubscribeTarget =
  | { kind: "alert"; id: string }
  | { kind: "plan"; id: string }
  | { kind: "digest"; id: string };

const KINDS = new Set(["alert", "plan", "digest"]);

function secret(): string | null {
  return process.env.EMAIL_LINK_SECRET || process.env.CRON_SECRET || null;
}

function sign(payload: string, key: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url").slice(0, 32);
}

/**
 * A token that names what to switch off and proves we issued it, so the link
 * works without signing in — which is what an unsubscribe link has to do —
 * and cannot be pointed at somebody else's account.
 */
export function unsubscribeToken(target: UnsubscribeTarget): string | null {
  const key = secret();
  if (!key) return null;
  const payload = `${target.kind}.${target.id}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload, key)}`;
}

export function readUnsubscribeToken(token: string | null | undefined): UnsubscribeTarget | null {
  const key = secret();
  if (!key || !token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let payload: string;
  try {
    payload = Buffer.from(body, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!safeEqual(sig, sign(payload, key))) return null;
  const dot = payload.indexOf(".");
  const kind = payload.slice(0, dot);
  const id = payload.slice(dot + 1);
  if (!KINDS.has(kind) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return { kind, id } as UnsubscribeTarget;
}
