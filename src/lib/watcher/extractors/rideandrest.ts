import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import type { EventType } from "@/lib/taxonomy";
import { fetchText } from "@/lib/watcher/http";

const ORIGIN = "https://rideandrest.net";
const MONTHS_AHEAD = 12;

export function isRideAndRestHost(host: string): boolean {
  return host.replace(/^www\./, "").endsWith("rideandrest.net");
}

/** What the "Tipo" label says about the ground and the format. */
function disciplineOf(tipo: string, pill: string): Discipline[] {
  const t = `${tipo} ${pill}`.toLowerCase();
  if (/ciclocross/.test(t)) return ["cx"];
  if (/downhill/.test(t)) return ["dh"];
  if (/enduro/.test(t)) return ["enduro"];
  if (/crosscountry/.test(t)) return ["xco"];
  if (/\bbmx\b/.test(t)) return ["bmx"];
  if (/\bpista\b/.test(t)) return ["track"];
  if (/gravel/.test(t)) return ["gravel"];
  if (/fuoristrada|mountain bike|mtb/.test(t)) return ["mtb"];
  if (/trial|handbike|fisdir/.test(t)) return ["other"];
  return ["road"];
}

function eventTypeOf(tipo: string, pill: string): EventType | undefined {
  const t = `${tipo} ${pill}`.toLowerCase();
  if (/granfondo|gran fondo|mediofondo/.test(t)) return "gran_fondo";
  if (/pedalata|raduno|cicloturistic|ciclostorica|randonn|non comp|non competitive/.test(t)) return "ride";
  return undefined;
}

/**
 * One month of rideandrest.net's calendar: every Italian race the federation
 * lists, with the day, the town, the length and the kind. The page names no
 * organiser site, so the row carries only what it states; the detail page is
 * kept as the source.
 */
export function parseRideAndRestMonth(html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const month = html.match(/\?mese=(\d{4})-(\d{2})/);
  const ym = month ? `${month[1]}-${month[2]}` : null;
  if (!ym) return [];
  const out: ParsedEvent[] = [];
  $("ul.rr-cal-elenco > li").each((_, li) => {
    const day = $(li).find(".rr-cal-gg").first().clone().children().remove().end().text().trim();
    const a = $(li).find(".rr-cal-corpo > a").first();
    const href = a.attr("href") ?? "";
    const name = a.text().replace(/\s+/g, " ").trim();
    const slug = href.match(/\/manifestazione\/([^/]+)\/?$/)?.[1];
    if (!/^\d{1,2}$/.test(day) || !slug || name.length < 3) return;
    const meta = $(li).find(".rr-cal-meta").first();
    const pill = meta.find(".rr-cal-pillola").text().trim();
    const parts = meta
      .clone()
      .children()
      .remove()
      .end()
      .text()
      .split("·")
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const place = parts[0] ?? "";
    const tipo = parts[parts.length - 1] ?? "";
    const startDate = `${ym}-${day.padStart(2, "0")}`;
    out.push({
      externalId: `rideandrest-${slug}-${startDate}`,
      name,
      startDate,
      placeText: place ? `${place}, Italia` : "Italia",
      countryHint: "IT",
      discipline: disciplineOf(tipo, pill),
      eventType: eventTypeOf(tipo, pill),
      sourceUrl: href,
      confidence: 0.8,
    });
  });
  return out;
}

/** The coming months, one page each. */
export async function parseRideAndRest(): Promise<ParsedEvent[]> {
  const now = new Date();
  const byId = new Map<string, ParsedEvent>();
  for (let i = 0; i < MONTHS_AHEAD; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const page = await fetchText(`${ORIGIN}/eventi/?mese=${ym}`, { timeoutMs: 25_000 });
    if (!page.ok || !page.text) continue;
    const today = now.toISOString().slice(0, 10);
    for (const ev of parseRideAndRestMonth(page.text)) {
      if (ev.startDate >= today) byId.set(ev.externalId, ev);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return [...byId.values()];
}
