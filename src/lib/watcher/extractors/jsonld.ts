import * as cheerio from "cheerio";
import type { ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";
import { countryFromLabel } from "@/lib/geo/country-label";

/** A site may write "rennen/11-rostock" for its race page; a race keeps only a full address. */
function absoluteLink(raw: unknown, base: string): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const url = new URL(raw.trim(), base);
    return /^https?:$/.test(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function extractJsonLdEvents(sourceUrl: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const out: ParsedEvent[] = [];
  const base = absoluteLink($("base[href]").first().attr("href"), sourceUrl) ?? sourceUrl;

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).contents().text();
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : data["@graph"] ? data["@graph"] : [data];
      for (const item of items) {
        const types = ([] as string[]).concat(item["@type"] ?? []);
        if (!types.some((t) => /Event/i.test(String(t)))) continue;
        const start = item.startDate ?? item.start_date;
        if (!start || !item.name) continue;
        const place =
          typeof item.location === "string"
            ? item.location
            : item.location?.address?.addressLocality || item.location?.name || "";
        const geo = item.location?.geo;
        const country = item.location?.address?.addressCountry;
        const page = absoluteLink(item.url, base);
        out.push({
          externalId: item["@id"] || `${normalizeName(item.name)}-${String(start).slice(0, 10)}`,
          name: String(item.name),
          startDate: String(start).slice(0, 10),
          endDate: item.endDate ? String(item.endDate).slice(0, 10) : undefined,
          placeText: String(place || "Unknown"),
          description: typeof item.description === "string" ? cheerio.load(item.description).text().trim().slice(0, 3000) || undefined : undefined,
          countryHint: countryFromLabel(typeof country === "string" ? country : country?.name) ?? countryFromLabel(place),
          sourceUrl: page ?? sourceUrl,
          registrationUrl: page,
          lat: geo?.latitude ? Number(geo.latitude) : undefined,
          lng: geo?.longitude ? Number(geo.longitude) : undefined,
          confidence: place ? 0.85 : 0.7,
        });
      }
    } catch {
      // ignore invalid JSON-LD
    }
  });

  return out;
}
