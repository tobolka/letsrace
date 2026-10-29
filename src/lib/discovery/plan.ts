import { createHash } from "node:crypto";
import { checkPublicUrl } from "@/lib/http/safe-url";
import { raceDiscoveryPrompt } from "./prompt";

export const DISCOVERY_VERSION = "discovery-v2";
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");

/** Source identity, not homepage identity. Preserve all content-bearing queries. */
export function discoveryUrl(raw: string): string | null {
  try {
    const url = checkPublicUrl(raw);
    if (/(^|\.)letsrace\.(cz|vercel\.app)$/i.test(url.hostname)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.toString();
  } catch { return null; }
}

export const DISCOVERY_COUNTRIES = ["CZ", "SK", "AT", "DE", "PL", "CH", "IT"] as const;
export type DiscoveryCountry = typeof DISCOVERY_COUNTRIES[number];
export type SearchProvider = "ai" | "brave" | "openai";
export type SearchSpec = { provider: SearchProvider; query: string; country: DiscoveryCountry; season: number };

/** Deliberately independent of the events table and any benchmark list. */
export function discoveryPlan(season: number, providers: SearchProvider[] = ["ai", "brave"], country: DiscoveryCountry = "CZ"): SearchSpec[] {
  if (!Number.isInteger(season) || season < 2026 || season > 2100) throw new Error("Invalid discovery season");
  if (!DISCOVERY_COUNTRIES.includes(country)) throw new Error("Unsupported discovery country");
  const queries = country === "CZ" ? [
    `cyklistické závody ${season} Česko kalendář termíny`,
    `MTB maratony XCO XCC závody ${season} ČR termíny`,
    `silniční závody časovky granfondo ${season} Česko`,
    `gravel závody ${season} Česká republika`,
    `dětské cyklistické závody ${season} Česko`,
    `bikepacking ultracyklistika závody ${season} ČR`,
    `cyklokros BMX enduro downhill závody ${season} Česko`,
    `cyklokros zimní sezona ${season}/${season + 1} ${season - 1}/${season} Česko kalendář`,
  ] : country === "SK" ? [
    `cyklistické preteky ${season} Slovensko kalendár`,
    `MTB maratón XCO XCC ${season} Slovensko`,
    `cestná cyklistika časovka granfondo ${season} Slovensko`,
    `gravel preteky ${season} Slovensko`,
    `detské cyklistické preteky ${season} Slovensko`,
    `bikepacking ultra cyklistika ${season} Slovensko`,
    `BMX enduro downhill preteky ${season} Slovensko`,
    `cyklokros zimná sezóna ${season}/${season + 1} ${season - 1}/${season} Slovensko`,
  ] : ["cycling calendar federation", "MTB XCO XCM marathon", "road time trial granfondo", "gravel", "children youth cycling", "bikepacking ultra cycling", "BMX enduro downhill", `cyclocross winter ${season - 1}/${season} ${season}/${season + 1}`].map(topic => `${topic} races ${season} ${{ AT: "Österreich Radrennen", DE: "Deutschland Radrennen", PL: "Polska wyścigi rowerowe", CH: "Schweiz Suisse Radrennen courses cyclistes", IT: "Italia calendario gare ciclismo granfondo" }[country]}`);
  const plan: SearchSpec[] = [
    { provider: "ai", query: raceDiscoveryPrompt(season, country), country, season },
    ...queries.map(query => ({ provider: "brave" as const, query, country, season })),
  ];
  const ai = plan[0]!;
  return [...plan, { ...ai, provider: "openai" as const }].filter(spec => providers.includes(spec.provider));
}

export type RaceHint = { name: string; dateText?: string; place?: string; discipline?: string; url: string;
  startDate?: string; endDate?: string; region?: string; series?: string;
  children?: "yes" | "no" | "unknown"; status?: "confirmed" | "preliminary" | "date_unknown" };

/** AI URLs must have been returned by search; answers are leads, never evidence. */
export function groundedHints(raw: unknown, resultUrls: string[]): RaceHint[] {
  const allowed = new Set(resultUrls.map(discoveryUrl).filter(Boolean));
  if (!Array.isArray(raw)) return [];
  const hints: RaceHint[] = raw.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const r = item as Record<string, unknown>;
    // Read historical artifacts too; new searches use the user's source_url/city fields.
    const source = r.source_url ?? r.url;
    const url = typeof source === "string" ? discoveryUrl(source) : null;
    if (!url || !allowed.has(url) || typeof r.name !== "string" || !r.name.trim()) return [];
    const str = (key: string) => typeof r[key] === "string" ? (r[key] as string).slice(0, 500) : undefined;
    const hint: RaceHint = { url, name: r.name.trim().slice(0, 250), dateText: str("date"), place: str("city") ?? str("place"), discipline: str("discipline") };
    for (const [key, target] of [["start_date", "startDate"], ["end_date", "endDate"], ["region", "region"], ["series", "series"]] as const) {
      const value = str(key);
      if (value) hint[target] = value;
    }
    if (["yes", "no", "unknown"].includes(String(r.children))) hint.children = r.children as RaceHint["children"];
    if (["confirmed", "preliminary", "date_unknown"].includes(String(r.status))) hint.status = r.status as RaceHint["status"];
    return [hint];
  });
  const seen = new Set<string>();
  return hints.filter(hint => {
    const key = JSON.stringify(hint);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
