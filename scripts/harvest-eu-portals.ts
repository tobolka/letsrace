/**
 * Reads Slovak, Polish, and Austrian cycling portals (cyklistikaszc.sk, casomierapt.com,
 * competit.pl/zawody-rowerowe/, liveds.datasport.pl, time2win.at), enriches existing races
 * with missing links/regulations, and publishes missing races without duplicates.
 * Dry unless --apply.
 */
import { SZC_CALENDARS, parseSzcCalendar, szcParsedEvent } from "../src/lib/catalog/szc";
import { parseCompetitCycling, parseDatasportPlCycling, polishPortalParsedEvent } from "../src/lib/catalog/competit-datasport";
import { enrichTime2WinFromDetail, parseCasomieraPtCycling, parseTime2WinEvents, time2WinParsedEvent, type TribeApiEvent } from "../src/lib/catalog/time2win-casomierapt";
import { findCatalogueMatch, loadCatalogue, loadLocalEnv, publishAndEnrich, sha256 } from "./lib/harvest-helpers";

const HDR = { "user-agent": "Mozilla/5.0 (compatible; LetsRace race calendar)" };

async function main() {
  loadLocalEnv();
  const apply = process.argv.includes("--apply");
  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const { saveFoundLinks } = await import("../src/lib/catalog/practical-enrichment");

  const today = new Date().toISOString().slice(0, 10);
  const catalogue = await loadCatalogue(today);

  type Stat = { listed: number; matched: number; enriched: number; missing: number; published: number; failed: number };
  const mkStat = (): Stat => ({ listed: 0, matched: 0, enriched: 0, missing: 0, published: 0, failed: 0 });
  const summary: Record<string, Stat> = {
    szc: mkStat(),
    casomierapt: mkStat(),
    competit: mkStat(),
    datasportPl: mkStat(),
    time2win: mkStat(),
  };

  async function processCandidate(
    key: keyof typeof summary,
    event: import("../src/lib/domain").ParsedEvent,
    evidence: { sourceUrl: string; documentHash: string; textHash: string; reason: string; country?: string | null },
  ) {
    const stat = summary[key]!;
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

  // 1. Slovak Cycling Federation (cyklistikaszc.sk) — all 7 discipline calendars
  for (const cal of SZC_CALENDARS) {
    const res = await fetch(cal.url, { headers: HDR, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!res?.ok) continue;
    const html = await res.text();
    const pageText = pageAsText(html, cal.url).text;
    const docHash = sha256(html), textHash = sha256(pageText);
    for (const row of parseSzcCalendar(html, cal.url, cal.discipline)) {
      if (row.startDate < today) continue;
      const idx = pageText.indexOf(row.title);
      const quote = idx >= 0 ? pageText.slice(Math.max(0, idx - 30), idx + 200).replace(/\s+/g, " ").trim() : row.rawQuote;
      const ev = szcParsedEvent({ ...row, rawQuote: quote });
      await processCandidate("szc", ev, { sourceUrl: cal.url, documentHash: docHash, textHash, reason: "Official Slovak Cycling Federation (SZC) calendar.", country: "SK" });
    }
  }

  // 2. CasomieraPT (Slovakia) — Tribe Events REST API
  const cptRes = await fetch(`https://casomierapt.com/wp-json/tribe/events/v1/events?per_page=50&start_date=${today}`, { headers: HDR, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (cptRes?.ok) {
    const body = (await cptRes.json().catch(() => null)) as { events?: TribeApiEvent[] } | null;
    for (const ev of parseCasomieraPtCycling(body?.events ?? [])) {
      const detRes = await fetch(ev.sourceUrl, { headers: HDR, signal: AbortSignal.timeout(12_000) }).catch(() => null);
      if (!detRes?.ok) continue;
      const html = await detRes.text();
      const pageText = pageAsText(html, ev.sourceUrl).text;
      const idx = pageText.indexOf(ev.name);
      const quote = idx >= 0 ? pageText.slice(idx, idx + 220).replace(/\s+/g, " ").trim() : pageText.slice(0, 220).replace(/\s+/g, " ").trim();
      ev.evidence = { ...ev.evidence!, quote };
      await processCandidate("casomierapt", ev, { sourceUrl: ev.sourceUrl, documentHash: sha256(html), textHash: sha256(pageText), reason: "Slovak cycling race on casomierapt.com.", country: "SK" });
    }
  }

  // 3. Competit.pl (Poland) — /zawody-rowerowe/
  const compUrl = "https://competit.pl/zawody-rowerowe/";
  const compRes = await fetch(compUrl, { headers: HDR, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (compRes?.ok) {
    const html = await compRes.text();
    const pageText = pageAsText(html, compUrl).text;
    const docHash = sha256(html), textHash = sha256(pageText);
    for (const row of parseCompetitCycling(html, compUrl)) {
      if (row.startDate < today) continue;
      const idx = pageText.indexOf(row.title);
      const quote = idx >= 0 ? pageText.slice(idx, idx + 240).replace(/\s+/g, " ").trim() : row.rawQuote;
      const ev = polishPortalParsedEvent({ ...row, rawQuote: quote }, "competit_pl");
      await processCandidate("competit", ev, { sourceUrl: compUrl, documentHash: docHash, textHash, reason: "Polish cycling race on competit.pl/zawody-rowerowe/.", country: "PL" });
    }
  }

  // 4. Datasport.pl (Poland) — liveds.datasport.pl/lista.html (ISO-8859-2)
  const dsUrl = "https://liveds.datasport.pl/lista.html";
  const dsRes = await fetch(dsUrl, { headers: HDR, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (dsRes?.ok) {
    const buf = await dsRes.arrayBuffer();
    const html = new TextDecoder("iso-8859-2").decode(buf);
    const pageText = pageAsText(html, dsUrl).text;
    const docHash = sha256(html), textHash = sha256(pageText);
    for (const row of parseDatasportPlCycling(html, dsUrl)) {
      if (row.startDate < today) continue;
      const idx = pageText.indexOf(row.title);
      const quote = idx >= 0 ? pageText.slice(idx, idx + 220).replace(/\s+/g, " ").trim() : row.rawQuote;
      const ev = polishPortalParsedEvent({ ...row, rawQuote: quote }, "datasport_pl");
      await processCandidate("datasportPl", ev, { sourceUrl: dsUrl, documentHash: docHash, textHash, reason: "Polish cycling race on online.datasport.pl.", country: "PL" });
    }
  }

  // 5. Time2Win (Austria) — /events + /event/<id>
  const t2wRes = await fetch("https://www.time2win.at/events", { headers: HDR, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (t2wRes?.ok) {
    const listHtml = await t2wRes.text();
    for (const rawEv of parseTime2WinEvents(listHtml)) {
      if (rawEv.startDate < today) continue;
      const detRes = await fetch(rawEv.detailUrl, { headers: HDR, signal: AbortSignal.timeout(12_000) }).catch(() => null);
      if (!detRes?.ok) continue;
      const html = await detRes.text();
      const enriched = enrichTime2WinFromDetail(rawEv, html);
      const pageText = pageAsText(html, enriched.detailUrl).text;
      const idx = pageText.indexOf(enriched.place);
      const quote = idx >= 0 ? pageText.slice(Math.max(0, idx - 80), idx + 180).replace(/\s+/g, " ").trim() : pageText.slice(0, 220).replace(/\s+/g, " ").trim();
      const ev = time2WinParsedEvent(enriched, quote);
      await processCandidate("time2win", ev, { sourceUrl: enriched.detailUrl, documentHash: sha256(html), textHash: sha256(pageText), reason: "Cycling race on time2win.at.", country: enriched.countryCode });
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => { console.error(err instanceof Error ? err.message : err); process.exitCode = 1; });
