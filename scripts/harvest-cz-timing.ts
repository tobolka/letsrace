/**
 * Reads Czech cycling and timing portals (cykloman.cz, irontime.cz, sportovniservis.cz),
 * enriches existing races with missing links/regulations, and publishes missing cycling
 * races without duplicates. Dry unless --apply.
 */
import {
  cyklomanParsedEvent,
  irontimeParsedEvent,
  parseCyklomanDetail,
  parseCyklomanList,
  parseIrontimeRaces,
  parseSportovniServisPosts,
  sportovniServisParsedEvent,
  type IrontimeApiRace,
  type SportovniServisWpPost,
} from "../src/lib/catalog/cz-timing-portals";
import { findCatalogueMatch, loadCatalogue, loadLocalEnv, publishAndEnrich, sha256 } from "./lib/harvest-helpers";

const HDR = { "user-agent": "Mozilla/5.0 (compatible; LetsRace race calendar)" };

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: HDR, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (!res?.ok) return null;
  return (await res.json().catch(() => null)) as T | null;
}

async function main() {
  loadLocalEnv();
  const apply = process.argv.includes("--apply");
  const today = new Date().toISOString().slice(0, 10);
  const sinceArg = process.argv.find(a => a.startsWith("--since="))?.slice("--since=".length);
  const since = sinceArg && /^\d{4}-\d{2}-\d{2}$/.test(sinceArg) ? sinceArg : today;
  if (apply && since < today) throw new Error("--apply only runs for dates >= today");

  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const { saveFoundLinks } = await import("../src/lib/catalog/practical-enrichment");
  const catalogue = await loadCatalogue(since);

  type Stat = { parsed: number; listed: number; matched: number; enriched: number; missing: number; published: number; failed: number };
  const mkStat = (): Stat => ({ parsed: 0, listed: 0, matched: 0, enriched: 0, missing: 0, published: 0, failed: 0 });
  const summary: Record<"cykloman" | "irontime" | "sportovniservis", Stat> = {
    cykloman: mkStat(),
    irontime: mkStat(),
    sportovniservis: mkStat(),
  };

  async function processCandidate(
    key: keyof typeof summary,
    event: import("../src/lib/domain").ParsedEvent,
    evidence: { sourceUrl: string; documentHash: string; textHash: string; reason: string; country?: string | null },
  ) {
    const stat = summary[key];
    stat.listed++;
    const match = findCatalogueMatch(catalogue, {
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      place: event.placeText,
      countryCode: event.countryHint,
    });
    if (match) {
      stat.matched++;
      if (apply && match.visibility === "public" && !match.merged_into_id) {
        const added = await saveFoundLinks(match, {
          ...(event.websiteUrl ? { website: event.websiteUrl } : {}),
          ...(event.registrationUrl ? { registration: event.registrationUrl } : {}),
          ...(event.regulationsUrl ? { regulations: event.regulationsUrl } : {}),
          ...(event.resultsUrl ? { results: event.resultsUrl } : {}),
        }).catch(() => 0);
        if (added > 0) stat.enriched++;
      }
      return;
    }
    stat.missing++;
    if (!apply) {
      console.log(`[dry:${key}] + ${event.startDate} ${event.countryHint ?? "?"} ${event.discipline?.[0]} ${event.name} | ${event.placeText}`);
      return;
    }
    catalogue.push({
      id: `pending:${event.externalId}`,
      name: event.name,
      start_date: event.startDate,
      end_date: event.endDate ?? null,
      visibility: "public",
      merged_into_id: null,
      public_revision: "",
      website_url: event.websiteUrl ?? null,
      regulations_url: event.regulationsUrl ?? null,
      registration_url: event.registrationUrl ?? null,
      registration_closes_at: null,
      location: { municipality: event.placeText, country_code: event.countryHint ?? null },
    });
    const res = await publishAndEnrich(event, evidence, {}, "official");
    if (res.published) stat.published++;
    else {
      stat.failed++;
      console.log(`  [${key}] fail ${event.startDate} ${event.name.slice(0, 45)}: ${res.error}`);
    }
  }

  // 1. Cykloman.cz — active list + next year calendar
  const currentYear = Number(today.slice(0, 4));
  const cyklomanUrls = [
    "https://www.cykloman.cz/zavody-a-akce/seznam",
    `https://www.cykloman.cz/zavody-a-akce/${currentYear + 1}`,
  ];
  const seenCykloman = new Set<string>();
  for (const listUrl of cyklomanUrls) {
    const res = await fetch(listUrl, { headers: HDR, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!res?.ok) continue;
    const html = await res.text();
    const listText = pageAsText(html, listUrl).text;
    for (const row of parseCyklomanList(html, listUrl)) {
      if (seenCykloman.has(row.id)) continue;
      seenCykloman.add(row.id);
      summary.cykloman.parsed++;
      if (row.startDate < since) continue;

      const detRes = await fetch(row.url, { headers: HDR, signal: AbortSignal.timeout(12_000) }).catch(() => null);
      const detHtml = detRes?.ok ? await detRes.text() : null;
      const detail = detHtml ? parseCyklomanDetail(detHtml, row.url) : null;
      const ev = cyklomanParsedEvent(row, detail);
      if (ev.startDate < since) continue;

      const docSrc = detHtml ?? html;
      const docText = detHtml ? pageAsText(detHtml, row.url).text : listText;
      await processCandidate("cykloman", ev, {
        sourceUrl: ev.sourceUrl,
        documentHash: sha256(docSrc),
        textHash: sha256(docText),
        reason: "Czech cycling race on cykloman.cz.",
        country: "CZ",
      });
    }
  }

  // 2. Irontime.cz — public JSON API (/a/api/v1/races)
  const itRaces: IrontimeApiRace[] = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const url = `https://irontime.cz/a/api/v1/races?type=upcoming&include_live=1&limit=100&offset=${offset}`;
    const body = await fetchJson<{ data?: IrontimeApiRace[]; has_more?: boolean }>(url);
    const batch = body?.data ?? [];
    itRaces.push(...batch);
    if (!body?.has_more || batch.length < 100) break;
  }
  if (since < today) {
    for (let offset = 0; offset < 300; offset += 100) {
      const url = `https://irontime.cz/a/api/v1/races?type=past&limit=100&offset=${offset}`;
      const body = await fetchJson<{ data?: IrontimeApiRace[]; has_more?: boolean }>(url);
      const batch = body?.data ?? [];
      itRaces.push(...batch);
      if (!body?.has_more || batch.length < 100) break;
    }
  }
  const itRaw = JSON.stringify(itRaces);
  for (const row of parseIrontimeRaces(itRaces)) {
    summary.irontime.parsed++;
    if (row.startDate < since) continue;
    const ev = irontimeParsedEvent(row);
    await processCandidate("irontime", ev, {
      sourceUrl: ev.sourceUrl,
      documentHash: sha256(itRaw),
      textHash: sha256(ev.evidence?.quote ?? ev.name),
      reason: "Cycling race on irontime.cz.",
      country: ev.countryHint,
    });
  }

  // 3. Sportovniservis.cz — WordPress REST API (tags: Cycling=9, mtb=188, BMX=233; categories: Cyklistika=69, Připravujeme=73)
  const ssPosts = new Map<number, SportovniServisWpPost>();
  for (const ep of [
    "https://www.sportovniservis.cz/wp-json/wp/v2/posts?per_page=100&tags=9,188,233&orderby=date&order=desc",
    "https://www.sportovniservis.cz/wp-json/wp/v2/posts?per_page=50&categories=69,73&orderby=date&order=desc",
  ]) {
    const arr = await fetchJson<SportovniServisWpPost[]>(ep);
    for (const p of arr ?? []) ssPosts.set(p.id, p);
  }
  const ssRaw = JSON.stringify([...ssPosts.values()]);
  for (const row of parseSportovniServisPosts([...ssPosts.values()])) {
    summary.sportovniservis.parsed++;
    if (row.startDate < since) continue;
    const ev = sportovniServisParsedEvent(row);
    await processCandidate("sportovniservis", ev, {
      sourceUrl: ev.sourceUrl,
      documentHash: sha256(ssRaw),
      textHash: sha256(ev.evidence?.quote ?? ev.name),
      reason: "Cycling race on sportovniservis.cz.",
      country: ev.countryHint,
    });
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1; });
