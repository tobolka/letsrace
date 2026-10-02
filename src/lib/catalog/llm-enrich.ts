import * as cheerio from "cheerio";
import { writeFileSync } from "node:fs";
import { createServerSupabase } from "@/lib/supabase/server";
import { recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { ageCategoriesFromList } from "@/lib/age-bands";
import { AGE_CATEGORIES, DISCIPLINES, audienceFromAgeCategories, type AgeCategory } from "@/lib/taxonomy";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { CHAMPIONSHIP, directDocumentUrl, hintsFor, readDocument, relatedDocumentLinks } from "@/lib/catalog/regulation-ages";
import { findRegulationsUrl } from "@/lib/watcher/regulations-url";
import { relevantWindows, verifiedCategories } from "@/lib/catalog/llm-ages";
import { askJson, LlmUnavailable } from "@/lib/llm/anthropic";

const PAGE = 1000;
const PRICE_IN = 1;
const PRICE_OUT = 5;
const AGGREGATOR = /rideandrest\.net|odjazd\.pl|kalendarzrowerowy|sumator|eventivsport|radsport-events|granfondoguide|facebook\.com|instagram\.com/i;
const LINK_WORDS = /registr|anmeld|iscri|p[řr]ihl[aá][šs]|zapis|entry|enter|start ?list|startovn|propoz|regulation|ausschreibung|regolamento|regulamin|reglement|kategori|categor|klassen|results|ergebnis|vysledk|výsledk|risultati|wyniki|ticket|sportsoft|raceresult|racetime|datasport|endu|dostartu|sportident|timing|evenZo|\.pdf/i;

const DEADLINE_WORDS =
  /uz[aá]v[eě]rk|p[řr]ihl[aá][šs]k|registrac|anmeldeschluss|nennschluss|meldeschluss|anmeldung|iscrizion|zapisy|registration|entries close|deadline|online/gi;

/** The lines around words for entering and closing dates, a little of each. */
export function deadlineWindows(text: string, budget = 2500): string {
  const flat = text.replace(/[ \t]+/g, " ");
  let out = "";
  let last = -1;
  for (const m of flat.matchAll(DEADLINE_WORDS)) {
    const i = m.index ?? 0;
    if (i < last) continue;
    const a = Math.max(0, i - 150);
    const b = Math.min(flat.length, i + 250);
    out += `${flat.slice(a, b)}\n…\n`;
    last = b;
    if (out.length > budget) break;
  }
  return out.slice(0, budget);
}

export type Enrichment = {
  isThisRace: boolean;
  disciplines: { value: string; quote: string }[];
  categories: { name: string; quote: string }[];
  registrationUrl: string | null;
  regulationsUrl: string | null;
  /** When online entry closes, as the page says: ISO date and maybe a time. */
  entryCloses: { date: string; time: string | null; quote: string } | null;
};

type Link = { url: string; text: string };

/** The links on a page that may lead to entering, the regulations or the classes. */
export function candidateLinks(html: string, base: string): Link[] {
  const $ = cheerio.load(html);
  const out = new Map<string, Link>();
  $("a[href]").each((_, a) => {
    const raw = ($(a).attr("href") || "").trim();
    if (!raw || /^(mailto:|tel:|javascript:|#)/i.test(raw)) return;
    let url: string;
    try {
      url = new URL(raw, base).toString();
    } catch {
      return;
    }
    const text = $(a).text().replace(/\s+/g, " ").trim().slice(0, 80);
    if (!LINK_WORDS.test(`${text} ${url}`)) return;
    if (/facebook\.com|instagram\.com|youtube\.com|twitter\.com|linkedin\.com|wa\.me|whatsapp/i.test(url)) return;
    if (!out.has(url)) out.set(url, { url, text });
  });
  return [...out.values()].slice(0, 40);
}

const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
const unquote = (s: string) => s.replace(/^[„"“'«]+|[”"“'»]+$/g, "");

/** Keep only what the page really says: quotes found in the text, links found on the page. */
export function verifyEnrichment(
  raw: {
    is_this_race?: unknown;
    disciplines?: { value?: unknown; quote?: unknown }[];
    categories?: { name?: unknown; quote?: unknown }[];
    registration_url?: unknown;
    regulations_url?: unknown;
    entry_closes?: { date?: unknown; time?: unknown; quote?: unknown } | null;
  } | null,
  text: string,
  links: Link[],
): Enrichment {
  const empty: Enrichment = { isThisRace: false, disciplines: [], categories: [], registrationUrl: null, regulationsUrl: null, entryCloses: null };
  if (!raw) return empty;
  const hay = norm(text);
  const urls = new Set(links.map((l) => l.url));
  const disciplines: Enrichment["disciplines"] = [];
  for (const d of raw.disciplines ?? []) {
    if (typeof d.value !== "string" || typeof d.quote !== "string") continue;
    const v = d.value.trim().toLowerCase();
    const q = norm(unquote(d.quote));
    if (!(DISCIPLINES as readonly string[]).includes(v) || v === "other") continue;
    if (q.length >= 3 && hay.includes(q) && !disciplines.some((x) => x.value === v)) disciplines.push({ value: v, quote: d.quote });
  }
  const pick = (u: unknown) => (typeof u === "string" && urls.has(u) ? u : null);
  let entryCloses: Enrichment["entryCloses"] = null;
  const ec = raw.entry_closes;
  if (ec && typeof ec.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(ec.date) && typeof ec.quote === "string") {
    const q = norm(unquote(ec.quote));
    const day = String(Number(ec.date.slice(8, 10)));
    if (q.length >= 6 && hay.includes(q) && new RegExp(`(^|\\D)0?${day}(\\D|$)`).test(q)) {
      const time = typeof ec.time === "string" && /^\d{1,2}:\d{2}$/.test(ec.time) ? ec.time.padStart(5, "0") : null;
      entryCloses = { date: ec.date, time, quote: ec.quote };
    }
  }
  return {
    entryCloses,
    isThisRace: raw.is_this_race === true,
    disciplines,
    categories: verifiedCategories({ categories: raw.categories }, text),
    registrationUrl: pick(raw.registration_url),
    regulationsUrl: pick(raw.regulations_url),
  };
}

const SYSTEM =
  "You help catalogue cycling races from the organiser's own web pages. You get the race (name, date, place, what we hold) and text taken from its pages, plus a numbered list of links found on them. " +
  "Answer with JSON only, in exactly this shape: " +
  '{"is_this_race":true|false,"disciplines":[{"value":"<id>","quote":"<verbatim>"}],"categories":[{"name":"<class as written>","quote":"<verbatim>"}],"registration_url":"<one of the listed links or null>","regulations_url":"<one of the listed links or null>","entry_closes":{"date":"YYYY-MM-DD","time":"HH:MM or null","quote":"<verbatim>"} or null}. ' +
  "is_this_race is false when the text is about another race, a different year, a series overview that names no round matching this race, or something unrelated. " +
  "Discipline ids: xco (cross-country Olympic), xcc (short track), xce (eliminator), xcm (cross-country marathon / MTB marathon), mtb (other mountain bike), dh, enduro, gravel, road (road ride or race, generic), road_race, tt (time trial), criterium, hill_climb, gran_fondo (mass-start granfondo/marathon on road), cx (cyclocross / přespolní / Querfeldein / ciclocross / przełaj), track, bmx. " +
  "Give the discipline(s) this race is, each with a verbatim quote from the text that shows it. " +
  "categories: only classes this race states (age classes, sex classes, licence classes). registration_url: the link where a rider enters; regulations_url: the link to the regulations (propozice, Ausschreibung, regolamento). Use a link exactly as listed, or null; prefer the race's own regulations document (often a PDF) over a general page. " +
  "entry_closes: when ONLINE entry / registration closes for this race (uzávěrka přihlášek, Anmeldeschluss, Nennschluss, chiusura iscrizioni, zapisy do, registration closes), only if the text says it, with the quote that contains that date. Not the race date, not late entry on site. " +
  "Every quote must be copied exactly from the text, at most 120 characters. Never guess; leave a list empty rather than invent.";

async function askModel(
  race: { name: string; startDate: string; place: string | null; disciplines: string[]; website: string | null },
  text: string,
  links: Link[],
): Promise<{ raw: Parameters<typeof verifyEnrichment>[0]; tokensIn: number; tokensOut: number }> {
  const user =
    `Race: ${race.name}\nDate: ${race.startDate}\nPlace: ${race.place ?? "unknown"}\nWe currently hold discipline: ${race.disciplines.join(", ") || "none"}\n` +
    `Website: ${race.website ?? "none"}\n\nLinks:\n${links.map((l) => `${l.url}  [${l.text}]`).join("\n") || "(none)"}\n\nText:\n${text}`;
  const { json, usage } = await askJson<NonNullable<Parameters<typeof verifyEnrichment>[0]>>({ system: SYSTEM, user, maxTokens: 900, timeoutMs: 60_000 });
  return { raw: json, tokensIn: usage.tokensIn, tokensOut: usage.tokensOut };
}

export type EnrichResult = {
  attempted: number;
  notThisRace: number;
  ages: number;
  disciplinesSet: number;
  registration: number;
  regulations: number;
  deadlines: number;
  silent: number;
  failed: number;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
};

/**
 * One reading of a race's own pages by a language model, for what the pattern
 * readers cannot tell: the discipline, the classes, the entry and regulations
 * links, and whether the page is about this race at all.
 *
 * It is held to the page. Every discipline and class carries a quote that must
 * appear in the text, a link must be one that was on the page, and a page the
 * model says is not about this race gives nothing. Where the model's
 * discipline disagrees with the one we hold, nothing is changed: the case is
 * written to the review file.
 */
export async function enrichFromPages(opts?: {
  max?: number;
  /** Last season instead of the coming one: what it states carries to this year's edition. */
  past?: boolean;
  dryRun?: boolean;
  ids?: string[];
  fixDisciplines?: boolean;
  reviewFile?: string;
  log?: (line: string) => void;
}): Promise<EnrichResult> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 60;
  const today = new Date().toISOString().slice(0, 10);
  const skip = await recentlyProbed(supabase, "llm_v2");
  type Target = {
    id: string; name: string; startDate: string; place: string | null; web: string | null; regs: string | null;
    disciplines: string[]; existing: string[]; ageConfidence: string | null; registrationUrl: string | null; regulationsUrl: string | null; closesAt: string | null;
  };
  const targets: Target[] = [];
  for (let from = 0; targets.length < max; from += PAGE) {
    let q = supabase
      .from("events")
      .select("id, name, start_date, website_url, registration_url, regulations_url, registration_closes_at, disciplines, age_categories, age_confidence, location:locations(municipality)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .in("status", opts?.past ? [...ACTIVE_EVENT_STATUSES, "completed"] : [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", opts?.past ? new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10) : today)
      .lt("start_date", opts?.past ? today : "9999-12-31")
      .not("website_url", "is", null)
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (opts?.ids?.length) q = q.in("id", opts.ids);
    const { data } = await q;
    const rows = (data ?? []) as unknown as {
      id: string; name: string; start_date: string; website_url: string | null; registration_url: string | null; regulations_url: string | null; registration_closes_at: string | null;
      disciplines: string[] | null; age_categories: string[] | null; age_confidence: string | null; location: { municipality: string | null } | null;
    }[];
    for (const r of rows) {
      if (skip.has(r.id) && !opts?.ids?.length) continue;
      if (!r.website_url || AGGREGATOR.test(r.website_url)) continue;
      // Worth a look only if something is missing or only a guess.
      const needs = opts?.past
        ? r.age_confidence !== "explicit" || !(r.disciplines ?? []).length
        : r.age_confidence !== "explicit" || !(r.disciplines ?? []).length || !r.registration_url || !r.regulations_url || !r.registration_closes_at;
      if (!needs && !opts?.ids?.length) continue;
      targets.push({
        id: r.id, name: r.name, startDate: r.start_date, place: r.location?.municipality ?? null, web: r.website_url, regs: r.regulations_url,
        disciplines: r.disciplines ?? [], existing: r.age_categories ?? [], ageConfidence: r.age_confidence,
        registrationUrl: r.registration_url, regulationsUrl: r.regulations_url, closesAt: r.registration_closes_at,
      });
      if (targets.length >= max) break;
    }
    if (rows.length < PAGE) break;
  }

  const result: EnrichResult = { attempted: targets.length, notThisRace: 0, ages: 0, disciplinesSet: 0, registration: 0, regulations: 0, deadlines: 0, silent: 0, failed: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
  const review: string[] = ["kind\tdate\trace\tholds\tmodel says\tevidence"];
  let stop = false;
  const deadlines = new Map<string, { t: Target; date: string; time: string | null; quote: string }>();
  const one = async (t: Target) => {
    if (stop) return;
    try {
      const hints = hintsFor(t.name, t.startDate, t.place);
      const queue = [t.web, t.regs].filter((u): u is string => Boolean(u)).map(directDocumentUrl);
      const seen = new Set<string>();
      let text = "";
      let intro = "";
      const links: Link[] = [];
      while (queue.length && seen.size < 5) {
        const url = queue.shift()!;
        if (seen.has(url)) continue;
        seen.add(url);
        const doc = await readDocument(url).catch(() => null);
        if (!doc) continue;
        const flat = doc.text.replace(/\s+/g, " ").trim();
        if (!intro) intro = `--- ${url}\n${flat.slice(0, 2500)}\n`;
        const part = relevantWindows(doc.text, 5000) + deadlineWindows(doc.text);
        if (part.length > 200) text += `\n--- ${url}\n${part}`;
        if (doc.html) {
          for (const l of candidateLinks(doc.html, url)) if (!links.some((x) => x.url === l.url)) links.push(l);
          const related = relatedDocumentLinks(doc.html, url, hints);
          const regs = related.some((r) => r.near) ? null : findRegulationsUrl(url, doc.html);
          for (const link of [...(regs ? [directDocumentUrl(regs)] : []), ...related.map((r) => r.url)]) if (!seen.has(link)) queue.push(link);
        }
        if (text.length > 12_000) break;
      }
      const all = `${intro}${text}`.slice(0, 16_000);
      if (all.length < 300) {
        result.silent += 1;
        if (!opts?.dryRun) await recordProbe(supabase, t.id, "llm_v2", "silent");
        return;
      }
      const { raw, tokensIn, tokensOut } = await askModel({ name: t.name, startDate: t.startDate, place: t.place, disciplines: t.disciplines, website: t.web }, all, links.slice(0, 40));
      result.tokensIn += tokensIn;
      result.tokensOut += tokensOut;
      result.costUsd = (result.tokensIn * PRICE_IN + result.tokensOut * PRICE_OUT) / 1_000_000;
      const v = verifyEnrichment(raw, all, links);
      if (!v.isThisRace) {
        result.notThisRace += 1;
        review.push(`not-this-race\t${t.startDate}\t${t.name}\t${t.web}\t\t`);
        opts?.log?.(`SKIP ${t.startDate}  ${t.name}  — the page is not about this race (${t.web})`);
        if (!opts?.dryRun) await recordProbe(supabase, t.id, "llm_v2", "silent");
        return;
      }
      const patch: Record<string, unknown> = {};
      const notes: string[] = [];

      if (t.ageConfidence !== "explicit") {
        const ages = new Set<AgeCategory>(ageCategoriesFromList(v.categories.map((c) => ({ name: c.name })), { refYear: Number(t.startDate.slice(0, 4)) }));
        const specific = [...ages].filter((a) => !["kids", "youth"].includes(a)).length;
        if (specific >= 2 && !CHAMPIONSHIP.test(t.name)) {
          if (![...ages].some((a) => ["junior", "u23", "elite", "amateur", "masters"].includes(a))) t.existing.forEach((a) => ages.add(a as AgeCategory));
          const ordered = AGE_CATEGORIES.filter((a) => ages.has(a));
          patch.age_categories = ordered;
          patch.age_confidence = "explicit";
          patch.audience = audienceFromAgeCategories(ordered);
          notes.push(`ages ${ordered.join(",")}  „${v.categories[0]?.quote}“`);
          result.ages += 1;
        }
      }

      const found = v.disciplines.map((d) => d.value);
      if (found.length) {
        if (!t.disciplines.length) {
          patch.disciplines = found;
          notes.push(`discipline ${found.join(",")}  „${v.disciplines[0]!.quote}“`);
          result.disciplinesSet += 1;
        } else if (!found.some((f) => t.disciplines.includes(f))) {
          review.push(`discipline\t${t.startDate}\t${t.name}\t${t.disciplines.join(",")}\t${found.join(",")}\t${v.disciplines[0]!.quote.replace(/\s+/g, " ")}`);
          if (opts?.fixDisciplines) {
            patch.disciplines = found;
            notes.push(`discipline ${t.disciplines.join(",")} → ${found.join(",")}  „${v.disciplines[0]!.quote}“`);
            result.disciplinesSet += 1;
          }
        }
      }
      if (v.registrationUrl && !t.registrationUrl) {
        patch.registration_url = v.registrationUrl;
        notes.push(`registration ${v.registrationUrl}`);
        result.registration += 1;
      }
      if (v.regulationsUrl && !t.regulationsUrl) {
        patch.regulations_url = v.regulationsUrl;
        notes.push(`regulations ${v.regulationsUrl}`);
        result.regulations += 1;
      }

      // Written after the whole batch: a quote two races share is a hub
      // page's window, not this race's own.
      if (!opts?.past && v.entryCloses && !t.closesAt && v.entryCloses.date <= t.startDate) deadlines.set(t.id, { t, ...v.entryCloses });

      if (!Object.keys(patch).length) {
        result.silent += 1;
        if (!opts?.dryRun) await recordProbe(supabase, t.id, "llm_v2", "silent");
        return;
      }
      opts?.log?.(`${opts?.dryRun ? "DRY" : "SET"}  ${t.startDate}  ${t.name}\n      ${notes.join("\n      ")}`);
      if (opts?.dryRun) return;
      patch.updated_at = new Date().toISOString();
      const { error } = await supabase.from("events").update(patch).eq("id", t.id);
      if (error) {
        result.failed += 1;
        await recordProbe(supabase, t.id, "llm_v2", "failed");
      } else await recordProbe(supabase, t.id, "llm_v2", "silent");
    } catch (e) {
      result.failed += 1;
      opts?.log?.(`FAIL ${t.name}: ${e instanceof Error ? e.message : e}`);
      if (e instanceof LlmUnavailable) {
        stop = true;
        return;
      }
      if (!opts?.dryRun) await recordProbe(supabase, t.id, "llm_v2", "failed");
    }
  };
  const { mapPool } = await import("@/lib/watcher/pool");
  await mapPool(targets, 4, one);
  const quoteCount = new Map<string, number>();
  for (const d of deadlines.values()) quoteCount.set(norm(d.quote), (quoteCount.get(norm(d.quote)) ?? 0) + 1);
  for (const d of deadlines.values()) {
    const line = `${d.t.startDate}  ${d.t.name}  entry closes ${d.date}${d.time ? ` ${d.time}` : ""}  „${d.quote}“`;
    if ((quoteCount.get(norm(d.quote)) ?? 0) > 1) {
      review.push(`shared-deadline\t${d.t.startDate}\t${d.t.name}\t\t${d.date}\t${d.quote}`);
      opts?.log?.(`SKIP ${line}  — the same window is quoted for another race`);
      continue;
    }
    result.deadlines += 1;
    opts?.log?.(`${opts?.dryRun ? "DRY" : "SET"}  ${line}`);
    if (opts?.dryRun) continue;
    await supabase
      .from("events")
      .update({ registration_closes_at: `${d.date}T${d.time ?? "00:00"}:00+00:00`, updated_at: new Date().toISOString() })
      .eq("id", d.t.id)
      .is("registration_closes_at", null);
  }
  if (opts?.reviewFile && review.length > 1) writeFileSync(opts.reviewFile, review.join("\n") + "\n");
  return result;
}
