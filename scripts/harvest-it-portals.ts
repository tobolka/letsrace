/**
 * Reads Italian cycling portals (mtbonline.it/Eventi and winningtime.it -> iscrizioni.winningtime.it/eventi),
 * enriches existing races with missing links/regulations, and publishes missing races without duplicates.
 * Dry unless --apply.
 */
import {
  enrichMtbOnlineFromDetail,
  mtbOnlineParsedEvent,
  parseMtbOnlineEvents,
  parseWinningTimeCircuitStages,
  parseWinningTimeDetail,
  parseWinningTimeList,
} from "../src/lib/catalog/it-portals";
import { findCatalogueMatch, foldText, loadCatalogue, loadLocalEnv, publishAndEnrich, sha256 } from "./lib/harvest-helpers";

const HDR = { "user-agent": "Mozilla/5.0 (compatible; LetsRace race calendar)" };

function looksBlocked(status: number, html: string): boolean {
  if (status === 403 || status === 429) return true;
  return /cf-turnstile|g-recaptcha|hcaptcha|verify you are human|just a moment\.\.\./i.test(html.slice(0, 4000));
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
  const summary: Record<"mtbonline" | "winningtime", Stat> = {
    mtbonline: mkStat(),
    winningtime: mkStat(),
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

  // 1. MTBonline.it — Italian MTB / CX / Gravel calendar
  const mtbUrl = "https://www.mtbonline.it/Eventi";
  const mtbRes = await fetch(mtbUrl, { headers: HDR, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (mtbRes) {
    const html = await mtbRes.text();
    if (looksBlocked(mtbRes.status, html)) {
      console.warn(`[mtbonline] skipped: HTTP ${mtbRes.status} / bot check`);
    } else if (mtbRes.ok) {
      const pageText = pageAsText(html, mtbUrl).text;
      const docHash = sha256(html), textHash = sha256(pageText);
      for (const row of parseMtbOnlineEvents(html, mtbUrl)) {
        if (row.startDate < today) continue;
        let ev = mtbOnlineParsedEvent(row, mtbUrl);
        let evDocHash = docHash;
        let evTextHash = textHash;
        let evSource = mtbUrl;
        if (row.detailUrl) {
          const detRes = await fetch(row.detailUrl, { headers: HDR, signal: AbortSignal.timeout(12_000) }).catch(() => null);
          if (detRes?.ok) {
            const detHtml = await detRes.text();
            if (!looksBlocked(detRes.status, detHtml)) {
              ev = enrichMtbOnlineFromDetail(row, detHtml, row.detailUrl);
              evDocHash = sha256(detHtml);
              evTextHash = sha256(pageAsText(detHtml, row.detailUrl).text);
              evSource = row.detailUrl;
            }
          }
        }
        await processCandidate("mtbonline", ev, {
          sourceUrl: evSource,
          documentHash: evDocHash,
          textHash: evTextHash,
          reason: "Italian cycling race on mtbonline.it/Eventi.",
          country: "IT",
        });
      }
    }
  }

  // 2. WinningTime — www.winningtime.it/web/main.php redirects to iscrizioni.winningtime.it
  const wtEntryRes = await fetch("https://www.winningtime.it/web/main.php", { headers: HDR, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  const wtBase = wtEntryRes?.url ? new URL(wtEntryRes.url).origin : "https://iscrizioni.winningtime.it";
  const wtListUrl = `${wtBase}/eventi`;
  const wtListRes = await fetch(wtListUrl, { headers: HDR, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (wtListRes) {
    const listHtml = await wtListRes.text();
    if (looksBlocked(wtListRes.status, listHtml)) {
      console.warn(`[winningtime] skipped: HTTP ${wtListRes.status} / bot check`);
    } else if (wtListRes.ok) {
      const cards = parseWinningTimeList(listHtml, wtListUrl);
      const wtSeen = new Set<string>();
      const seenKey = (date: string, name: string) => `${date}:${foldText(name).replace(/[^a-z0-9]+/g, "")}`;

      // Process standalone events before circuits so single pages take precedence over circuit stage summaries.
      for (const card of cards.filter(c => !c.isCircuit)) {
        if (card.startDate < today) continue;
        const detRes = await fetch(card.detailUrl, { headers: HDR, signal: AbortSignal.timeout(12_000) }).catch(() => null);
        if (!detRes?.ok) continue;
        const detHtml = await detRes.text();
        if (looksBlocked(detRes.status, detHtml)) continue;
        const ev = parseWinningTimeDetail(detHtml, card.detailUrl, card);
        if (!ev || ev.startDate < today) continue;
        wtSeen.add(seenKey(ev.startDate, ev.name));
        const detText = pageAsText(detHtml, card.detailUrl).text;
        await processCandidate("winningtime", ev, {
          sourceUrl: card.detailUrl,
          documentHash: sha256(detHtml),
          textHash: sha256(detText),
          reason: "Italian cycling race on winningtime.it.",
          country: "IT",
        });
      }

      for (const card of cards.filter(c => c.isCircuit)) {
        const iscrUrl = `${card.detailUrl.replace(/\/+$/, "")}/iscrizioni`;
        const iscrRes = await fetch(iscrUrl, { headers: HDR, signal: AbortSignal.timeout(12_000) }).catch(() => null);
        if (!iscrRes?.ok) continue;
        const iscrHtml = await iscrRes.text();
        if (looksBlocked(iscrRes.status, iscrHtml)) continue;
        const iscrText = pageAsText(iscrHtml, iscrUrl).text;
        const docHash = sha256(iscrHtml), textHash = sha256(iscrText);
        for (const stage of parseWinningTimeCircuitStages(iscrHtml, iscrUrl, card.sports)) {
          if (stage.startDate < today) continue;
          const k = seenKey(stage.startDate, stage.name);
          if (wtSeen.has(k)) continue;
          wtSeen.add(k);
          await processCandidate("winningtime", stage, {
            sourceUrl: iscrUrl,
            documentHash: docHash,
            textHash,
            reason: "Italian cycling circuit stage on winningtime.it.",
            country: "IT",
          });
        }
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1; });
