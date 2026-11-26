/**
 * Reads German (dsergebnis.de) and Polish (b4sportonline.pl) cycling portals,
 * enriches existing races with missing links, and publishes missing cycling races
 * without duplicates. Dry unless --apply.
 */
import {
  b4SportParsedEvent,
  b4SportSearchDateUrl,
  b4SportWindowUrl,
  dsergebnisParsedEvent,
  extractDsergebnisSubpageInfo,
  extractDsergebnisSubpages,
  inferB4SportDiscipline,
  inspectB4SportDetail,
  parseB4SportSearchCards,
  parseDsergebnisCalendar,
} from "../src/lib/catalog/de-pl-portals";
import { findCatalogueMatch, loadCatalogue, loadLocalEnv, publishAndEnrich, sha256 } from "./lib/harvest-helpers";

const HDR = { "user-agent": "Mozilla/5.0 (compatible; LetsRace race calendar)" };

function hasBotGate(status: number, html: string): boolean {
  if (status === 403 || status === 429) return true;
  return /cf-challenge|challenge-platform|g-recaptcha|hcaptcha|turnstile|just a moment/i.test(html);
}

async function main() {
  loadLocalEnv();
  const apply = process.argv.includes("--apply");
  const { pageAsText } = await import("../src/lib/watcher/extractors/llm-calendar");
  const { saveFoundLinks } = await import("../src/lib/catalog/practical-enrichment");

  const today = new Date().toISOString().slice(0, 10);
  const nextYearEnd = `${Number(today.slice(0, 4)) + 1}-12-31`;
  const catalogue = await loadCatalogue(today);

  type Stat = { listed: number; matched: number; enriched: number; missing: number; published: number; failed: number };
  const mkStat = (): Stat => ({ listed: 0, matched: 0, enriched: 0, missing: 0, published: 0, failed: 0 });
  const summary: Record<"dsergebnis" | "b4sport", Stat> = {
    dsergebnis: mkStat(),
    b4sport: mkStat(),
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

  // 1. DS Ergebnisdienst (Germany) — https://www.dsergebnis.de/
  const dsUrl = "https://www.dsergebnis.de/";
  const dsRes = await fetch(dsUrl, { headers: HDR, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (dsRes?.ok) {
    const dsHtml = await dsRes.text();
    if (!hasBotGate(dsRes.status, dsHtml)) {
      const dsText = pageAsText(dsHtml, dsUrl).text;
      const docHash = sha256(dsHtml);
      const textHash = sha256(dsText);

      // Fetch active non-archive subpages once to enrich website/regulations/registration/place.
      const subpageUrls = extractDsergebnisSubpages(dsHtml, dsUrl).slice(0, 15);
      const subInfos = (
        await Promise.all(
          subpageUrls.map(async (u) => {
            const r = await fetch(u, { headers: HDR, signal: AbortSignal.timeout(10_000) }).catch(() => null);
            if (!r?.ok) return null;
            return { url: u, info: extractDsergebnisSubpageInfo(await r.text(), u) };
          }),
        )
      ).filter((x): x is NonNullable<typeof x> => x !== null);

      for (const row of parseDsergebnisCalendar(dsHtml, dsUrl)) {
        if (row.startDate < today) continue;
        const matchedSub = subInfos.find(
          (s) =>
            s.info.dates.includes(row.startDate) ||
            (row.endDate ? s.info.dates.includes(row.endDate) : false) ||
            s.url.includes(row.startDate.slice(0, 4)) &&
              row.title
                .toLowerCase()
                .split(/\s+/)
                .some((w) => w.length >= 5 && s.url.toLowerCase().includes(w)),
        );
        const enrichedRow = matchedSub
          ? {
              ...row,
              place: row.place === row.title && matchedSub.info.place ? matchedSub.info.place : row.place,
              websiteUrl: matchedSub.info.websiteUrl ?? row.websiteUrl,
              regulationsUrl: matchedSub.info.regulationsUrl ?? row.regulationsUrl,
              registrationUrl: matchedSub.info.registrationUrl ?? row.registrationUrl,
              resultsUrl: matchedSub.info.resultsUrl ?? row.resultsUrl,
            }
          : row;

        const ev = dsergebnisParsedEvent(enrichedRow);
        await processCandidate("dsergebnis", ev, {
          sourceUrl: dsUrl,
          documentHash: docHash,
          textHash,
          reason: "German cycling race on dsergebnis.de.",
          country: "DE",
        });
      }
    } else {
      console.log("[dsergebnis] skipped: bot check detected");
    }
  }

  // 2. B4SportOnline (Poland) — https://b4sportonline.pl/kalendarz/searching/od/.../do/...
  const b4StartUrl = b4SportWindowUrl(today, nextYearEnd);
  const b4Res0 = await fetch(b4StartUrl, { headers: HDR, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  if (b4Res0?.ok) {
    const h0 = await b4Res0.text();
    if (!hasBotGate(b4Res0.status, h0)) {
      const cookies = b4Res0.headers.getSetCookie?.().map((c) => c.split(";")[0]).join("; ") ?? "";
      const { load } = await import("cheerio");
      const $0 = load(h0);
      let combinedHtml = $0(".search-results-container").html() ?? h0;
      let nextUrl = $0("#getNext").attr("data-url") ?? "";

      for (let page = 1; page < 30 && nextUrl; page++) {
        const res = await fetch(`https://b4sportonline.pl${nextUrl}`, {
          method: "POST",
          headers: {
            ...HDR,
            "x-requested-with": "XMLHttpRequest",
            referer: b4StartUrl,
            ...(cookies ? { cookie: cookies } : {}),
          },
          signal: AbortSignal.timeout(12_000),
        }).catch(() => null);
        if (!res?.ok) break;
        const json = (await res.json().catch(() => null)) as { events?: string; nextUrl?: string } | null;
        if (!json?.events) break;
        const $p = load(json.events);
        if ($p(".single-search-result-container").length === 0) break;
        combinedHtml += json.events;
        if (!json.nextUrl || json.nextUrl === nextUrl) break;
        nextUrl = json.nextUrl;
      }

      const cards = parseB4SportSearchCards(combinedHtml).filter(
        (c) => c.startDate >= today && !c.isClearlyNonCycling,
      );
      const detailCache = new Map<string, ReturnType<typeof inspectB4SportDetail> | null>();
      let cursor = 0;
      await Promise.all(
        Array.from({ length: 6 }, async () => {
          while (cursor < cards.length) {
            const card = cards[cursor++]!;
            const targetPath = card.detailPath ?? card.registrationPath;
            if (!targetPath) continue;
            const detailUrl = `https://b4sportonline.pl${targetPath}`;
            const cacheKey = `${detailUrl}::${card.title}`;
            if (detailCache.has(cacheKey)) continue;
            detailCache.set(cacheKey, null);
            const dRes = await fetch(detailUrl, { headers: HDR, signal: AbortSignal.timeout(10_000) }).catch(() => null);
            if (dRes?.ok) {
              detailCache.set(cacheKey, inspectB4SportDetail(await dRes.text(), detailUrl, card.title));
            }
          }
        }),
      );

      const datePageCache = new Map<string, { documentHash: string; textHash: string } | null>();

      for (const card of cards) {
        const targetPath = card.detailPath ?? card.registrationPath;
        const detailUrl = targetPath ? `https://b4sportonline.pl${targetPath}` : null;
        const detailInfo = detailUrl ? detailCache.get(`${detailUrl}::${card.title}`) ?? null : null;

        // Strict cycling confirmation: if title/subevents didn't clearly say cycling, require detail page to confirm it.
        if (!card.isClearlyCycling && !detailInfo?.isCycling) continue;
        if (detailInfo?.isNonCycling && !card.isClearlyCycling) continue;

        const sourceUrl = b4SportSearchDateUrl(card.startDate);
        let hashes = { documentHash: "", textHash: "" };
        if (apply) {
          if (!datePageCache.has(sourceUrl)) {
            const sRes = await fetch(sourceUrl, { headers: HDR, signal: AbortSignal.timeout(10_000) }).catch(() => null);
            if (sRes?.ok) {
              const sHtml = await sRes.text();
              datePageCache.set(sourceUrl, { documentHash: sha256(sHtml), textHash: sha256(pageAsText(sHtml, sourceUrl).text) });
            } else {
              datePageCache.set(sourceUrl, null);
            }
          }
          const cached = datePageCache.get(sourceUrl);
          if (!cached) continue;
          hashes = cached;
        }

        const discipline = detailInfo?.discipline ?? inferB4SportDiscipline(`${card.title} ${card.subTitles.join(" ")}`);
        const registrationUrl = card.registrationPath
          ? `https://b4sportonline.pl${card.registrationPath}`
          : card.detailPath
            ? `https://b4sportonline.pl${card.detailPath}`
            : undefined;

        const ev = b4SportParsedEvent(card, {
          sourceUrl,
          discipline,
          websiteUrl: detailInfo?.websiteUrl,
          regulationsUrl: detailInfo?.regulationsUrl,
          registrationUrl,
        });

        await processCandidate("b4sport", ev, {
          sourceUrl,
          documentHash: hashes.documentHash,
          textHash: hashes.textHash,
          reason: "Polish cycling event on b4sportonline.pl.",
          country: "PL",
        });
      }
    } else {
      console.log("[b4sport] skipped: bot check detected");
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
