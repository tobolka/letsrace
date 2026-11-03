import type { UciClass } from "@/lib/taxonomy";

/** Read the UCI's explicit competition class; World Cup is not road WorldTour. */
export function uciCompetitionClass(value: string): UciClass | null {
  const text = value.trim();
  const numbered = text.match(/^([123])\s*-\s*Class\s*\1$/i);
  if (numbered) return `c${numbered[1]}` as UciClass;
  if (/^CDM\s*-\s*World Cup$/i.test(text)) return "cdm";
  if (/^CS\s*-\s*Continental Series$/i.test(text)) return "cs";
  return null;
}

export function uciClassIn(text: string): UciClass | null {
  const t = ` ${text} `;
  const match = t.match(/\bUCI[\s-]*(?:XCO|XCM|XCC|CX|DH|MTB|BMX|ROAD)?[\s-]*(HC|C1|C2|C3|CDM|CS|1\.1|1\.2|2\.1|2\.2|1\.Pro|2\.Pro|1\.UWT|2\.UWT|WC|World\s*Cup)\b/i)
    ?? t.match(/[\s(\[](?:(?:XCO|XCM|CX)\s*)?(C1|C2|C3|HC)[\s)\],]/)
    ?? t.match(/[\s(\[](1\.1|1\.2|2\.1|2\.2|1\.Pro|2\.Pro)[\s)\],]/);
  if (!match) return null;
  const value = match[1].toLowerCase().replace(/\s+/g, "");
  if (/uwt/.test(value)) return "worldtour";
  if (/^(worldcup|wc|cdm)$/.test(value)) return "cdm";
  if (/pro/.test(value)) return "proseries";
  return ["hc", "c1", "c2", "c3", "cs", "1.1", "1.2", "2.1", "2.2"].includes(value) ? value as UciClass : null;
}
