import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { countryFromVenue } from "@/lib/geo/country-label";
import { countryCodeFromName } from "@/lib/geo/europe";
import { fetchText } from "@/lib/watcher/http";
import { mapPool } from "@/lib/watcher/pool";

export const NAKOLE_ARCHIVE = "https://www.nakole.cz/akce/archiv/";
export const NAKOLE_VERSION = "nakole-v1";
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const fold = (s: string) => clean(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
export function isNakoleUrl(url: string): boolean {
  try { return /^(www\.)?nakole\.cz$/.test(new URL(url).hostname); } catch { return false; }
}
function iso(s: string): string | undefined {
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return;
  const value = `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined;
}
export type NakoleListing = { url: string; name: string; date: string; type: string; place: string };
export function nakoleListings(html: string): NakoleListing[] {
  const $ = cheerio.load(html);
  return $("#sloupec_500 > #seznamZajezdu > .item").toArray().flatMap(el => {
    const row = $(el);
    const a = row.find("h3 a").first();
    const href = a.attr("href") ?? "";
    if (!/^\/akce\/\d+-[^/]+\.html$/.test(href)) return [];
    const label = clean(row.find(".popis > .mb5").first().text());
    const split = label.match(/^(.+?)\s+-\s+(.*)$/);
    return [{ url: new URL(href, NAKOLE_ARCHIVE).href, name: clean(a.text()),
      date: clean(row.find(".datum2").text()), type: split?.[1] ?? label, place: split?.[2] ?? "" }];
  });
}
export function nakoleLastPage(html: string): number {
  const $ = cheerio.load(html);
  return Math.max(1, ...$(".paginator a").toArray().map(el => {
    const url = new URL($(el).attr("href") ?? "", NAKOLE_ARCHIVE);
    return Number(url.searchParams.get("strana")) || 1;
  }));
}
export type NakoleDetail = { event?: ParsedEvent; reason?: string };
/** Read only this event's article, never sidebars, related events or discussion. */
export function parseNakoleDetail(url: string, html: string): NakoleDetail {
  if (!isNakoleUrl(url) || !/^\/akce\/\d+-[^/]+\.html$/.test(new URL(url).pathname)) return { reason: "not_event_detail" };
  const $ = cheerio.load(html);
  const article = $("#sloupec_500 > #clanek").first();
  const name = clean(article.children("h1").first().text());
  if (!name || fold(article.children("h2").first().text()) !== "zavod") return { reason: "not_labelled_race" };
  const meta = article.children("p").filter((_, el) => $(el).find("strong").toArray().some(s => fold($(s).text()) === "termin:")).first();
  const dates = clean(meta.text()).match(/\d{1,2}\.\d{1,2}\.\d{4}/g) ?? [];
  const startDate = iso(dates[0] ?? "");
  const endDate = dates[1] ? iso(dates[1]) : undefined;
  if (!startDate || dates.length > 2 || (dates[1] && !endDate) || (endDate && endDate < startDate)) return { reason: "invalid_date" };
  const placeText = clean(meta.html()?.split(/<strong>\s*Místo:\s*<\/strong>/i)[1]?.replace(/<[^>]*>/g, " ") ?? "");
  if (!placeText) return { reason: "missing_place" };
  const description = clean(meta.nextUntil("h2").text());
  const text = fold(`${name} ${description}`);
  if (/nezavodni|nesoutezni|bez mereni casu|nejde o zavod|neni (to )?zavod|vyjizdka|cyklovyjizdka|cyklozajezd|cykloturistick|turisticky pochod|triatlon|triathlon|duatlon|duathlon|kolobez|orientacni beh/.test(text)) return { reason: "non_race_or_other_sport" };
  if (!/\bmtb\b|\bxco\b|\bxcm\b|\bdh\b|\bbmx\b|cykl|bik|horskych kol|horsk[ae] kola|silnicni|gravel|downhill|enduro|casovka|jizda do vrchu|na kole|na kolech/.test(text)) return { reason: "cycling_not_proven" };
  const discipline: Discipline[] = /cyklokros|cykokros|cyclocross/.test(text) ? ["cx"]
    : /downhill|\bdh\b|sjezdovy zavod|zavod ve sjezdu/.test(text) ? ["dh"] : /enduro/.test(text) ? ["enduro"]
    : /gravel/.test(text) ? ["gravel"] : /\bxco\b|cross.country/.test(text) ? ["xco"]
    : /\bxcm\b/.test(text) ? ["xcm"] : /\bbmx\b/.test(text) ? ["bmx"]
    : /\bmtb\b|horskych kol|horsk[ae] kola|bikepacking/.test(text) ? ["mtb"]
    : /casovka/.test(text) ? ["tt"] : /silnicni/.test(text) ? ["road"] : ["other"];
  const countryHint = countryFromVenue(placeText) ?? countryCodeFromName(placeText) ?? "CZ";
  // Explicit foreign places must not silently inherit the publisher's country.
  if (/zahranic|zahranič/i.test(placeText) && countryHint === "CZ") return { reason: "country_unresolved" };
  let websiteUrl: string | undefined;
  article.children("p").find("a[href]").each((_, el) => {
    if (fold($(el).text()) !== "web") return;
    try { const u = new URL($(el).attr("href")!); if (/^https?:$/.test(u.protocol) && !isNakoleUrl(u.href)) websiteUrl = u.href; } catch { /* no inferred URL */ }
  });
  return { event: { externalId: `nakole-${new URL(url).pathname.match(/\/(\d+)-/)![1]}`,
    name, startDate, ...(endDate && endDate !== startDate ? { endDate } : {}), placeText,
    countryHint, discipline, eventType: "race", sourceUrl: url, websiteUrl, confidence: 0.94,
    evidence: { quote: clean(`${name} | Závod | ${meta.text()} | ${description}`).slice(0, 12000),
      sourceUrl: url, method: "nakole_detail", version: NAKOLE_VERSION } } };
}

/** Normal monitoring reads one listing page; the explicit backfill walks history. */
export async function parseNakole(url: string, html: string): Promise<ParsedEvent[]> {
  if (/^\/akce\/\d+-[^/]+\.html$/.test(new URL(url).pathname)) {
    const result = parseNakoleDetail(url, html);
    return result.event ? [result.event] : [];
  }
  const candidates = nakoleListings(html).filter(row => fold(row.type) === "zavod");
  const results = await mapPool(candidates, 2, async row => {
    const fetched = await fetchText(row.url, { timeoutMs: 20_000 });
    if (!fetched.ok || !fetched.text) throw new Error(`nakole_detail_unread:${row.url}`);
    return parseNakoleDetail(row.url, fetched.text).event;
  });
  return results.filter((ev): ev is ParsedEvent => Boolean(ev));
}
