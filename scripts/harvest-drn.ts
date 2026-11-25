/**
 * Reads deutscherradsportnachwuchs.de (rad-net mirror with full Ausschreibungen),
 * enriches existing German races with schedule/fees/categories/venue/organizer,
 * and publishes missing confirmed races without duplicates. Dry unless --apply.
 */
import { isDrnRaceTitle, parseDrnDetail, parseDrnList, drnParsedEvent, drnPracticalDetails, radNetEventId } from "../src/lib/catalog/drn";
import { findCatalogueMatch, loadCatalogue, loadLocalEnv, publishAndEnrich, sha256 } from "./lib/harvest-helpers";

const HDR = { "user-agent": "Mozilla/5.0 (compatible; LetsRace race calendar)" };

async function main() {
  loadLocalEnv();
  const apply = process.argv.includes("--apply");
  const max = Number(process.argv.find(a => a.startsWith("--max="))?.slice(6) ?? 500);
  const concurrency = Math.max(1, Number(process.argv.find(a => a.startsWith("--concurrency="))?.slice("--concurrency=".length) ?? 8));

  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const { savePracticalDetails, saveFoundLinks } = await import("../src/lib/catalog/practical-enrichment");
  const { createServerSupabase } = await import("../src/lib/supabase/server");
  const db = createServerSupabase();

  const homeRes = await fetch("https://deutscherradsportnachwuchs.de/", { headers: HDR, signal: AbortSignal.timeout(15_000) });
  if (!homeRes.ok) throw Error(`DRN homepage HTTP ${homeRes.status}`);
  const homeHtml = await homeRes.text();
  const today = new Date().toISOString().slice(0, 10);
  const rows = parseDrnList(homeHtml).filter(r => r.date >= today && isDrnRaceTitle(r.title)).slice(0, max);

  const catalogue = await loadCatalogue(today);
  const stats = { listed: rows.length, read: 0, matched: 0, enriched: 0, missing: 0, published: 0, failed: 0 };

  let cursor = 0;
  async function worker() {
    while (cursor < rows.length) {
      const row = rows[cursor++]!;
      const res = await fetch(row.url, { headers: HDR, signal: AbortSignal.timeout(12_000) }).catch(() => null);
      if (!res?.ok) continue;
      const html = await res.text();
      const detail = parseDrnDetail(html, row.url);
      if (!detail) continue;
      stats.read++;
      const pageText = pageAsText(html, row.url).text;
      const practical = drnPracticalDetails(detail);
      const radId = radNetEventId(detail.radNetUrl ?? row.radNetUrl);

      const match = findCatalogueMatch(catalogue, {
        name: detail.title || row.title,
        startDate: detail.startDate,
        endDate: detail.endDate,
        place: detail.place,
        countryCode: "DE",
        radNetId: radId,
      });

      if (match) {
        stats.matched++;
        if (apply && match.visibility === "public" && !match.merged_into_id) {
          if (Object.keys(practical).length) {
            const saved = await savePracticalDetails(match.id, match.public_revision, practical).catch(() => ({ changed: [] })) as { changed?: string[] };
            if (saved.changed?.length) stats.enriched++;
          }
          await saveFoundLinks(match, {
            ...(detail.websiteUrl ? { website: detail.websiteUrl } : {}),
            regulations: row.url,
          }).catch(() => null);
          if (detail.registrationClosesAt && !match.registration_closes_at) {
            await db.from("events").update({ registration_closes_at: detail.registrationClosesAt }).eq("id", match.id);
          }
        }
        continue;
      }

      stats.missing++;
      if (!apply) {
        console.log(`[dry] + ${detail.startDate} ${row.discipline} ${detail.title || row.title} | ${detail.place}`);
        continue;
      }
      // Build a literal quote present in pageAsText(html, row.url).text (starting at "Tag" so start + end dates and Ort are all included)
      const tagIdx = pageText.indexOf("Tag");
      const literalQuote = tagIdx >= 0
        ? pageText.slice(tagIdx, tagIdx + 240).replace(/\s+/g, " ").trim()
        : pageText.slice(0, 220).replace(/\s+/g, " ").trim();
      const event = drnParsedEvent(row, detail, literalQuote);
      // Reserve in catalogue immediately to prevent duplicate publishes within the same run
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
        registration_closes_at: event.registrationClosesAt ?? null,
        location: { municipality: detail.place, country_code: "DE" },
      });
      const result = await publishAndEnrich(
        event,
        { sourceUrl: row.url, documentHash: sha256(html), textHash: sha256(pageText), reason: "Published German cycling race on deutscherradsportnachwuchs.de (rad-net mirror).", country: "DE" },
        practical,
        "official",
      );
      if (result.published) stats.published++;
      else {
        stats.failed++;
        console.log(`  DRN fail ${detail.startDate} ${event.name.slice(0, 45)}: ${result.error}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, rows.length)) }, () => worker()));
  console.log(JSON.stringify(stats));
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1; });
