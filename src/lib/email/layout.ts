import { escapeHtml } from "@/lib/mail";
import { SITE_NAME, getSiteUrl } from "@/lib/seo";

/*
 * The one layout every Let's Race email is built from.
 *
 * Email HTML is its own dialect: tables for structure, every style inline,
 * no web fonts, no SVG, nothing Outlook will not draw. The palette is the
 * app's Stone scale and brand red, written out as hex because email clients
 * know nothing of our CSS variables.
 */

const C = {
  page: "#f5f5f4", // stone-100
  card: "#ffffff",
  line: "#e7e5e4", // stone-200
  ink: "#0c0a09", // stone-950
  body: "#44403c", // stone-700
  muted: "#78716c", // stone-500
  faint: "#a8a29e", // stone-400
  brand: "#c81d25",
  button: "#1c1917", // stone-900
};
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export type EmailRace = {
  name: string;
  href: string;
  /** ISO date — the tile shows its day and month. */
  date: string;
  /** One quiet line: place · distance · what changed. */
  meta?: string;
  /** The discipline's colour, down the tile's edge. */
  color?: string;
  /** A short highlighted word after the name: "Cancelled", "New date". */
  flag?: string;
};

export type EmailSection = { title?: string; races?: EmailRace[]; text?: string };

export type EmailContent = {
  locale: string;
  /** Shown by inbox lists next to the subject; never in the body. */
  preheader: string;
  heading: string;
  intro?: string;
  sections: EmailSection[];
  cta?: { label: string; href: string };
  /** Why they are getting this. */
  reason: string;
  manage: { label: string; href: string };
  unsubscribe?: { label: string; href: string };
};

const MONTHS: Record<string, string[]> = {
  cs: ["led", "úno", "bře", "dub", "kvě", "čvn", "čvc", "srp", "zář", "říj", "lis", "pro"],
  sk: ["jan", "feb", "mar", "apr", "máj", "jún", "júl", "aug", "sep", "okt", "nov", "dec"],
  pl: ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  de: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"],
};

function tile(date: string, locale: string, color: string) {
  const [, m, d] = date.split("-");
  const month = (MONTHS[locale] ?? MONTHS.en)[Number(m) - 1] ?? "";
  return `<td width="52" valign="top" style="padding:0 14px 0 0;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="48" style="border:1px solid ${C.line};border-left:3px solid ${color};border-radius:8px;background:${C.card};">
      <tr><td align="center" style="padding:7px 0 6px;font-family:${FONT};">
        <div style="font-size:18px;line-height:18px;font-weight:700;color:${C.ink};">${Number(d)}</div>
        <div style="font-size:10px;line-height:12px;margin-top:3px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:${C.muted};">${escapeHtml(month)}</div>
      </td></tr>
    </table>
  </td>`;
}

function raceRow(r: EmailRace, locale: string, last: boolean) {
  const flag = r.flag
    ? ` <span style="display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#fdecec;color:${C.brand};font-size:11px;font-weight:600;vertical-align:1px;">${escapeHtml(r.flag)}</span>`
    : "";
  return `<tr><td style="padding:12px 0;${last ? "" : `border-bottom:1px solid ${C.line};`}">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
      ${tile(r.date, locale, r.color ?? C.faint)}
      <td valign="middle" style="font-family:${FONT};">
        <a href="${r.href}" style="font-size:15px;line-height:20px;font-weight:600;color:${C.ink};text-decoration:none;">${escapeHtml(r.name)}</a>${flag}
        ${r.meta ? `<div style="font-size:13px;line-height:18px;margin-top:3px;color:${C.muted};">${escapeHtml(r.meta)}</div>` : ""}
      </td>
    </tr></table>
  </td></tr>`;
}

function section(s: EmailSection, locale: string) {
  const title = s.title
    ? `<tr><td style="padding:24px 0 4px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.muted};">${escapeHtml(s.title)}</td></tr>`
    : "";
  const text = s.text
    ? `<tr><td style="padding:8px 0;font-family:${FONT};font-size:15px;line-height:22px;color:${C.body};">${escapeHtml(s.text)}</td></tr>`
    : "";
  const races = (s.races ?? []).map((r, i, all) => raceRow(r, locale, i === all.length - 1)).join("");
  return `${title}${text}${races}`;
}

export function renderEmail(c: EmailContent): string {
  const origin = getSiteUrl();
  const logo = `${origin}/email/lets-race@2x.png`;
  const button = c.cta
    ? `<tr><td style="padding:28px 0 4px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="border-radius:10px;background:${C.button};">
            <a href="${c.cta.href}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:14px;line-height:20px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(c.cta.label)}</a>
          </td>
        </tr></table>
      </td></tr>`
    : "";
  const links = [
    `<a href="${c.manage.href}" style="color:${C.muted};text-decoration:underline;">${escapeHtml(c.manage.label)}</a>`,
    c.unsubscribe
      ? `<a href="${c.unsubscribe.href}" style="color:${C.muted};text-decoration:underline;">${escapeHtml(c.unsubscribe.label)}</a>`
      : null,
  ]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  return `<!doctype html>
<html lang="${c.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(c.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(c.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td style="padding:0 4px 18px;">
        <a href="${origin}/${c.locale}" style="text-decoration:none;"><img src="${logo}" width="132" height="20" alt="${SITE_NAME}" style="display:block;border:0;outline:none;height:20px;width:132px;"></a>
      </td></tr>
      <tr><td style="background:${C.card};border:1px solid ${C.line};border-radius:16px;padding:32px 32px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="font-family:${FONT};font-size:22px;line-height:28px;font-weight:700;letter-spacing:-0.02em;color:${C.ink};">${escapeHtml(c.heading)}</td></tr>
          ${c.intro ? `<tr><td style="padding:8px 0 4px;font-family:${FONT};font-size:15px;line-height:22px;color:${C.body};">${escapeHtml(c.intro)}</td></tr>` : ""}
          ${c.sections.map((s) => section(s, c.locale)).join("")}
          ${button}
        </table>
      </td></tr>
      <tr><td style="padding:20px 8px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${C.faint};">
        ${escapeHtml(c.reason)}<br>${links}<br><span style="color:${C.faint};">${SITE_NAME} · ${escapeHtml(origin.replace(/^https?:\/\//, ""))}</span>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** The same email as plain text — sent alongside the HTML, which spam filters like. */
export function renderEmailText(c: EmailContent): string {
  const lines: string[] = [c.heading, ""];
  if (c.intro) lines.push(c.intro, "");
  for (const s of c.sections) {
    if (s.title) lines.push(s.title.toUpperCase());
    if (s.text) lines.push(s.text);
    for (const r of s.races ?? []) {
      lines.push(`- ${r.date.split("-").reverse().join(". ").replace(/^0/, "")}  ${r.name}${r.flag ? ` [${r.flag}]` : ""}`);
      if (r.meta) lines.push(`  ${r.meta}`);
      lines.push(`  ${r.href}`);
    }
    lines.push("");
  }
  if (c.cta) lines.push(`${c.cta.label}: ${c.cta.href}`, "");
  lines.push("—", c.reason, `${c.manage.label}: ${c.manage.href}`);
  if (c.unsubscribe) lines.push(`${c.unsubscribe.label}: ${c.unsubscribe.href}`);
  return lines.join("\n");
}
