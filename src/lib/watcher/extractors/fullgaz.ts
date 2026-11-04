import { createHash } from "node:crypto";
import { load } from "cheerio";
import type { ParsedEvent } from "@/lib/domain";
import { fetchPage } from "@/lib/watcher/http";
import { uciDateSpan } from "./uci-competition";

/** The organiser announces the new edition in navigation while regulations still describe last year. */
export async function parseFullgazHomepage(url: string, html: string, read: typeof fetchPage = fetchPage): Promise<ParsedEvent[]> {
  const base = new URL(url);
  if (base.hostname.replace(/^www\./, "") !== "fullgazrace.de" || base.pathname !== "/") return [];
  const $ = load(html), candidates = new Map<string, { year: string; label: string; href: string; name: string; start: string; end: string }>();
  for (const anchor of $("a[href]").toArray()) {
    const label = $(anchor).text().replace(/\s+/g, " ").trim();
    const match = label.match(/^Race\s+(20\d{2})\s*\((\d{1,2})\.\s*[&–-]\s*(\d{1,2})\.(\d{1,2})\.(20\d{2})\)$/i);
    if (!match || match[1] !== match[5]) continue;
    const href = new URL($(anchor).attr("href")!, base);
    if (href.hostname.replace(/^www\./, "") !== "fullgazrace.de" || !href.pathname.startsWith(`/race-${match[1]}-`)) continue;
    const name = $("h1,h2,h3").toArray().map(el => $(el).text().replace(/\s+/g, " ").trim())
      .find(text => new RegExp(`^(?:\\d+\\.\\s*)?Fullgaz Race\\s+${match[1]}$`, "i").test(text));
    if (!name) continue;
    const month = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][Number(match[4])-1];
    const dates = month && uciDateSpan(`${match[2]} ${month} - ${match[3]} ${month} ${match[1]}`, match[1]);
    if (!dates) continue;
    candidates.set(`${match[1]}:${dates.start}:${dates.end}`, { year: match[1], label, name, href: href.href, ...dates });
  }
  // Two announcements for the same year with conflicting dates are not a choice for the reader to guess.
  const years = [...new Set([...candidates.values()].map(c => c.year))].sort().reverse();
  if (!years.length) return [];
  const selected = [...candidates.values()].filter(c => c.year === years[0]);
  if (selected.length !== 1) throw Error("pipeline_data_review_required:conflicting_annual_announcements");
  const edition = selected[0], tracksUrl = new URL("racetracks/", edition.href.endsWith("/") ? edition.href : `${edition.href}/`).href;
  const tracks = await read(tracksUrl, { fresh: true, retries: 0 });
  if (tracks.status !== 200) throw Error(`Annual venue document unavailable: HTTP ${tracks.status}`);
  const venueDoc = load(tracks.html);
  const venueHeading = venueDoc("h1,h2,h3").toArray().map(el => venueDoc(el).text().replace(/\s+/g, " ").trim()).find(text => /^Renngelände\s+\S/i.test(text));
  if (!venueHeading) throw Error("pipeline_data_review_required:annual_venue_not_stated");
  const place = venueHeading.replace(/^Renngelände\s+/i, "");
  return [{ externalId: `fullgaz-${edition.year}`, name: edition.name, startDate: edition.start, endDate: edition.end,
    placeText: place, countryHint: "DE", eventType: "race", discipline: ["mtb"], sourceUrl: base.href, websiteUrl: edition.href, confidence: .98,
    fieldEvidence: [{ field: "placeText", value: place, sourceUrl: tracksUrl, quote: venueHeading, documentHash: createHash("sha256").update(tracks.html).digest("hex") }],
    evidence: { sourceUrl: base.href, quote: `${edition.name}\n${edition.label}`, method: "official_annual_announcement", version: "fullgaz-v1" },
  }];
}
