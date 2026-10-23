import { NextRequest, NextResponse } from "next/server";
import { readUnsubscribeToken, type UnsubscribeTarget } from "@/lib/email/unsubscribe";
import { escapeHtml } from "@/lib/mail";
import { asLocale, messagesFor } from "@/lib/i18n/messages";
import { createServerSupabase } from "@/lib/supabase/server";
import { getSiteUrl, SITE_NAME } from "@/lib/seo";

/*
 * Unsubscribe without signing in.
 *
 * GET shows a page with one button, and only the POST it sends changes
 * anything: mail scanners open every link in a message, and a GET that
 * unsubscribed would switch people off before they ever read the email. The
 * POST is also what Gmail's own "Unsubscribe" button sends (RFC 8058,
 * `List-Unsubscribe=One-Click`), so both paths end in the same place.
 */

async function apply(target: UnsubscribeTarget): Promise<boolean> {
  const supabase = createServerSupabase();
  if (target.kind === "alert") {
    const { error } = await supabase.from("race_alerts").update({ enabled: false }).eq("id", target.id);
    return !error;
  }
  const off = target.kind === "plan" ? { plan_mail: false } : { digest_mail: false };
  const { error } = await supabase.from("profiles").update(off).eq("id", target.id);
  return !error;
}

function page(locale: string, body: string): NextResponse {
  const t = messagesFor(locale);
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHtml(t.unsubTitle)} · ${SITE_NAME}</title></head>
<body style="margin:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0c0a09;">
<main style="max-width:440px;margin:12vh auto 0;padding:0 16px;">
<img src="${getSiteUrl()}/email/lets-race@2x.png" width="132" height="20" alt="${SITE_NAME}" style="display:block;margin:0 0 20px 4px;">
<div style="background:#fff;border:1px solid #e7e5e4;border-radius:16px;padding:28px;">${body}</div>
<p style="margin:16px 4px;font-size:13px;"><a href="${getSiteUrl()}/${locale}" style="color:#78716c;">${escapeHtml(t.unsubBack)}</a></p>
</main></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function GET(req: NextRequest) {
  const locale = asLocale(req.nextUrl.searchParams.get("l") ?? "cs");
  const t = messagesFor(locale);
  const token = req.nextUrl.searchParams.get("t");
  if (!readUnsubscribeToken(token)) {
    return page(locale, `<p style="margin:0;font-size:15px;">${escapeHtml(t.unsubInvalid)}</p>`);
  }
  return page(
    locale,
    `<h1 style="margin:0 0 8px;font-size:20px;">${escapeHtml(t.unsubTitle)}</h1>
     <p style="margin:0 0 20px;font-size:15px;line-height:22px;color:#44403c;">${escapeHtml(t.unsubConfirm)}</p>
     <form method="post"><input type="hidden" name="t" value="${escapeHtml(token ?? "")}"><input type="hidden" name="l" value="${locale}">
     <button type="submit" style="border:0;border-radius:10px;background:#1c1917;color:#fff;font:600 14px/20px inherit;padding:12px 22px;cursor:pointer;">${escapeHtml(t.unsubButton)}</button></form>`,
  );
}

export async function POST(req: NextRequest) {
  const url = req.nextUrl;
  const form = await req.formData().catch(() => null);
  const token = (form?.get("t") as string | null) ?? url.searchParams.get("t");
  const locale = asLocale((form?.get("l") as string | null) ?? url.searchParams.get("l") ?? "cs");
  const t = messagesFor(locale);
  const target = readUnsubscribeToken(token);
  const oneClick = form?.get("List-Unsubscribe") === "One-Click";

  if (!target) {
    return oneClick
      ? NextResponse.json({ error: "invalid token" }, { status: 400 })
      : page(locale, `<p style="margin:0;font-size:15px;">${escapeHtml(t.unsubInvalid)}</p>`);
  }
  const ok = await apply(target);
  if (oneClick) return NextResponse.json({ ok }, { status: ok ? 200 : 500 });
  return page(
    locale,
    `<h1 style="margin:0 0 8px;font-size:20px;">${escapeHtml(t.unsubTitle)}</h1>
     <p style="margin:0;font-size:15px;line-height:22px;color:#44403c;">${escapeHtml(ok ? t.unsubDone : t.loadFailed)}</p>`,
  );
}
