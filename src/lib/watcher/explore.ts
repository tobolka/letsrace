import * as cheerio from "cheerio";
import { createServerSupabase } from "@/lib/supabase/server";
import { explorerWeight } from "@/lib/coverage";
import { extractGeneric } from "@/lib/watcher/extractors/generic";
import { fetchPage } from "@/lib/watcher/http";
import { hostnameOf, mapPool } from "@/lib/watcher/pool";
import { isAggregatorUrl } from "@/lib/watcher/public-url";

const SEARCH_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const YEAR = new Date().getFullYear();

export type CountryPack = {
  id: string;
  queries: string[];
  crt: string[];
};

const COUNTRY_PACKS: CountryPack[] = [
  {
    id: "cz",
    queries: [
      `závod MTB ${YEAR} site:.cz`,
      `"cup" XC ${YEAR} site:.cz -hynekmusil -sumator`,
      `propozice MTB ${YEAR} site:.cz`,
      `gravel závod ${YEAR} Česko`,
      `dětský MTB cup ${YEAR} site:.cz`,
    ],
    crt: ["cup.cz", "mtb.cz", "race.cz", "kolo.cz"],
  },
  {
    id: "sk",
    queries: [
      `preteky MTB ${YEAR} site:.sk`,
      `cyklistické preteky ${YEAR} registrácia`,
      `MTB cup ${YEAR} Slovensko`,
      `gravel preteky ${YEAR} site:.sk`,
    ],
    crt: ["cup.sk", "mtb.sk", "bike.sk"],
  },
  {
    id: "at",
    queries: [
      `MTB Rennen ${YEAR} site:.at`,
      `Radrennen Anmeldung ${YEAR} Österreich`,
      `Kids Cup MTB ${YEAR} site:.at`,
      `Gravel Rennen ${YEAR} Österreich`,
    ],
    crt: ["cup.at", "mtb.at", "bike.at", "rennen.at"],
  },
  {
    id: "de",
    queries: [
      `MTB Rennen ${YEAR} site:.de -radsport-events`,
      `Jedermann Rennen Rad ${YEAR} Anmeldung`,
      `Kids Cup MTB ${YEAR} site:.de`,
      `Gravel Rennen ${YEAR} Deutschland`,
      `Cyclocross Rennen ${YEAR} site:.de`,
    ],
    crt: ["cup.de", "mtb.de", "rennen.de", "bike.de"],
  },
  {
    id: "pl",
    queries: [
      `wyścig MTB ${YEAR} site:.pl`,
      `zawody kolarskie ${YEAR} zapisy`,
      `MTB cup ${YEAR} Polska`,
      `gravel wyścig ${YEAR} site:.pl`,
    ],
    crt: ["cup.pl", "mtb.pl", "bike.pl"],
  },
  {
    id: "ch",
    queries: [
      `MTB Rennen ${YEAR} site:.ch`,
      `Radrennen Anmeldung ${YEAR} Schweiz`,
      `Gravel Rennen ${YEAR} Schweiz`,
    ],
    crt: ["cup.ch", "mtb.ch", "bike.ch"],
  },
  {
    id: "it",
    queries: [
      `gara MTB ${YEAR} site:.it -federciclismo`,
      `granfondo ${YEAR} iscrizioni site:.it`,
      `coppa MTB ${YEAR} calendario`,
      `ciclocross gara ${YEAR} site:.it`,
    ],
    crt: ["cup.it", "mtb.it", "race.it", "granfondo.it"],
  },
];

const RACE_HOST =
  /cup|coppa|puchar|race|rennen|gara|wyscig|wyścig|pretek|mtb|xco|xcm|xcc|\bxc\b|gravel|kolo|bike|velo|maraton|marathon|cyclo|cyklo|enduro|downhill|criterium|kritérium|granfondo|bikemaraton|tour|radsport|k-koren|snek|šnek/i;

const RACE_PATH =
  /zavod|závod|zavody|pretek|preteky|race|rennen|gara|wyscig|wyścig|zawody|cup|kalendar|kalendář|kalender|calendario|kalendarz|propozic|registrac|prihlas|anmeldung|ausschreibung|nennung|iscriz|regolamento|zapisy|regulamin|trat|termine/i;

const PUBLIC_TLD = /\.(cz|sk|pl|at|de|ch|si|hu|it|nl|be|dk|fr|es)$/i;

const SKIP_HOSTS = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "linkedin.com",
  "wikipedia.org",
  "google.com",
  "google.cz",
  "google.de",
  "google.at",
  "google.sk",
  "google.pl",
  "google.it",
  "duckduckgo.com",
  "bing.com",
  "letsrace.cz",
  "www.letsrace.cz",
  "letsrace.vercel.app",
  "wixsite.com",
  "sites.google.com",
  "linktr.ee",
  "sportovnilisty.cz",
  "cesky-pohar.cz",
  "cyclingaustria.at",
  "rad-net.de",
  "bdr-online.org",
  "federciclismo.it",
  "pzkol.pl",
  "slovakcycling.sk",
  "uci.org",
];

const QUEUE_MIN = 0.45;
/** High enough that a dated club page with entry still auto-watches; junk calendars stay queued. */
export const AUTO_WATCH_MIN = 0.82;

export type ExploreScore = {
  score: number;
  reasons: string[];
};

export function shouldAutoWatch(hit: ExploreScore): boolean {
  if (hit.score < AUTO_WATCH_MIN) return false;
  const reasons = new Set(hit.reasons);
  if (!reasons.has("date")) return false;
  return reasons.has("entry") || reasons.has("structured");
}

export type ExploreResult = {
  queries: string[];
  candidates: number;
  fetched: number;
  queued: number;
  autoWatched: number;
  skipped: number;
  samples: { url: string; score: number; title?: string }[];
};

export function canonicalExploreUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|mc_|ref$)/i.test(key)) u.searchParams.delete(key);
  }
  const host = u.hostname.replace(/^www\./i, "").toLowerCase();
  if (!host || host === "unknown") return null;
  u.hostname = host;
  const path = (u.pathname.replace(/\/+$/, "") || "/").toLowerCase();
  if (
    path === "/" ||
    /^\/(wordpress|wp|cs|sk|en|pl|de|fr|it|index\.php|home|uvod)$/i.test(path)
  ) {
    u.pathname = "/";
    u.search = "";
  }
  const out = u.toString().replace(/\/$/, "");
  return out || `${u.protocol}//${host}`;
}

export function looksLikeIndependentRaceUrl(raw: string): boolean {
  const url = canonicalExploreUrl(raw);
  if (!url) return false;
  if (isAggregatorUrl(url)) return false;
  const host = hostnameOf(url);
  if (SKIP_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return false;
  if (!PUBLIC_TLD.test(host)) return false;
  try {
    const path = new URL(url).pathname;
    if (RACE_HOST.test(host) || RACE_PATH.test(path) || RACE_PATH.test(url)) return true;
  } catch {
    return false;
  }
  return false;
}

export function scoreRacePage(url: string, html: string): ExploreScore {
  const reasons: string[] = [];
  let score = 0;
  const host = hostnameOf(url);
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const title = (
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text() ||
    $("title").text()
  )
    .replace(/\s+/g, " ")
    .trim();
  const text = `${title} ${$("body").text()}`.replace(/\s+/g, " ").slice(0, 24_000);
  const blob = `${url} ${text}`;

  if (RACE_HOST.test(host)) {
    score += 0.22;
    reasons.push("host");
  }
  if (
    /závod|zavod|pretek|cup|coppa|puchar|race|rennen|gara|wyścig|wyscig|maraton|cyklist|radsport|ciclismo|kolarstw/i.test(
      title,
    )
  ) {
    score += 0.2;
    reasons.push("title");
  }
  if (
    /registrac|propozic|startovk|trat[eě]|kategorie|anmeldung|ausschreibung|nennung|iscriz|regolamento|zapisy|regulamin|prihláš|prihlas/i.test(
      text,
    )
  ) {
    score += 0.14;
    reasons.push("entry");
  }
  const yearRe = new RegExp(String(YEAR) + "|" + String(YEAR + 1));
  const hasDate =
    /\d{1,2}\.\s*\d{1,2}\.|\d{1,2}\.\s*[A-Za-zÁ-ž]+|\d{1,2}\s+[A-Za-zÀ-ž]+(?:\s+20\d{2})?|20\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/.test(
      text,
    );
  if (yearRe.test(text) && hasDate) {
    score += 0.2;
    reasons.push("date");
  }
  if (
    /\b(mtb|xco|xcm|xc\b|gravel|cyklist|cyklo|enduro|silnic|koloběž|bike|rennen|radsport|ciclismo|kolarstw|bicykel)\b/i.test(
      blob,
    )
  ) {
    score += 0.14;
    reasons.push("bike");
  }
  if (/SportsEvent|schema\.org\/Event/i.test(html) || extractGeneric(url, html).length) {
    score += 0.18;
    reasons.push("structured");
  }

  if (/eshop|hotel|ubytování|realit|inzerce|casino|porn/i.test(title + host)) {
    score -= 0.5;
    reasons.push("spam");
  }
  if (/wikipedia|facebook|instagram/i.test(host)) {
    score -= 0.8;
    reasons.push("social");
  }

  return { score: Math.max(0, Math.min(1, score)), reasons };
}

export async function queueDiscoveredLink(
  url: string,
  opts?: { hintKind?: string; fromWatchedUrlId?: string | null; force?: boolean },
): Promise<boolean> {
  const canonical = canonicalExploreUrl(url);
  if (!canonical) return false;
  if (isAggregatorUrl(canonical)) return false;
  const host = hostnameOf(canonical);
  if (SKIP_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return false;
  if (!opts?.force && !looksLikeIndependentRaceUrl(canonical)) return false;
  const supabase = createServerSupabase();
  const { error } = await supabase.from("discovered_links").upsert(
    {
      url: canonical,
      status: "pending",
      hint_kind: opts?.hintKind || "explore",
      from_watched_url_id: opts?.fromWatchedUrlId ?? null,
    },
    { onConflict: "url", ignoreDuplicates: true },
  );
  return !error;
}

function pickRotated<T>(items: T[], take: number, salt: number): T[] {
  if (!items.length || take <= 0) return [];
  const start = ((salt % items.length) + items.length) % items.length;
  const out: T[] = [];
  for (let i = 0; i < Math.min(take, items.length); i++) {
    out.push(items[(start + i) % items.length]!);
  }
  return out;
}

/** Home markets every window; expanding (Italy) about every third. */
export function pickExplorePacks(salt: number, packs = COUNTRY_PACKS): CountryPack[] {
  const home = packs.filter((p) => explorerWeight(p.id) === "home");
  const expanding = packs.filter((p) => explorerWeight(p.id) === "expanding");
  const chosen = pickRotated(home, Math.min(2, home.length), salt);
  if (expanding.length && salt % 3 === 0) {
    chosen.push(...pickRotated(expanding, 1, salt));
  }
  return chosen;
}

function unwrapSearchHref(href: string): string | null {
  try {
    const u = new URL(href, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    if (uddg) return canonicalExploreUrl(uddg);
    const bingU = u.searchParams.get("u");
    if (bingU && /^https?:/i.test(bingU)) return canonicalExploreUrl(bingU);
    if (/duckduckgo\.com|bing\.com|google\./i.test(u.hostname)) return null;
    return canonicalExploreUrl(u.toString());
  } catch {
    return null;
  }
}

async function fetchSearchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": SEARCH_UA,
      Accept: "text/html",
      "Accept-Language": "en-US,en;q=0.9,de;q=0.8,it;q=0.7,pl;q=0.6,sk;q=0.6,cs;q=0.5",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return "";
  return res.text();
}

async function searchDuckDuckGo(query: string): Promise<string[]> {
  const html = await fetchSearchHtml(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
  );
  if (!html) return [];
  const $ = cheerio.load(html);
  const urls: string[] = [];
  $("a.result__a, a.result__url").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const next = unwrapSearchHref(href);
    if (next) urls.push(next);
  });
  return urls;
}

async function searchBing(query: string): Promise<string[]> {
  const html = await fetchSearchHtml(
    `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=cs`,
  );
  if (!html) return [];
  const $ = cheerio.load(html);
  const urls: string[] = [];
  $("li.b_algo h2 a, h2 a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const next = unwrapSearchHref(href);
    if (next) urls.push(next);
  });
  return urls;
}

async function searchWeb(query: string): Promise<string[]> {
  const ddg = await searchDuckDuckGo(query).catch(() => [] as string[]);
  if (ddg.length) return ddg;
  return searchBing(query).catch(() => []);
}

type CrtRow = { name_value?: string };

async function searchCrt(suffix: string): Promise<string[]> {
  const url = `https://crt.sh/?q=${encodeURIComponent(`%.${suffix}`)}&output=json`;
  const res = await fetch(url, {
    headers: { "User-Agent": SEARCH_UA, Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as CrtRow[];
  if (!Array.isArray(rows)) return [];
  const hosts = new Set<string>();
  for (const row of rows.slice(0, 400)) {
    const names = String(row.name_value || "")
      .split(/[\s,]+/)
      .map((n) => n.replace(/^\*\./, "").toLowerCase().trim())
      .filter(Boolean);
    for (const name of names) {
      if (name.endsWith(suffix) && !name.includes("*")) hosts.add(name);
    }
  }
  return [...hosts].slice(0, 40).map((h) => `https://${h}`);
}

async function knownHosts(supabase: ReturnType<typeof createServerSupabase>): Promise<Set<string>> {
  const hosts = new Set<string>();
  const [{ data: watched }, { data: discovered }] = await Promise.all([
    supabase.from("watched_urls").select("url").range(0, 1999),
    supabase.from("discovered_links").select("url").range(0, 1999),
  ]);
  for (const row of watched ?? []) hosts.add(hostnameOf(row.url));
  for (const row of discovered ?? []) hosts.add(hostnameOf(row.url));
  return hosts;
}

async function hostAlreadyInCatalog(host: string): Promise<boolean> {
  if (!/^[a-z0-9.-]+$/i.test(host)) return true;
  const supabase = createServerSupabase();
  const like = `%${host}%`;
  const [{ data: site }, { data: reg }] = await Promise.all([
    supabase.from("events").select("id").ilike("website_url", like).limit(1),
    supabase.from("events").select("id").ilike("registration_url", like).limit(1),
  ]);
  return Boolean(site?.length || reg?.length);
}

function titleFromHtml(html: string): string | undefined {
  const $ = cheerio.load(html);
  const t = (
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text() ||
    $("title").text()
  )
    .replace(/\s+/g, " ")
    .trim();
  return t.slice(0, 140) || undefined;
}

export async function runExplore(opts?: {
  budgetMs?: number;
  maxFetch?: number;
}): Promise<ExploreResult> {
  const budgetMs = opts?.budgetMs ?? 50_000;
  const maxFetch = opts?.maxFetch ?? 12;
  const deadline = Date.now() + budgetMs;
  const supabase = createServerSupabase();
  const salt = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
  const packs = pickExplorePacks(salt);
  const queries = packs.flatMap((p) => pickRotated(p.queries, 2, salt));
  const crtSuffix = pickRotated(
    packs.flatMap((p) => p.crt),
    1,
    salt,
  )[0];

  const found: string[] = [];
  for (const q of queries) {
    if (Date.now() > deadline - 8_000) break;
    const hits = await searchWeb(q);
    found.push(...hits);
  }
  if (crtSuffix && Date.now() < deadline - 10_000) {
    const crt = await searchCrt(crtSuffix).catch(() => [] as string[]);
    found.push(...crt);
  }

  const known = await knownHosts(supabase);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const raw of found) {
    const url = canonicalExploreUrl(raw);
    if (!url || seen.has(url)) continue;
    if (!looksLikeIndependentRaceUrl(url)) continue;
    const host = hostnameOf(url);
    if (known.has(host)) continue;
    seen.add(url);
    unique.push(url);
  }

  const toFetch: string[] = [];
  for (const url of unique) {
    if (toFetch.length >= maxFetch) break;
    const host = hostnameOf(url);
    if (await hostAlreadyInCatalog(host)) {
      known.add(host);
      continue;
    }
    toFetch.push(url);
  }
  let fetched = 0;
  let queued = 0;
  let autoWatched = 0;
  const samples: ExploreResult["samples"] = [];

  const scored = await mapPool(toFetch, 3, async (url) => {
    if (Date.now() > deadline) return null;
    try {
      const page = await fetchPage(url, { timeoutMs: 12_000, retries: 1 });
      fetched += 1;
      if (page.status >= 400 || page.html.length < 200) return null;
      const { score, reasons } = scoreRacePage(url, page.html);
      const title = titleFromHtml(page.html);
      return { url, score, reasons, title };
    } catch {
      return null;
    }
  });

  for (const hit of scored) {
    if (!hit) continue;
    samples.push({ url: hit.url, score: Number(hit.score.toFixed(2)), title: hit.title });
    if (hit.score < QUEUE_MIN) continue;
    const ok = await queueDiscoveredLink(hit.url, { hintKind: "explore" });
    if (!ok) continue;
    queued += 1;
    known.add(hostnameOf(hit.url));
    if (shouldAutoWatch(hit)) {
      const { error } = await supabase.from("watched_urls").upsert(
        {
          url: hit.url,
          kind: "race",
          status: "active",
          added_by: "explore",
          notes: `auto ${hit.score.toFixed(2)} ${hit.title ?? ""}`.trim(),
          next_poll_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "url", ignoreDuplicates: true },
      );
      if (!error) {
        autoWatched += 1;
        await supabase
          .from("discovered_links")
          .update({ status: "accepted" })
          .eq("url", hit.url);
      }
    }
  }

  samples.sort((a, b) => b.score - a.score);

  return {
    queries,
    candidates: unique.length,
    fetched,
    queued,
    autoWatched,
    skipped: unique.length - fetched,
    samples: samples.slice(0, 12),
  };
}
