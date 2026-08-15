import { NextResponse } from "next/server";

type AlertPayload = {
  title: string;
  body: string;
  meta?: Record<string, string | number | boolean | null>;
};

/** Fire-and-forget webhook (Slack-compatible JSON or generic POST). */
export async function sendOpsAlert(payload: AlertPayload): Promise<boolean> {
  const url =
    process.env.INGEST_ALERT_WEBHOOK_URL ||
    process.env.SLACK_WEBHOOK_URL ||
    process.env.ALERT_WEBHOOK_URL;
  if (!url) return false;

  const text = [
    `*${payload.title}*`,
    payload.body,
    payload.meta
      ? Object.entries(payload.meta)
          .map(([k, v]) => `${k}=${v}`)
          .join(" · ")
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text,
        ...payload,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("ops alert failed", e);
    return false;
  }
}

export function alertJson(ok: boolean, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok, ...extra });
}
