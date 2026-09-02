/**
 * The race plan as an iCalendar feed.
 *
 * A plan that lives only on this site is a plan nobody sees on a Friday
 * evening. Subscribing to it puts the weekend's race in the same place as the
 * dentist and the school run, which is where the decision actually gets made.
 */

export type IcsEvent = {
  uid: string;
  /** All-day events: start inclusive, end exclusive per RFC 5545. */
  startDate: string;
  endDate: string | null;
  summary: string;
  location: string | null;
  description: string | null;
  url: string | null;
  updatedAt: string | null;
};

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC 5545 caps lines at 75 octets; long race names routinely pass that. */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + (start === 0 ? 75 : 74), bytes.length);
    // Never split a multi-byte character across a fold.
    while (end < bytes.length && (bytes[end] & 0b1100_0000) === 0b1000_0000) end -= 1;
    out.push((start === 0 ? "" : " ") + bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return out.join("\r\n");
}

function stamp(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const use = Number.isNaN(d.getTime()) ? new Date() : d;
  return `${use.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function plusDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function compact(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

export function buildIcs(opts: {
  name: string;
  description: string;
  events: IcsEvent[];
}): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Let's Race//Race plan//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.name)}`,
    `X-WR-CALDESC:${escapeText(opts.description)}`,
    // Most clients refresh a subscription on their own schedule; asking for
    // twelve hours keeps a race added on Saturday morning from arriving Monday.
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
  ];

  for (const ev of opts.events) {
    const end = ev.endDate && ev.endDate > ev.startDate ? plusDay(ev.endDate) : plusDay(ev.startDate);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.uid}`,
      `DTSTAMP:${stamp(ev.updatedAt)}`,
      `DTSTART;VALUE=DATE:${compact(ev.startDate)}`,
      `DTEND;VALUE=DATE:${compact(end)}`,
      `SUMMARY:${escapeText(ev.summary)}`,
    );
    if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    if (ev.url) lines.push(`URL:${ev.url}`);
    lines.push("TRANSP:OPAQUE", "END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
