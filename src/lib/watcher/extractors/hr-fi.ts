import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";

const HR_MON: Record<string, string> = {
  sijecanj: "01",
  veljaca: "02",
  ozujak: "03",
  travanj: "04",
  svibanj: "05",
  lipanj: "06",
  srpanj: "07",
  kolovoz: "08",
  rujan: "09",
  listopad: "10",
  studeni: "11",
  prosinac: "12",
};

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function dmy(day: string, month: string, year: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function placeFromHrTitle(name: string): string {
  const t = fold(name);
  if (/losinj/.test(t)) return "Mali Lošinj";
  if (/premantura/.test(t)) return "Premantura";
  if (/4\s*islands/.test(t)) return "Otok Krk";
  if (/vodice/.test(t)) return "Vodice";
  if (/posedarje/.test(t)) return "Posedarje";
  if (/vrana/.test(t)) return "Vrana";
  if (/samobor/.test(t)) return "Samobor";
  if (/zminj/.test(t)) return "Žminj";
  if (/dugo\s*selo/.test(t)) return "Dugo Selo";
  if (/metkovi/.test(t)) return "Metković";
  if (/predolac/.test(t)) return "Predolac";
  if (/beretinec/.test(t)) return "Beretinec";
  if (/rocic/.test(t)) return "Ročić";
  if (/ljubac/.test(t)) return "Ljubač";
  if (/umag/.test(t)) return "Umag";
  if (/porec/.test(t)) return "Poreč";
  if (/konavle/.test(t)) return "Konavle";
  if (/gornji\s*kneginec/.test(t)) return "Gornji Kneginec";
  if (/istria|istrian/.test(t)) return "Umag";
  if (/punat/.test(t)) return "Punat";
  if (/slatina/.test(t)) return "Slatina";
  if (/vrbovec/.test(t)) return "Vrbovec";
  if (/krizevc/.test(t)) return "Križevci";
  if (/sisak/.test(t)) return "Sisak";
  if (/ucka/.test(t)) return "Učka";
  if (/kvarner/.test(t)) return "Rijeka";
  if (/trakoscan/.test(t)) return "Trakošćan";
  if (/biskupija|vrbnika/.test(t)) return "Biskupija";
  if (/varazdin/.test(t)) return "Varaždin";
  if (/nasice/.test(t)) return "Našice";
  if (/drnis/.test(t)) return "Drniš";
  if (/karlovac/.test(t)) return "Karlovac";
  if (/\bcro\s*race\b/.test(t)) return "Zagreb";
  if (/zambelli/.test(t)) return "Rijeka";
  if (/grgac/.test(t)) return "Vrbovec";
  if (/borik/.test(t)) return "Zadar";
  if (/zagreb/.test(t) || /sljeme/.test(t)) return "Zagreb";
  if (/zdrilic/.test(t)) return "Zadar";
  if (/pannonian/.test(t)) return "Osijek";
  const dash = name.split(/\s[-–—]\s/).at(-1)?.replace(/\s*20\d{2}\.?\s*$/, "").trim();
  if (dash && dash.length >= 3 && dash.length <= 32 && !/nacionalno|prvenstvo|mtb|xco|xcc|xcm|memorijal|ultimatum/i.test(dash)) {
    return dash;
  }
  return "";
}

function hrDiscipline(name: string): Discipline[] {
  const t = fold(name);
  if (/enduro/.test(t)) return ["enduro"];
  if (/downhill|\bdh\b/.test(t)) return ["dh"];
  if (/uspon/.test(t)) return ["hill_climb"];
  if (/\bxcc\b/.test(t)) return ["xcc"];
  if (/\bxcm|\bxcms\b/.test(t)) return ["xcm"];
  return ["xco"];
}

export function parseHbsMtb(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const sourceUrl = url.split("?")[0]!;
  const year = html.match(/XCO kup\s+(20\d{2})/i)?.[1] || "2026";

  $(".c-event-card").each((_, card) => {
    const day = $(card).find(".c-date-badge__day").first().text().trim();
    const monRaw = fold($(card).find(".c-date-badge__month").first().text().trim());
    const month = HR_MON[monRaw];
    const name = $(card).find("h2.u-a1").first().text().replace(/\s+/g, " ").trim();
    if (!day || !month || name.length < 4) return;
    if (/pump\s*track/i.test(name)) return;
    // Already on the map as SloXcup — same race, do not steal series_id.
    if (/xco\s*samobor/i.test(name)) return;
    const startDate = dmy(day, month, year);
    const place = placeFromHrTitle(name);
    if (!place) return;
    const t = fold(name);
    const islands = /4\s*islands/.test(t);
    const nationals = /nacionalno\s*prvenstvo/.test(t);
    const cup = !islands && !nationals;
    const id = islands
      ? `4islands-${startDate}`
      : `hbs-mtb-${startDate}-${normalizeName(place)}`;
    if (seen.has(id)) return;
    seen.add(id);
    events.push({
      externalId: id,
      name: name.replace(/\s*20\d{2}\.?\s*$/, "").replace(/,\s*$/, "").trim() || name,
      startDate,
      placeText: place,
      countryHint: "HR",
      discipline: hrDiscipline(name),
      audience: "mixed",
      seriesName: cup ? "Croatia MTB XCO Cup" : islands ? "4 Islands Epic" : undefined,
      seriesSlug: cup ? "croatia-mtb-xco-cup" : islands ? "4-islands-epic" : undefined,
      seriesWebsite: cup || islands ? sourceUrl : undefined,
      sourceUrl,
      confidence: 0.88,
    });
  });
  return events;
}

function hbsRoadDiscipline(cat: string, name: string): Discipline[] {
  const t = fold(`${cat} ${name}`);
  if (/ciklokros|cyclo-?cross/.test(t)) return ["cx"];
  if (/granfondo|gran fondo|\bgf\b/.test(t)) return ["gran_fondo"];
  if (/uspon|hill/.test(t)) return ["hill_climb"];
  if (/kronometr|time\s*trial|\btt\b/.test(t)) return ["tt"];
  if (/kriterij|criterium/.test(t)) return ["criterium"];
  if (/\bbmx\b/.test(t)) return ["bmx"];
  return ["road"];
}

export function parseHbsCalendar(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const sourceUrl = url.split("?")[0]!;
  $(".c-event-card").each((_, card) => {
    const day = $(card).find(".c-date-badge__day").first().text().trim();
    const monRaw = fold($(card).find(".c-date-badge__month").first().text().trim());
    const month = HR_MON[monRaw];
    const name = $(card).find("h2.u-a1").first().text().replace(/\s+/g, " ").trim();
    const cat = $(card).find(".c-category-badge").first().text().replace(/\s+/g, " ").trim();
    if (!day || !month || name.length < 4) return;
    if (/otkazano|cancelled/i.test(`${name} ${cat}`)) return;
    if (/\b2025\b/.test(name)) return;
    if (/pump\s*track/i.test(name)) return;
    const t = fold(`${cat} ${name}`);
    if (/^mtb$|bmx\s*freestyle/.test(fold(cat))) return;
    if (
      /\bxco\b|\bxcc\b|\bxcm|\bxcp\b|\bxcms\b|\bxc\b|enduro|trnduro|downhill|\bdh\b|4\s*islands|mtb\s*croatia|rocky\s*trails/.test(
        t,
      )
    ) {
      return;
    }
    const startDate = dmy(day, month, "2026");
    const place = placeFromHrTitle(name);
    if (!place) return;
    const id = `hbs-${startDate}-${normalizeName(name).slice(0, 40)}`;
    if (seen.has(id)) return;
    seen.add(id);
    events.push({
      externalId: id,
      name: name.replace(/^["'„]+|["'“]+$/g, "").replace(/\s*20\d{2}\.?\s*$/, "").trim() || name,
      startDate,
      placeText: place,
      countryHint: "HR",
      discipline: hbsRoadDiscipline(cat, name),
      audience: "mixed",
      sourceUrl,
      confidence: 0.84,
    });
  });
  if (!/\/page\//i.test(url) && events[0]) {
    events[0] = {
      ...events[0],
      childUrls: [
        "https://www.hbs.hr/kalendar/page/2/",
        "https://www.hbs.hr/kalendar/page/3/",
      ],
    };
  }
  return events;
}

const FI_DISC: Record<string, Discipline> = {
  xco: "xco",
  xcc: "xcc",
  xce: "xce",
  xcm: "xcm",
  cxt: "xco",
};

export function parseKultainenKampi(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();
  const sourceUrl = url.split("?")[0]!;
  $("table tr").each((_, tr) => {
    const c = $(tr)
      .find("td")
      .toArray()
      .map((td) => $(td).text().replace(/\s+/g, " ").trim());
    if (c.length < 4) return;
    const dm = c[0]!.match(/^(\d{1,2})\.(\d{1,2})\.(20\d{2})$/);
    if (!dm || dm[3] !== "2026") return;
    const name = c[1]!;
    const kind = fold(c[2] || "");
    const disc = FI_DISC[kind];
    if (!disc) return;
    const place = c[3]!;
    if (!name || place.length < 3) return;
    const startDate = dmy(dm[1]!, dm[2]!, dm[3]!);
    const id = `kultainen-kampi-${startDate}-${normalizeName(place)}-${kind}`;
    if (seen.has(id)) return;
    seen.add(id);
    events.push({
      externalId: id,
      name: name.length < 5 ? `Kultainen Kampi — ${place}` : name,
      startDate,
      placeText: place,
      countryHint: "FI",
      discipline: [disc],
      audience: "mixed",
      seriesName: "Kultainen Kampi",
      seriesSlug: "kultainen-kampi",
      seriesWebsite: sourceUrl,
      sourceUrl,
      confidence: 0.9,
    });
  });
  return events;
}
