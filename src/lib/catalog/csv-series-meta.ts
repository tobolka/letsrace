/**
 * Map the curated CZ series CSV (`disciplina` + `podtyp`) onto our taxonomy.
 */
import type { AgeCategory, Discipline } from "@/lib/taxonomy";
import { inferSeriesType } from "@/lib/taxonomy";

export function disciplinesFromCsv(disciplina: string, podtyp: string): Discipline[] {
  const blob = `${disciplina} ${podtyp}`.toLowerCase();
  const out = new Set<Discipline>();

  if (/cyklokros|\bcx\b/.test(blob)) out.add("cx");
  if (/\bgravel\b/.test(blob)) out.add("gravel");
  if (/\bmtb\b|horské|horsky/.test(blob) || /xco|xcc|xcm|xce|enduro|\bdh\b|dhi|downhill|bikerally|blind/.test(blob)) {
    out.add("mtb");
  }
  if (/silnice|road|roadrace|roadmarathon|gran\s*fondo|časovka|casovka|kritérium|kriterium/.test(blob)) {
    out.add("road");
  }
  if (/\bmix\b/.test(blob)) {
    // Mixed series: take both parents unless podtyp already pinned leaves.
    if (!out.size) {
      out.add("mtb");
      out.add("road");
    }
  }

  if (/\bxco\b/.test(blob)) out.add("xco");
  if (/\bxcc\b/.test(blob)) out.add("xcc");
  if (/\bxce\b|eliminat/.test(blob)) out.add("xce");
  // Road marathon / gran fondo is not MTB XCM.
  if (/roadmarathon|road\s*marathon|gran\s*fondo/.test(blob)) {
    out.add("gran_fondo");
  } else if (/\bxcm\b|maraton|marathon|hobby\s*mtb/.test(blob)) {
    out.add("xcm");
  }
  if (/\benduro\b|blind\s*enduro|grom/.test(blob)) out.add("enduro");
  if (/\bdhi\b|\bdh\b|downhill|bikerally/.test(blob)) out.add("dh");
  if (/časovka|casovka|\btt\b/.test(blob)) out.add("tt");
  if (/kritérium|kriterium|criterium/.test(blob)) out.add("criterium");
  if (/roadrace|road\s*race|silniční závod/.test(blob)) out.add("road_race");
  if (/gravel/.test(blob)) out.add("gravel");
  if (/\bbmx\b/.test(blob)) out.add("bmx");

  // XC without a leaf → XCO (Czech regional "XC" cups are almost always XCO-shaped).
  if (/\bxc\b/.test(blob) && ![...out].some((d) => ["xco", "xcc", "xcm", "xce"].includes(d))) {
    out.add("xco");
  }

  if (!out.size) out.add("other");
  return [...out];
}

export function audienceHintFromCsv(name: string, podtyp: string, poznamka: string): {
  audience: "kids" | "youth" | "adults" | "mixed";
  ageCategories: AgeCategory[];
} {
  const blob = `${name} ${podtyp} ${poznamka}`.toLowerCase();
  if (/dětsk|detsky|kids|babybiker|talent\s*cup|fox\s*grom|mládež|mladez|junior/.test(blob)) {
    if (/talent|dětsk|detsky|kids|baby|grom/.test(blob)) {
      return { audience: "kids", ageCategories: ["kids"] };
    }
    return { audience: "youth", ageCategories: ["youth"] };
  }
  if (/masters/.test(blob)) {
    return { audience: "adults", ageCategories: ["elite"] };
  }
  return { audience: "mixed", ageCategories: [] };
}

export function seriesMetaFromCsv(row: {
  nazev: string;
  disciplina: string;
  podtyp: string;
  poznamka: string;
  slug: string;
}) {
  const disciplines = disciplinesFromCsv(row.disciplina, row.podtyp);
  const { audience, ageCategories } = audienceHintFromCsv(row.nazev, row.podtyp, row.poznamka);
  const seriesType = inferSeriesType({
    name: row.nazev,
    slug: row.slug,
    disciplines,
    ageCategories,
  });
  return { disciplines, audience, ageCategories, seriesType };
}
