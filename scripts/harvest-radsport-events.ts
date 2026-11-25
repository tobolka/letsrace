/**
 * Reads api.radsport-events.de/api/v1/events, filters to genuine cycling races,
 * enriches existing races with routes/schedule/organizer/links, and publishes
 * missing races without duplicates. Dry unless --apply.
 */
import { isRadsportEventsRace, radsportEventsParsedEvent, radsportEventsPracticalDetails, type RadsportEventApiItem } from "../src/lib/catalog/radsport-events";
import { findCatalogueMatch, loadCatalogue, loadLocalEnv, publishAndEnrich, sha256 } from "./lib/harvest-helpers";

async function main() {
  loadLocalEnv();
  const apply = process.argv.includes("--apply");
  const max = Number(process.argv.find(a => a.startsWith("--max="))?.slice(6) ?? 1000);
  const concurrency = Math.max(1, Number(process.argv.find(a => a.startsWith("--concurrency="))?.slice("--concurrency=".length) ?? 8));

  const { savePracticalDetails, saveFoundLinks } = await import("../src/lib/catalog/practical-enrichment");

  const today = new Date().toISOString().slice(0, 10);
  const items: RadsportEventApiItem[] = [];
  for (let page = 0; page < 25; page++) {
    const res = await fetch(`https://api.radsport-events.de/api/v1/events?page=${page}&size=100`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw Error(`radsport-events API page ${page} HTTP ${res.status}`);
    const body = (await res.json()) as { content?: RadsportEventApiItem[]; totalPages?: number };
    for (const item of body.content ?? []) {
      if (isRadsportEventsRace(item) && item.eventDate.slice(0, 10) >= today) items.push(item);
    }
    if (page + 1 >= (body.totalPages ?? 1)) break;
  }

  const todo = items.slice(0, max);
  const catalogue = await loadCatalogue(today);
  const stats = { listed: todo.length, matched: 0, enriched: 0, missing: 0, published: 0, failed: 0 };

  let cursor = 0;
  async function worker() {
    while (cursor < todo.length) {
      const item = todo[cursor++]!;
      const event = radsportEventsParsedEvent(item);
      if (!event) continue;
      const practical = radsportEventsPracticalDetails(item);

      const match = findCatalogueMatch(catalogue, {
        name: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        place: event.placeText,
        countryCode: event.countryHint,
      });

      if (match) {
        stats.matched++;
        if (apply && match.visibility === "public" && !match.merged_into_id) {
          if (Object.keys(practical).length) {
            const saved = await savePracticalDetails(match.id, match.public_revision, practical).catch(() => ({ changed: [] })) as { changed?: string[] };
            if (saved.changed?.length) stats.enriched++;
          }
          await saveFoundLinks(match, {
            ...(event.websiteUrl ? { website: event.websiteUrl } : {}),
            ...(event.registrationUrl ? { registration: event.registrationUrl } : {}),
            ...(event.regulationsUrl ? { regulations: event.regulationsUrl } : {}),
          }).catch(() => null);
        }
        continue;
      }

      stats.missing++;
      if (!apply) {
        console.log(`[dry] + ${event.startDate} ${event.countryHint ?? "?"} ${event.discipline?.[0]} ${event.name} | ${event.placeText}`);
        continue;
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
      const serialized = JSON.stringify(item);
      const result = await publishAndEnrich(
        event,
        { sourceUrl: event.sourceUrl, documentHash: sha256(serialized), textHash: sha256(serialized), reason: "Published cycling race on radsport-events.de.", country: event.countryHint },
        practical,
        "official",
      );
      if (result.published) stats.published++;
      else {
        stats.failed++;
        console.log(`  RadsportEvents fail ${event.startDate} ${event.name.slice(0, 45)}: ${result.error}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, todo.length)) }, () => worker()));
  console.log(JSON.stringify(stats));
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1; });
