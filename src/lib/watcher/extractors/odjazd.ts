import type { Discipline, ParsedEvent } from "@/lib/domain";
import { fetchText } from "@/lib/watcher/http";
import { mapPool } from "@/lib/watcher/pool";
import { isPolishYouthRace } from "@/lib/watcher/extractors/pl-shared";

const ORIGIN = "https://odjazd.pl";
const WEEKS_AHEAD = 12;
/** One fetch per race, so keep a run bounded. */
const MAX_DETAILS = 260;

/** odjazd covers skating and multisport too; only `Rower` is us. */
const CYCLING_SPORT = "Rower";

const DISCIPLINE: Record<string, Discipline> = {
  szosa: "road",
  mtb: "mtb",
  gravel: "gravel",
  bmx: "bmx",
  tor: "track",
  przelaj: "cx",
  przełaj: "cx",
  cx: "cx",
};

type ListItem = {
  name?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  sport?: string;
  location?: { name?: string; address?: { addressLocality?: string; addressCountry?: string } };
};

export function isOdjazdHost(host: string): boolean {
  return host.replace(/^www\./, "").endsWith("odjazd.pl");
}

/**
 * The race ids on odjazd.pl's cycling listings.
 *
 * The weekly pages (/tydzien/…) the reader was built on now redirect to the
 * home page, and the source read nothing: 251 races stopped being watched.
 * The discipline listings still carry a card for every upcoming race, each
 * linking its own page, and that page has the full SportsEvent — name, dates,
 * sport, town — so the listing only has to say which pages to fetch.
 */
const LISTING_PAGES = ["/sport/rower", "/dyscyplina/szosa", "/dyscyplina/mtb", "/dyscyplina/gravel", "/dyscyplina/cx", "/dyscyplina/bmx"];

export function raceIdsFromListing(html: string): string[] {
  return [...new Set([...html.matchAll(/\/wydarzenie\/([0-9a-f]{8}-[0-9a-f-]{27})/gi)].map((m) => m[1]!.toLowerCase()))];
}

export async function parseOdjazd(): Promise<ParsedEvent[]> {
  const ids = new Set<string>();
  for (const path of LISTING_PAGES) {
    const page = await fetchText(`${ORIGIN}${path}`, { timeoutMs: 20_000 });
    if (!page.ok || !page.text) continue;
    raceIdsFromListing(page.text).forEach((id) => ids.add(id));
  }
  // The old weekly listing, in case it comes back — it is the only one that
  // names races far ahead.
  const stubs = new Map<string, ParsedEvent>();
  // These weekly URLs currently redirect to the home page. They are a fallback
  // only, otherwise twelve redundant pages consume the budget before any write.
  for (const week of ids.size ? [] : upcomingWeeks(WEEKS_AHEAD)) {
    const page = await fetchText(`${ORIGIN}/tydzien/${week}`, { timeoutMs: 20_000 });
    if (!page.ok || !page.text) continue;
    for (const item of listItems(page.text)) {
      const ev = toStub(item);
      if (ev && !stubs.has(ev.externalId)) stubs.set(ev.externalId, ev);
    }
  }
  const known = new Set([...stubs.keys()].map((k) => k.replace(/^odjazd-/, "")));
  const fresh = [...ids].filter((id) => !known.has(id)).slice(0, MAX_DETAILS);

  const detailed = await mapPool<string, ParsedEvent | null>(fresh, 6, async (id) => {
    try {
      const url = `${ORIGIN}/wydarzenie/${id}`;
      const page = await fetchText(url, { timeoutMs: 15_000 });
      return page.ok && page.text ? eventFromDetail(page.text, url) : null;
    } catch {
      return null;
    }
  });
  for (const ev of detailed) if (ev && !stubs.has(ev.externalId)) stubs.set(ev.externalId, ev);

  // Stubs from the old weekly listing still need their name from the page;
  // races read from their own page already have it.
  const all = [...stubs.values()];
  const unnamed = all.filter((e) => !e.name || /^Rower\s*·/i.test(e.name));
  const named = all.filter((e) => e.name && !/^Rower\s*·/i.test(e.name));
  return [...named, ...(await nameFromDetailPages(unnamed))];
}

/** One race from its own page's SportsEvent. */
export function eventFromDetail(html: string, url: string): ParsedEvent | null {
  for (const raw of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data: unknown;
    try {
      data = JSON.parse(raw[1]!);
    } catch {
      continue;
    }
    const ev = data as ListItem & { "@type"?: string; description?: string };
    if (ev["@type"] !== "SportsEvent" || !ev.name) continue;
    const stub = toStub({ ...ev, url, name: ev.description ?? ev.name });
    if (!stub) return null;
    const name = ev.name.replace(/\s+/g, " ").trim();
    if (name.length < 3 || /^Rower\s*·/i.test(name)) return null;
    return {
      ...stub,
      name: name.slice(0, 160),
      audience: isPolishYouthRace(name) ? "kids" : stub.audience,
    };
  }
  return null;
}

/** ISO weeks starting with the one containing today. */
export function upcomingWeeks(count: number, from = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const d = new Date(from.getTime() + i * 7 * 86_400_000);
    out.push(isoWeek(d));
  }
  return out;
}

function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // ISO weeks are Monday-based and numbered by the Thursday they contain.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function listItems(html: string): ListItem[] {
  const out: ListItem[] = [];
  for (const raw of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data: unknown;
    try {
      data = JSON.parse(raw[1]!);
    } catch {
      continue;
    }
    const list = data as { "@type"?: string; itemListElement?: { item?: ListItem }[] };
    if (list["@type"] !== "ItemList" || !Array.isArray(list.itemListElement)) continue;
    for (const entry of list.itemListElement) {
      if (entry.item) out.push(entry.item);
    }
  }
  return out;
}

export function toStub(item: ListItem): ParsedEvent | null {
  if (item.sport !== CYCLING_SPORT) return null;
  const id = item.url?.match(/\/wydarzenie\/([0-9a-f-]{16,})/i)?.[1];
  const startDate = (item.startDate ?? "").slice(0, 10);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;

  const endDate = (item.endDate ?? "").slice(0, 10);
  // "Rower · MTB" in a listing, "Rower · CX — 13 grudnia 2026, …" on a page.
  const label = (item.name ?? "").split("·").pop()?.split("—")[0]?.trim().toLowerCase() ?? "";
  const discipline = DISCIPLINE[label];
  // odjazd prints "[?]" where an organiser left the venue blank.
  const raw = item.location?.address?.addressLocality || item.location?.name || "";
  const place = /^\[?\?\]?$/.test(raw.trim()) ? "" : raw.trim();

  return {
    externalId: `odjazd-${id}`,
    // Replaced from the race's own page; the listing only names the discipline.
    name: item.name ?? "",
    startDate,
    endDate: /^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate !== startDate ? endDate : undefined,
    placeText: place,
    countryHint: item.location?.address?.addressCountry || "PL",
    discipline: discipline ? [discipline] : undefined,
    audience: "mixed",
    sourceUrl: item.url!,
    confidence: 0.8,
  };
}

async function nameFromDetailPages(stubs: ParsedEvent[]): Promise<ParsedEvent[]> {
  const wanted = stubs
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, MAX_DETAILS);

  const named = await mapPool<ParsedEvent, ParsedEvent | null>(wanted, 6, async (ev) => {
    try {
      const page = await fetchText(ev.sourceUrl, { timeoutMs: 15_000 });
      if (!page.ok || !page.text) return null;
      const name = eventName(page.text);
      if (!name) return null;
      return {
        ...ev,
        name: name.slice(0, 160),
        audience: isPolishYouthRace(name) ? ("kids" as const) : ev.audience,
      };
    } catch {
      return null;
    }
  });

  // A race we could not name is a discipline label, not a race — leave it out.
  return named.filter((e): e is ParsedEvent => e !== null);
}

export function eventName(html: string): string | null {
  for (const raw of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data: unknown;
    try {
      data = JSON.parse(raw[1]!);
    } catch {
      continue;
    }
    const ev = data as { "@type"?: string; name?: string };
    if (ev["@type"] !== "SportsEvent" || !ev.name) continue;
    const name = ev.name.replace(/\s+/g, " ").trim();
    if (name.length >= 3 && !/^Rower\s*·/i.test(name)) return name;
  }
  return null;
}
