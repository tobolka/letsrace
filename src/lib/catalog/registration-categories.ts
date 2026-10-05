import * as cheerio from "cheerio";
import { AGE_CATEGORIES, type AgeCategory } from "@/lib/taxonomy";
import { parseContestCategories } from "@/lib/watcher/extractors/contest-categories";

type CategoryEvidence = { labels: string[]; ages: AgeCategory[]; sourceUrl: string };
const categoryField = /^(?:age[ _-]*(?:group|class|category)(?:\d+)?(?:\.name)?|category|categories|kategorie|kategoria|altersklasse|klasse|věková\s*kategorie|vekova\s*kategoria|contest|competition|wettbewerb)(?:[ _-]?(?:id|select|\d+))?(?:\[\])?\s*:?$/i;
const clean = (value: unknown): string => typeof value === "string" ? value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, 160) : "";
const unique = (values: unknown[]): string[] => [...new Set(values.map(clean).filter(Boolean))];

/** Read category choices only, never name/address/club dropdowns or personal input values. */
export function htmlRegistrationCategories(html: string): string[] {
  const $ = cheerio.load(html);
  const labels: string[] = [];
  $("select").each((_, node) => {
    const select = $(node), id = select.attr("id");
    const label = id ? $("label").filter((_, l) => $(l).attr("for") === id).text().trim() : "";
    if (![select.attr("name"), id, label].some((v) => v && categoryField.test(v))) return;
    select.find("option").each((_, option) => { labels.push($(option).text()); });
  });
  $("input[type='radio']").each((_, node) => {
    const radio = $(node);
    if (!categoryField.test(radio.attr("name") ?? "")) return;
    const id = radio.attr("id");
    const label = radio.closest("label").text() || (id ? $("label").filter((_, l) => $(l).attr("for") === id).text() : "");
    if (label) labels.push(label);
  });
  return unique(labels);
}

export function registrationEditionMatches(html: string, startDate: string): boolean {
  const [year, month, day] = startDate.split("-").map(Number);
  const text = cheerio.load(html).text();
  return new RegExp(`(?<!\\d)(?:${year}-0?${month}-0?${day}|0?${day}\\s*[./]\\s*0?${month}\\s*[./]\\s*${year})(?!\\d)`).test(text);
}

/** RaceResult's initial public form has field specifications under Steps/Children. */
export function raceResultFormCategories(body: unknown): string[] {
  const labels: unknown[] = [];
  const visit = (value: unknown, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 20) return;
    if (Array.isArray(value)) { value.forEach((v) => visit(v, depth + 1)); return; }
    const element = value as { Label?: string; Field?: { Name?: string; Values?: { Label?: string }[] }; Children?: unknown; Elements?: unknown; Steps?: unknown };
    if (element.Field && [element.Field.Name, element.Label].some((name) => name && categoryField.test(name)))
      for (const choice of element.Field.Values ?? []) labels.push(choice.Label);
    for (const children of [element.Steps, element.Elements, element.Children]) visit(children, depth + 1);
  };
  visit(body);
  return unique(labels);
}

/** Only category filters and the AgeGroup.Name column survive this projection. */
export function raceResultParticipantCategories(body: unknown): string[] {
  const response = body as {
    list?: { Orders?: { Grouping?: number; Expression?: string }[] };
    groupFilters?: { Values?: unknown[] }[]; DataFields?: string[]; data?: unknown;
  };
  const labels: unknown[] = [];
  const grouped = (response.list?.Orders ?? []).filter((o) => Boolean(o.Grouping));
  grouped.forEach((order, i) => {
    if (/^AgeGroup(?:\d+)?\.Name$/i.test(order.Expression ?? "")) labels.push(...(response.groupFilters?.[i]?.Values ?? []));
  });
  const index = (response.DataFields ?? []).findIndex((field) => /^AgeGroup(?:\d+)?\.Name$/i.test(field));
  const visit = (value: unknown, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 20) return;
    if (Array.isArray(value)) {
      if (value.every((v) => v == null || typeof v !== "object")) { if (index >= 0) labels.push(value[index]); }
      else value.forEach((v) => visit(v, depth + 1));
    } else Object.values(value).forEach((v) => visit(v, depth + 1));
  };
  visit(response.data);
  return unique(labels);
}

/** A partial list never authorizes excluding an unlisted age or adult audience. */
export function partialCategoryPatch(previous: string[] | null, evidence: string[], refYear: number) {
  const positive = parseContestCategories(evidence, { refYear });
  if (!positive.length || positive.every((age) => previous?.includes(age))) return null;
  return { age_categories: AGE_CATEGORIES.filter((age) => previous?.includes(age) || positive.includes(age)), age_confidence: "default" as const };
}

const getJson = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000), headers: { "user-agent": "letsrace-catalog/1.0 (+https://letsrace.cz)", ...init?.headers } });
  if (!response.ok) return null;
  return response.json();
};

/** Read blank public forms; never advance a step, enter personal data or submit an entry. */
export async function raceResultRegistrationEvidence(eventId: string, startDate: string): Promise<CategoryEvidence[]> {
  const root = `https://my.raceresult.com/${eventId}`;
  const config = await getJson(`${root}/registration/config?lang=en&sanitize=1`) as {
    EventDate?: string; EventDate2?: string; Registrations?: { Name?: string; Key?: string; IfLoggedIn?: number; Contests?: { Name?: string }[] }[];
  } | null;
  if (!config?.EventDate || startDate < config.EventDate.slice(0, 10) || startDate > (config.EventDate2 ?? config.EventDate).slice(0, 10)) return [];
  // A shared running/swimming programme cannot establish this cycling race's classes.
  if ((config.Registrations ?? []).some((form) => (form.Contests ?? []).some((contest) => /\bberg?lauf|\blauf\b|\brun\b|swim|schwimm/i.test(contest.Name ?? "")))) return [];
  const evidence: CategoryEvidence[] = [];
  const add = (labels: string[], sourceUrl: string) => {
    const supported = labels.filter((label) => parseContestCategories([label], { refYear: Number(startDate.slice(0, 4)) }).length);
    const ages = parseContestCategories(supported, { refYear: Number(startDate.slice(0, 4)) });
    if (ages.length) evidence.push({ labels: supported, ages, sourceUrl });
  };
  for (const form of (config.Registrations ?? []).slice(0, 8)) {
    if (!form.Name || !form.Key || form.IfLoggedIn === 1) continue;
    try {
      const params = new URLSearchParams({ eventid: eventId, rname: form.Name, key: form.Key, lang: "en" });
      const body = await getJson(`https://events2.raceresult.com/api/registrations/request?${params}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ URL: `${root}/registration` }),
      });
      add(raceResultFormCategories(body), `${root}/registration?regname=${encodeURIComponent(form.Name)}`);
    } catch { /* A closed/private form does not prevent reading the public list. */ }
  }
  try {
    const participants = await getJson(`${root}/participants/config?lang=en&sanitize=1`) as {
      key?: string; Tab?: { Enabled?: boolean }; TabConfig?: { Lists?: { Name?: string }[] };
    } | null;
    if (participants?.key && participants.Tab?.Enabled) for (const list of (participants.TabConfig?.Lists ?? []).slice(0, 4)) {
      if (!list.Name) continue;
      const params = new URLSearchParams({ key: participants.key, listname: list.Name, page: "participants", r: "all", openedGroups: "{}", l: "0" });
      const body = await getJson(`${root}/participants/list?${params}`);
      if (body) add(raceResultParticipantCategories(body), `${root}/participants`);
    }
  } catch { /* Public participant lists are optional. */ }
  return evidence;
}
