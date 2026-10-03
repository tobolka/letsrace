/**
 * Where the missing data already is. Read-only, no model, nothing written.
 *
 * For every upcoming race in CZ, DE, PL and SK that lacks its own site, an
 * entry link, regulations or stated categories, look in the places that cost
 * nothing: a duplicate listing of the same race, the race's page at the
 * source we found it on, last year's edition, another round of its series,
 * and the race's own site.
 *   node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/measure-gaps.ts [--countries=CZ,PL]
 */
import { readFileSync, writeFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, ""); }

type Field = "web" | "registration" | "regulations" | "categories";
type Where = "duplicate" | "sourcePage" | "lastYear" | "series" | "ownSite";
const FIELDS: Field[] = ["web", "registration", "regulations", "categories"];
const WHERE: Where[] = ["duplicate", "sourcePage", "lastYear", "series", "ownSite"];

type Ev = {
  id: string; name: string; start_date: string; series_id: string | null;
  website_url: string | null; registration_url: string | null; regulations_url: string | null;
  age_categories: string[] | null; age_confidence: string | null;
  location: { country_code: string | null; municipality: string | null } | null;
  sources: { source_url: string | null }[] | null;
};

const LISTING = /pzkol\.pl|rideandrest|odjazd\.pl|kalendarzrowerowy|eventivsport|radsport-events|rad-net\.de|granfondoguide|cyklistikaszc\.sk|cyklokros\.cz\/kalendar|kalendar\.sportsoft|sumator\.cz|czechcyclingfederation|bikeri\.cz|uci\.org/i;
const JUNK = /anrdoezrs|booking\.com|awin1|tradedoubler|partner|affiliate|login|anmelden\/login|ergebnis|results?\b|vysledk|wyniki|startlist|startliste|licencni|podminky|gdpr|privacy|datenschutz|impressum|cookie/i;
const NOT_A_SITE = /facebook|instagram|youtube|twitter|x\.com|tiktok|strava|komoot|google|apple\.com|wikipedia|linkedin|mapy\.cz|openstreetmap|seznam\.cz|gstatic|googleapis|cloudflare|jquery|wordpress\.org|wp\.com|gravatar|cookiebot|sportsoft\.cz$|raceresult\.com$/i;
const RULES = /\.(pdf|docx?)(\?|$)|regulamin|propozic|ausschreib|reglement|regulation|rules|regeln|_data\/\d+\//i;

function fold(t: string): string {
  return t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}
function host(u: string): string {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}
/** A name without years, round numbers and ordinals, for matching editions. */
function core(name: string): string {
  return fold(name).replace(/\b20\d{2}\b|\b\d+\.?\b|[ivxlc]+\.\s|#\d+|\(.*?\)/g, " ").replace(/[^a-z]+/g, " ").trim();
}
const hasCats = (e: Ev) => Boolean(e.age_categories?.length && e.age_confidence === "explicit");
const ownSite = (e: Ev) => Boolean(e.website_url && !LISTING.test(e.website_url));
const has = (e: Ev, f: Field) => f === "web" ? ownSite(e) : f === "registration" ? Boolean(e.registration_url) : f === "regulations" ? Boolean(e.regulations_url) : hasCats(e);

async function page(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36" }, redirect: "follow", signal: AbortSignal.timeout(15_000) });
    if (!res.ok || !/html/i.test(res.headers.get("content-type") ?? "")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Links on a page, sorted into the race's site, entry and regulations. */
function linksOn(html: string, base: string, isRegistration: (u: string) => boolean): { web: string[]; registration: string[]; regulations: string[] } {
  const out = { web: [] as string[], registration: [] as string[], regulations: [] as string[] };
  const baseHost = host(base);
  for (const m of html.matchAll(/<a\b[^>]*href="([^"#][^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let u: string;
    try { u = new URL(m[1]!.replace(/&amp;/g, "&"), base).toString(); } catch { continue; }
    if (!/^https?:/.test(u) || JUNK.test(u)) continue;
    const label = fold(m[2]!.replace(/<[^>]+>/g, " "));
    const h = host(u);
    if (RULES.test(u) || /propozic|regulamin|ausschreibung|reglement/.test(label)) out.regulations.push(u);
    else if (isRegistration(u) || /prihl|přihl|registr|anmeld|zapisy|zgłosz|entry|nennung/.test(label)) out.registration.push(u);
    else if (h && h !== baseHost && !NOT_A_SITE.test(h) && !LISTING.test(u) && /web|www|strona|homepage|veranstalter|organiz|poradatel|pořadatel|oficial|official|stránk/.test(label + " " + u)) out.web.push(u);
  }
  return out;
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]!); }));
}

async function main() {
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const { isRegistrationPlatformUrl } = await import("../src/lib/watcher/registration-url");
  const countries = (process.argv.find((a) => a.startsWith("--countries="))?.slice(12) ?? "CZ,DE,PL,SK").split(",");
  const s = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10);
  const lastYearFrom = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
  const all: Ev[] = [];
  for (let from = 0; ; from += 300) {
    const { data, error } = await s.from("events")
      .select("id, name, start_date, series_id, website_url, registration_url, regulations_url, age_categories, age_confidence, location:locations(country_code, municipality)")
      .eq("visibility", "public").is("merged_into_id", null).neq("event_type", "ride")
      .gte("start_date", lastYearFrom).lte("start_date", until).order("start_date").order("id").range(from, from + 299);
    if (error) throw new Error(error.message);
    all.push(...((data ?? []) as unknown as Ev[]));
    if (!data || data.length < 300) break;
  }
  // Sources separately: joined, the query runs past the statement timeout.
  const upcomingIds = all.filter((e) => e.start_date >= today).map((e) => e.id);
  const byEvent = new Map<string, { source_url: string | null }[]>();
  for (let i = 0; i < upcomingIds.length; i += 200) {
    const { data } = await s.from("event_sources").select("event_id, source_url").in("event_id", upcomingIds.slice(i, i + 200));
    for (const r of (data ?? []) as { event_id: string; source_url: string | null }[]) {
      if (!byEvent.has(r.event_id)) byEvent.set(r.event_id, []);
      byEvent.get(r.event_id)!.push({ source_url: r.source_url });
    }
  }
  for (const e of all) e.sources = byEvent.get(e.id) ?? [];
  const upcoming = all.filter((e) => e.start_date >= today && countries.includes(e.location?.country_code ?? ""));
  const past = all.filter((e) => e.start_date < today);
  const gaps = upcoming.filter((e) => FIELDS.some((f) => !has(e, f)));

  // How often a source page is shared: a calendar's list page is not about one race.
  const shared = new Map<string, number>();
  for (const e of upcoming) for (const src of e.sources ?? []) if (src.source_url) {
    const k = src.source_url.replace(/#.*$/, "");
    shared.set(k, (shared.get(k) ?? 0) + 1);
  }

  type Row = { country: string; field: Field; missing: number } & Record<Where, number> & { any: number };
  const table = new Map<string, Row>();
  const row = (c: string, f: Field) => {
    const k = `${c}|${f}`;
    if (!table.has(k)) table.set(k, { country: c, field: f, missing: 0, duplicate: 0, sourcePage: 0, lastYear: 0, series: 0, ownSite: 0, any: 0 });
    return table.get(k)!;
  };
  const samples: string[] = [];
  const pageCache = new Map<string, Promise<string | null>>();
  const cached = (u: string) => { if (!pageCache.has(u)) pageCache.set(u, page(u)); return pageCache.get(u)!; };

  let done = 0;
  await pool(gaps, 6, async (e) => {
    const c = e.location?.country_code ?? "?";
    const found: Partial<Record<Field, Set<Where>>> = {};
    const mark = (f: Field, w: Where, what: string) => {
      if (has(e, f)) return;
      (found[f] ??= new Set()).add(w);
      if (samples.length < 400) samples.push(`${c}\t${e.start_date}\t${e.name}\t${f}\t${w}\t${what}`);
    };
    const words = core(e.name).split(" ").filter((w) => w.length >= 4);
    const day = Date.parse(e.start_date);

    // 1. Another listing of the same race: within a day, same town or a shared name word.
    for (const o of upcoming) {
      if (o.id === e.id || Math.abs(Date.parse(o.start_date) - day) > 864e5 || o.location?.country_code !== c) continue;
      const sameTown = Boolean(e.location?.municipality) && fold(o.location?.municipality ?? "") === fold(e.location!.municipality!);
      const other = core(o.name).split(" ");
      const shared = words.filter((w) => w.length >= 5 && other.includes(w)).length;
      // Same race: same town and a shared name word, or two shared name words.
      if (!(sameTown && shared >= 1) && shared < 2) continue;
      for (const f of FIELDS) if (has(o, f)) mark(f, "duplicate", o.name);
    }
    // 2. Last year's edition with the same name.
    const key = core(e.name);
    for (const o of past) {
      if (o.location?.country_code !== c || core(o.name) !== key || key.length < 6) continue;
      const gap = day - Date.parse(o.start_date);
      if (gap < 300 * 864e5 || gap > 430 * 864e5) continue;
      if (ownSite(o)) mark("web", "lastYear", o.website_url!);
      if (o.registration_url && isRegistrationPlatformUrl(o.registration_url)) mark("registration", "lastYear", o.registration_url);
    }
    // 3. Another round of its series with a site or an entry platform.
    if (e.series_id) {
      const sib = upcoming.find((o) => o.id !== e.id && o.series_id === e.series_id && (ownSite(o) || o.registration_url));
      if (sib && ownSite(sib)) mark("web", "series", sib.website_url!);
      if (sib?.registration_url) mark("registration", "series", sib.registration_url);
    }
    // 4. The race's page at its source: a page about this race only.
    for (const src of e.sources ?? []) {
      const u = src.source_url;
      if (!u || u.includes("#") || (shared.get(u) ?? 0) > 1 || /\.pdf(\?|$)/i.test(u)) continue;
      const html = await cached(u);
      if (!html) continue;
      const l = linksOn(html, u, isRegistrationPlatformUrl);
      if (l.web[0]) mark("web", "sourcePage", l.web[0]);
      if (l.registration[0]) mark("registration", "sourcePage", l.registration[0]);
      if (l.regulations[0]) { mark("regulations", "sourcePage", l.regulations[0]); mark("categories", "sourcePage", `regulations ${l.regulations[0]}`); }
    }
    // 5. The race's own site, front page and the links on it.
    if (ownSite(e) && (!e.registration_url || !e.regulations_url || !hasCats(e))) {
      const html = await cached(e.website_url!);
      if (html) {
        const l = linksOn(html, e.website_url!, isRegistrationPlatformUrl);
        if (l.registration[0]) mark("registration", "ownSite", l.registration[0]);
        if (l.regulations[0]) { mark("regulations", "ownSite", l.regulations[0]); mark("categories", "ownSite", `regulations ${l.regulations[0]}`); }
      }
    }
    for (const f of FIELDS) {
      if (has(e, f)) continue;
      const r = row(c, f);
      r.missing += 1;
      const w = found[f];
      if (!w?.size) continue;
      r.any += 1;
      for (const x of w) r[x] += 1;
    }
    if (++done % 50 === 0) console.error(`${done}/${gaps.length}`);
  });

  const order = [...table.values()].sort((a, b) => a.country.localeCompare(b.country) || FIELDS.indexOf(a.field) - FIELDS.indexOf(b.field));
  const total = upcoming.reduce<Record<string, number>>((m, e) => ((m[e.location!.country_code!] = (m[e.location!.country_code!] ?? 0) + 1), m), {});
  console.log("Upcoming races:", total);
  console.table(order.map((r) => ({ country: r.country, field: r.field, missing: r.missing, alreadyFindable: `${r.any} (${Math.round((100 * r.any) / Math.max(1, r.missing))}%)`, ...Object.fromEntries(WHERE.map((w) => [w, r[w]])) })));
  writeFileSync("tmp/measure-gaps-samples.tsv", samples.join("\n"));
  console.log("samples: tmp/measure-gaps-samples.tsv");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
