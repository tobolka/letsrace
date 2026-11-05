import * as cheerio from "cheerio";
import { entryPrices, type PracticalDocument } from "./practical-extraction";
import { isAggregatorUrl } from "@/lib/watcher/public-url";

/**
 * Which documents are worth reading for a race, in which order. A race's "regulations" link often
 * leads to general terms, last year's PDF or the club's statutes; the real document may be two
 * clicks away on the organiser's site. Everything here is a hint for the order of reading: facts
 * still have to pass the source verifier.
 */
type SourceContext = { name: string; startDate: string };

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const decoded = (url: string) => { try { return decodeURIComponent(url); } catch { return url; } };

const NEVER_USEFUL = /satzung|stanovy|statut(?:y|en)?\b|aufnahmeantrag|beitritts|mitgliedsantrag|vereinssitzung|datenschutz|gdpr|\brodo\b|privacy|cookie|impressum|sponsor|einverstandnis|ucastnick\w*-?prohlaseni|results?\b|ergebnis|vysledk|wyniki|classifica|startlist|start-list|startliste|protokol|galerie|gallery|fotky|photos?\b/;
const REGULATIONS = /propoz|ausschreibung|regulamin|reglement|regolamento|reglamento|rozpis|pokyny|bulletin|race-?guide|guide|technical|technicky|infoblatt|info-?flyer|\brules?\b|pravidl/;
const PRACTICAL = /startgeld|nenngeld|startovn|startow|wpisow|oplat|inscription|iscrizion|anmeldung|registrace|zapisy|zeitplan|ablauf|programm?e?\b|harmonogram|horaire|strecke|trat[ey]?\b|trasy?\b|parcours|percorso|routes?\b|informac|informace|\binfos?\b|teilnehm|plakat|poster|flyer|letak|ulotka/;
const NOT_ORGANISER = /facebook|instagram|youtube|twitter|tiktok|strava|komoot|garmin|google\.[a-z]+\/maps|maps\.google|booking\.com|expedia|anrdoezrs|prf\.hn|awin1|mailto|wa\.me|linkedin|flickr|vimeo/;
const SHARED_DOCUMENT = /(?:^|\.)(?:drive\.google\.com|docs\.google\.com)$/;
const OWN_SITE_WORDS = /website|webseite|homepage|strona (?:wydarzenia|zawodow|organizatora)|oficialni|web zavodu|site officiel|sito ufficiale/;
const GENERAL_TERMS = /\bagb\b|teilnahmebedingungen|conditions-?generales|terms|obchodni-?podminky|haftung/;

function linkAnchors(text: string): Map<string, string> {
  const anchors = new Map<string, string>();
  for (const match of text.matchAll(/\[([^\]]{1,160})\]\((https?:[^)\s]+)\)/g)) anchors.set(match[2]!.replace(/#.*$/, ""), `${anchors.get(match[2]!) ?? ""} ${match[1]}`);
  return anchors;
}

/** Years a link speaks of, seasons included. */
function linkYears(text: string): number[] {
  const years = [...text.matchAll(/(?<!\d)(20[12]\d)(?:[-/_]?(\d{2})(?!\d))?(?!\d)/g)].flatMap(match => {
    const first = Number(match[1]), second = match[2] ? Number(match[2]) : null;
    return second !== null && second === (first + 1) % 100 ? [first, first + 1] : [first];
  });
  return [...new Set(years)];
}

/** Higher is better, null means do not read. */
export function linkScore(link: string, anchor: string, pageUrl: string, context: SourceContext): number | null {
  const url = fold(decoded(link)), label = fold(anchor), blob = `${url} ${label}`, year = Number(context.startDate.slice(0, 4));
  let path = "", sameSite = false;
  try { const parsed = new URL(link); path = fold(decoded(parsed.pathname)); sameSite = parsed.hostname === new URL(pageUrl).hostname; } catch { return null; }
  if (/\.(?:gpx|kml|kmz|zip|jpe?g|png|mp4|docx?x?$)$/i.test(path) && !/plakat|poster|flyer|letak|propoz/.test(blob)) return null;
  if (NEVER_USEFUL.test(blob)) return null;
  if (/(?:^|\/)(?:archiv|archive)(?:[/._-]|$)/.test(path)) return null;
  const years = linkYears(`${path} ${label}`);
  // A link that names only earlier years is an earlier edition.
  if (years.length && !years.includes(year) && Math.max(...years) < year) return null;
  const host = (() => { try { return new URL(link).hostname.toLowerCase(); } catch { return ""; } })();
  const isDocument = /\.(?:pdf|docx?|odt|rtf)$/.test(path) || SHARED_DOCUMENT.test(host);
  const regulations = REGULATIONS.test(blob), practical = PRACTICAL.test(blob);
  const words = fold(context.name).replace(/\b20\d{2}\b/g, "").match(/[a-z0-9]{4,}/g) ?? [];
  // A calendar names the race and links the organiser; the organiser's site is what we are after.
  if (!isDocument && !sameSite) {
    if (NOT_ORGANISER.test(url) || isAggregatorUrl(link)) return null;
    const namesRace = words.filter(word => word.length >= 5).some(word => host.replace(/[^a-z0-9]/g, "").includes(word));
    return namesRace || OWN_SITE_WORDS.test(label) || isAggregatorUrl(pageUrl) ? 4 : null;
  }
  if (!isDocument && !regulations && !practical) return null;
  let score = 0;
  if (regulations) score += 6;
  if (practical) score += 3;
  if (isDocument) score += 2;
  if (years.includes(year)) score += 3;
  if (words.some(word => blob.includes(word))) score += 3;
  if (GENERAL_TERMS.test(blob)) score -= 5;
  return score;
}

/** Links of a page, best first, without those that cannot help. */
export function rankPracticalLinks(links: Iterable<string>, pageText: string, pageUrl: string, context: SourceContext): string[] {
  const anchors = linkAnchors(pageText);
  return [...new Set(links)].flatMap(link => {
    const score = linkScore(link, anchors.get(link.replace(/#.*$/, "")) ?? "", pageUrl, context);
    return score === null || score < 2 ? [] : [{ link, score }];
  }).sort((a, b) => b.score - a.score).map(row => row.link);
}

/** A poster shown only as a picture on the race page. */
export function posterImages(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html), found: string[] = [];
  $("img[src], a[href]").each((_, node) => {
    const raw = $(node).attr("src") ?? $(node).attr("href") ?? "";
    if (!/\.(?:jpe?g|png|webp)(?:\?|$)/i.test(raw)) return;
    const label = fold(`${decoded(raw)} ${$(node).attr("alt") ?? ""} ${$(node).attr("title") ?? ""}`);
    if (!/plakat|poster|propoz|flyer|letak|ulotka|locandina|ausschreibung|program/.test(label) || /thumb|logo|icon|sponsor|\b\d{2,3}x\d{2,3}\b/.test(label)) return;
    try { found.push(new URL(raw, pageUrl).toString()); } catch { /* A broken address is no poster. */ }
  });
  return [...new Set(found)].slice(0, 3);
}

/** A page that asks to verify the visitor is not ours to pass, in any browser. */
export const asksToVerifyVisitor = (text: string) => /just a moment|checking your browser|verifying (?:your browser|you)|security checkpoint|attention required|ověřujeme váš|captcha/i.test(text);
/** Built with JavaScript alone: nothing to read until a browser runs it, and no one asked us to prove anything. */
export const onlyInBrowser = (html: string, text: string) => text.replace(/\s+/g, " ").length < 400 && !asksToVerifyVisitor(`${text} ${html.slice(0, 4000)}`) && /<script/i.test(html) && /doesn't work properly without javascript|enable javascript|id="(?:app|root|__next)"|wixsite|wix\.com|data-reactroot/i.test(html);

export type DocumentKind = "regulations" | "general_terms" | "not_about_races" | "other_edition" | "no_details";

/** What a read document turned out to be, for this race's edition. */
export function documentKind(doc: Pick<PracticalDocument, "url" | "text">, context: SourceContext): DocumentKind {
  const text = fold(doc.text), head = text.slice(0, 1500), year = Number(context.startDate.slice(0, 4));
  if (/\bsatzung\b|\bstanovy\b|\bstatut\b|aufnahmeantrag|vereinssatzung/.test(`${head} ${fold(decoded(doc.url))}`)) return "not_about_races";
  const details = documentDetails(doc);
  const years = [...new Set([...head.matchAll(/(?<!\d)(20[12]\d)(?!\d)/g)].map(match => Number(match[1])))];
  const speaksOfEdition = text.includes(String(year)) || linkYears(fold(decoded(doc.url))).includes(year) || new RegExp(`\\b${year - 1}\\s*[-/]\\s*${String(year).slice(2)}\\b`).test(text);
  if (years.length && !speaksOfEdition && Math.max(...years) < year) return "other_edition";
  if (/\bagb\b|teilnahmebedingungen|conditions generales|general terms|terms and conditions|obchodni podminky/.test(head) && details.times < 2 && !details.fees) return "general_terms";
  return details.times >= 2 || details.fees || details.distance ? "regulations" : "no_details";
}

/** Rough signs of the facts a rider needs. */
export function documentDetails(doc: Pick<PracticalDocument, "text">) {
  const text = fold(doc.text);
  return {
    times: new Set(text.match(/(?<![\d:.])(?:[01]?\d|2[0-3])[:.h][0-5]\d(?!\d)/g) ?? []).size,
    fees: /startgeld|nenngeld|anmeldegebuhr|startovn|startow|wpisow|oplat[ay] start|inscription|iscrizion|quota|entry fee/.test(text) && entryPrices(doc.text).length > 0,
    distance: /\d\s*km\b/.test(text),
  };
}
