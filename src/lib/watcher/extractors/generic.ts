import * as cheerio from "cheerio";
import type { ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";

const MONTHS_CS: Record<string, string> = {
  ledna: "01",
  lednu: "01",
  "února": "02",
  "únoru": "02",
  "března": "03",
  "březnu": "03",
  dubna: "04",
  dubnu: "04",
  "května": "05",
  "květnu": "05",
  "června": "06",
  "červnu": "06",
  "července": "07",
  "červenci": "07",
  srpna: "08",
  srpnu: "08",
  "září": "09",
  "října": "10",
  "říjnu": "10",
  listopadu: "11",
  prosince: "12",
  prosinci: "12",
};

export function extractGeneric(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("h1").first().text().trim() ||
    $("title").text().trim();
  const text = $("body").text().replace(/\s+/g, " ");

  const iso = text.match(/20\d{2}-\d{2}-\d{2}/);
  const cs = text.match(/(\d{1,2})\.\s*(\d{1,2})\.\s*(20\d{2})/);
  const csWord = text.match(/(\d{1,2})\.\s*([A-Za-zÁ-ž]+)\s+(20\d{2})/);

  let startDate = "";
  if (iso) startDate = iso[0];
  else if (cs) {
    startDate = `${cs[3]}-${cs[2].padStart(2, "0")}-${cs[1].padStart(2, "0")}`;
  } else if (csWord) {
    const m = MONTHS_CS[csWord[2].toLowerCase()];
    if (m) startDate = `${csWord[3]}-${m}-${csWord[1].padStart(2, "0")}`;
  }

  if (!startDate || !title) return [];

  const audience = /junior|žák|deti|děti|kids|mládež|talent/i.test(title + text)
    ? "kids"
    : /gravel|silnic|road|maraton|xcm|xc\b/i.test(title + text)
      ? "mixed"
      : "mixed";

  const disciplines: ParsedEvent["discipline"] = [];
  if (/gravel/i.test(title + text)) disciplines?.push("gravel");
  if (/silnic|road|kritérium/i.test(title + text)) disciplines?.push("road");
  if (/\bxcm\b|maraton/i.test(title + text)) disciplines?.push("xcm");
  if (/\bxc\b|cross.?country/i.test(title + text)) disciplines?.push("xc");
  if (/časovka|time.?trial|\btt\b/i.test(title + text)) disciplines?.push("tt");
  if (/enduro/i.test(title + text)) disciplines?.push("enduro");
  if (/biatlon/i.test(title + text)) disciplines?.push("biathlon");

  return [
    {
      externalId: `generic-${normalizeName(title)}-${startDate}`,
      name: title.replace(/\s*[|\-–].*$/, "").trim().slice(0, 140),
      startDate,
      placeText: guessPlace(text) || "Unknown",
      countryHint: guessCountry(url, text),
      discipline: disciplines?.length ? disciplines : undefined,
      audience,
      sourceUrl: url,
      confidence: 0.35,
    },
  ];
}

function guessPlace(text: string): string | null {
  const m = text.match(
    /\b(Hradec Králové|Praha|Brno|Ostrava|Plzeň|Liberec|Olomouc|Pardubice|Klatovy|Sušice|Karlovy Vary|Bratislava|Wien|Dresden|Kraków)\b/,
  );
  return m?.[1] ?? null;
}

function guessCountry(url: string, text: string): string {
  if (/\.cz\b|Česk|Czech/i.test(url + text)) return "CZ";
  if (/\.sk\b|Slovensk/i.test(url + text)) return "SK";
  if (/\.de\b|Deutsch|Germany/i.test(url + text)) return "DE";
  if (/\.at\b|Öster|Austria/i.test(url + text)) return "AT";
  if (/\.pl\b|Polsk|Poland/i.test(url + text)) return "PL";
  if (/\.it\b|Italia|Italy/i.test(url + text)) return "IT";
  return "CZ";
}
