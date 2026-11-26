/**
 * Reads Swiss & Alpine cycling timing portals (trackmaxx.ch, datasport.com),
 * enriches existing races with missing links, and publishes missing races
 * without duplicates. Dry unless --apply.
 */
import {
  datasportParsedEvent,
  dedupeDatasportEditions,
  isDatasportCycling,
  parseTrackMaxxCycling,
  type DatasportEdition,
} from "../src/lib/catalog/ch-portals";
import { findCatalogueMatch, loadCatalogue, loadLocalEnv, publishAndEnrich, sha256 } from "./lib/harvest-helpers";

const HDR = { "user-agent": "Mozilla/5.0 (compatible; LetsRace race calendar)" };
const DATASPORT_API = "https://admin-api.datasport.com/admin/api/website/editions";

async function fetchAllDatasportUpcoming(): Promise<DatasportEdition[]> {
  const all: DatasportEdition[] = [];
  const size = 200;
  for (let page = 0; page < 10; page++) {
    const url = `${DATASPORT_API}?page=${page}&size=${size}&timeframe=UPCOMING&includeExternalSeriesEvents=true`;
    const res = await fetch(url, { headers: { ...HDR, accept: "application/json" }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!res?.ok) break;
    const body = (await res.json().catch(() => null)) as { pageElements?: DatasportEdition[]; totalElements?: number } | null;
    const items = body?.pageElements ?? [];
    all.push(...items);
    if (items.length === 0 || all.length >= (body?.totalElements ?? items.length)) break;
  }
  return all;
}

async function main() {
  loadLocalEnv();
  const apply = process.argv.includes("--apply");
  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const { saveFoundLinks } = await import("../src/lib/catalog/practical-enrichment");

  const today = new Date().toISOString().slice(0, 10);
  const catalogue = await loadCatalogue(today);

  type Stat = { listed: number; matched: number; enriched: number; missing: number; published: number; failed: number };
  const mkStat = (): Stat => ({ listed: 0, matched: 0, enriched: 0, missing: 0, published: 0, failed: 0 });
  const summary: Record<"trackmaxx" | "datasport", Stat> = {
    trackmaxx: mkStat(),
    datasport: mkStat(),
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

  // 1. TrackMaxx.ch (Switzerland)
  const tmUrl = "https://trackmaxx.ch/";
  const tmRes = await fetch(tmUrl, { headers: HDR, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (tmRes?.ok) {
    const html = await tmRes.text();
    const pageText = pageAsText(html, tmUrl).text;
    const docHash = sha256(html);
    const textHash = sha256(pageText);
    for (const ev of parseTrackMaxxCycling(html, tmUrl)) {
      if (ev.startDate < today) continue;
      await processCandidate("trackmaxx", ev, {
        sourceUrl: tmUrl,
        documentHash: docHash,
        textHash,
        reason: "Swiss cycling race on trackmaxx.ch.",
        country: ev.countryHint,
      });
    }
  }

  // 2. Datasport.com (CH / AT / DE / IT)
  const editions = dedupeDatasportEditions(await fetchAllDatasportUpcoming());
  for (const ed of editions) {
    if (!isDatasportCycling(ed) || !ed.editionFrom || ed.editionFrom.slice(0, 10) < today) continue;
    const slug = ed.slug!.trim();
    const detJson = await fetch(`${DATASPORT_API}/by-slug/${encodeURIComponent(slug)}`, {
      headers: { ...HDR, accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    })
      .then(r => (r.ok ? (r.json() as Promise<Partial<DatasportEdition>>) : null))
      .catch(() => null);

    const ev = datasportParsedEvent(ed, detJson);
    if (!ev || ev.startDate < today) continue;

    const detHtmlRes = await fetch(ev.sourceUrl, { headers: HDR, signal: AbortSignal.timeout(12_000) }).catch(() => null);
    const detHtml = detHtmlRes?.ok ? await detHtmlRes.text() : JSON.stringify(detJson ?? ed);
    const detText = detHtmlRes?.ok ? pageAsText(detHtml, ev.sourceUrl).text : detHtml;

    await processCandidate("datasport", ev, {
      sourceUrl: ev.sourceUrl,
      documentHash: sha256(detHtml),
      textHash: sha256(detText),
      reason: "Cycling race on datasport.com.",
      country: ev.countryHint,
    });
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
