import * as cheerio from "cheerio";
import type { Discipline, ParsedEvent } from "@/lib/domain";
import { normalizeName } from "@/lib/domain";

const DE_MONTHS: Record<string, string> = {
  januar: "01",
  februar: "02",
  marz: "03",
  märz: "03",
  april: "04",
  mai: "05",
  juni: "06",
  juli: "07",
  august: "08",
  september: "09",
  oktober: "10",
  november: "11",
  dezember: "12",
};

function mapDisc(raw: string): Discipline[] {
  const t = raw.toLowerCase();
  if (/\benduro\b/.test(t)) return ["enduro"];
  if (/\bdownhill|\bdh\b/.test(t)) return ["dh"];
  if (/\bxcm|marathon|maraton/.test(t)) return ["xcm"];
  if (/\bxcc|short.?track/.test(t)) return ["xcc"];
  if (/\bxco|cross.?country/.test(t)) return ["xco"];
  if (/\bgravel\b/.test(t)) return ["gravel"];
  if (/\bhillclimb|berg/.test(t)) return ["mtb"];
  if (/\bpumptrack|4x|dual/.test(t)) return ["other"];
  return ["mtb"];
}

/**
 * ÖRV Cycling Austria MTB calendar (`cyclingaustria.at/kalender?sparten=mtb`).
 * Cards: `a.om_card` with `data-date` on the wrapper and German weekday heading.
 */
export function parseCyclingAustria(url: string, html: string): ParsedEvent[] {
  const $ = cheerio.load(html);
  const events: ParsedEvent[] = [];
  const seen = new Set<string>();

  $("div[data-date]").each((_, wrap) => {
    const $wrap = $(wrap);
    const iso = ($wrap.attr("data-date") || "").slice(0, 10);
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(iso)) return;
    const $a = $wrap.find("a.om_card").first();
    const href = $a.attr("href");
    const name = $wrap.find("h3").first().text().replace(/\s+/g, " ").trim();
    if (!name || name.length < 4) return;
    if (/abgesagt|cancelled|abbruch/i.test(name)) return;

    const discRaw = $wrap.attr("data-disziplin") || $wrap.attr("class") || "";
    const verein = $wrap.find(".event-verein").text().replace(/\s+/g, " ").trim();
    const heading = $wrap.find(".uk-heading-small").text().replace(/\s+/g, " ").trim();
    // "Sa, 15. August 2026 | …" — confirm year
    const named = heading.match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s*(20\d{2})/);
    let startDate = iso;
    if (named) {
      const mo =
        DE_MONTHS[named[2]!.toLowerCase()] ||
        DE_MONTHS[
          named[2]!.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        ];
      if (mo) startDate = `${named[3]}-${mo}-${named[1]!.padStart(2, "0")}`;
    }

    let abs = url;
    if (href) {
      try {
        abs = new URL(href.replace(/&amp;/g, "&"), url).toString();
      } catch {
        /* keep */
      }
    }

    const id = abs.match(/id=([A-F0-9]+)/i)?.[1] || normalizeName(name);
    const externalId = `oerv-${id}-${startDate}`;
    if (seen.has(externalId)) return;
    seen.add(externalId);

    const region = ($wrap.attr("class") || "")
      .split(/\s+/)
      .find((c) =>
        /^(Wien|Niederösterreich|Oberösterreich|Steiermark|Tirol|Salzburg|Kärnten|Vorarlberg|Burgenland)$/i.test(
          c,
        ),
      );

    events.push({
      externalId,
      name,
      startDate,
      placeText: [verein, region].filter(Boolean).join(" — ") || region || "Austria",
      countryHint: "AT",
      discipline: mapDisc(discRaw + " " + name),
      audience: /nachwuchs|jugend|u1[13579]|kids|kinder/i.test(name + discRaw)
        ? "youth"
        : "mixed",
      sourceUrl: url,
      websiteUrl: abs,
      confidence: 0.82,
    });
  });

  return events;
}
