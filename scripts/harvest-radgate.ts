/**
 * Reads radgate.de/radrennen/jahr/<year> across EU countries, enriches existing races
 * with schedule/categories/organizer/official links, and publishes missing confirmed races
 * without duplicates. Dry unless --apply.
 */
import { parseRadgateDetail, parseRadgateYearList, radgateParsedEvent, radgatePracticalDetails } from "../src/lib/catalog/radgate";
import { findCatalogueMatch, loadCatalogue, loadLocalEnv, publishAndEnrich, sha256 } from "./lib/harvest-helpers";

const HDR = { "user-agent": "Mozilla/5.0 (compatible; LetsRace race calendar)" };

async function main() {
  loadLocalEnv();
  const apply = process.argv.includes("--apply");
  const max = Number(process.argv.find(a => a.startsWith("--max="))?.slice(6) ?? 600);
  const concurrency = Math.max(1, Number(process.argv.find(a => a.startsWith("--concurrency="))?.slice("--concurrency=".length) ?? 8));

  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const { savePracticalDetails, saveFoundLinks } = await import("../src/lib/catalog/practical-enrichment");

  const today = new Date().toISOString().slice(0, 10);
  const currentYear = Number(today.slice(0, 4));
  const years = [currentYear, currentYear + 1];

  const allRows = [];
  for (const year of years) {
    const res = await fetch(`https://radgate.de/radrennen/jahr/${year}`, { headers: HDR, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!res?.ok) continue;
    const html = await res.text();
    for (const row of parseRadgateYearList(html, year)) {
      if (row.date >= today && row.confirmed) allRows.push(row);
    }
  }
  const rows = allRows.slice(0, max);
  const catalogue = await loadCatalogue(today);
  const stats = { listed: rows.length, read: 0, matched: 0, enriched: 0, missing: 0, published: 0, failed: 0 };

  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const row = rows[cursor++]!;
      const res = await fetch(row.url, { headers: HDR, signal: AbortSignal.timeout(12_000) }).catch(() => null);
      if (!res?.ok) continue;
      const html = await res.text();
      const detail = parseRadgateDetail(html, row.url);
      if (!detail || detail.startDate < today) continue;
      stats.read++;
      const pageText = pageAsText(html, row.url).text;
      const practical = radgatePracticalDetails(detail);

      const match = findCatalogueMatch(catalogue, {
        name: detail.name,
        startDate: detail.startDate,
        endDate: detail.endDate,
        place: detail.place,
        countryCode: detail.countryCode,
      });

      if (match) {
        stats.matched++;
        if (apply && match.visibility === "public" && !match.merged_into_id) {
          if (Object.keys(practical).length) {
            const saved = await savePracticalDetails(match.id, match.public_revision, practical).catch(() => ({ changed: [] })) as { changed?: string[] };
            if (saved.changed?.length) stats.enriched++;
          }
          if (detail.officialUrl) {
            const isRadNet = /rad-net\.de/i.test(detail.officialUrl);
            await saveFoundLinks(match, {
              ...(!isRadNet ? { website: detail.officialUrl } : {}),
              regulations: detail.officialUrl,
            }).catch(() => null);
          }
        }
        continue;
      }

      stats.missing++;
      if (!apply) {
        console.log(`[dry] + ${detail.startDate} ${detail.countryCode ?? "?"} ${detail.discipline} ${detail.name} | ${detail.place}`);
        continue;
      }
      const idx = pageText.indexOf(detail.name);
      const literalQuote = idx >= 0
        ? pageText.slice(idx, idx + 220).replace(/\s+/g, " ").trim()
        : pageText.slice(0, 220).replace(/\s+/g, " ").trim();
      const event = radgateParsedEvent(detail, literalQuote);
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
        registration_url: null,
        registration_closes_at: null,
        location: { municipality: detail.place, country_code: detail.countryCode },
      });
      const result = await publishAndEnrich(
        event,
        { sourceUrl: row.url, documentHash: sha256(html), textHash: sha256(pageText), reason: "Confirmed cycling race on radgate.de calendar.", country: detail.countryCode },
        practical,
        "official",
      );
      if (result.published) stats.published++;
      else {
        stats.failed++;
        console.log(`  Radgate fail ${detail.startDate} ${event.name.slice(0, 45)}: ${result.error}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, rows.length)) }, () => worker()));
  console.log(JSON.stringify(stats));
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1; });
