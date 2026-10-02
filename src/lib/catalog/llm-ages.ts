import { createServerSupabase } from "@/lib/supabase/server";
import { clearProbe, recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { ageCategoriesFromList } from "@/lib/age-bands";
import { AGE_CATEGORIES, audienceFromAgeCategories, type AgeCategory } from "@/lib/taxonomy";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { isRegulationsUrl, findRegulationsUrl } from "@/lib/watcher/regulations-url";
import { CHAMPIONSHIP, directDocumentUrl, hintsFor, readDocument, relatedDocumentLinks } from "@/lib/catalog/regulation-ages";

const PAGE = 1000;
const MODEL = "claude-haiku-4-5-20251001";
/** Haiku 4.5, dollars per million tokens. */
const PRICE_IN = 1;
const PRICE_OUT = 5;
const MAX_CHARS = 14_000;

/** Where a page talks about who may start. */
const AGE_WORDS =
  /kategori|categor|klassen|altersklass|jahrgang|jg\.|ro[čc]n[ií]k|rocznik|klasy|born|geboren|nato|nata|anno di nascita|\bU\s?\d{1,2}\b|\bu\d{2}\b|junior|master|elite|[žz][aá]ci|d[ěe]ti|kids|youth|giovanissimi|esordienti|allievi|juniores|amatori|veterani|seniores/i;

/**
 * The stretches of a text that talk about classes, with a little around each,
 * so the model is shown a few thousand characters, not a whole regulation.
 */
export function relevantWindows(text: string, budget = MAX_CHARS): string {
  const flat = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  const spans: [number, number][] = [];
  const re = new RegExp(AGE_WORDS.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(flat))) {
    const a = Math.max(0, m.index - 350);
    const b = Math.min(flat.length, m.index + 650);
    const last = spans[spans.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else spans.push([a, b]);
    if (spans.reduce((n, [x, y]) => n + (y - x), 0) > budget * 2) break;
  }
  let out = "";
  for (const [a, b] of spans) {
    if (out.length >= budget) break;
    out += `${flat.slice(a, b)}\n…\n`;
  }
  return out.slice(0, budget);
}

const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();

/** Only categories whose quote is really in the text count. */
export function verifiedCategories(
  answer: { categories?: { name?: unknown; quote?: unknown }[] },
  text: string,
): { name: string; quote: string }[] {
  const hay = norm(text);
  const out: { name: string; quote: string }[] = [];
  for (const c of answer.categories ?? []) {
    if (typeof c.name !== "string" || typeof c.quote !== "string") continue;
    const q = norm(c.quote.replace(/^[„"“'«]+|[”"“'»]+$/g, ""));
    if (q.length < 3 || q.length > 200) continue;
    if (hay.includes(q)) out.push({ name: c.name.trim(), quote: c.quote.trim() });
  }
  return out;
}

type ModelAnswer = { categories?: { name?: unknown; quote?: unknown }[] };

export async function askModel(
  race: { name: string; startDate: string; place: string | null },
  text: string,
): Promise<{ answer: ModelAnswer | null; tokensIn: number; tokensOut: number }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set");
  const system =
    "You read cycling race web pages and regulations and extract the rider categories (age or competition classes) that THIS race states. " +
    "Answer with JSON only: {\"categories\":[{\"name\":\"<class name as written>\",\"quote\":\"<verbatim text copied from the page, at most 120 characters, containing the class>\"}]}. " +
    "Rules: list only classes the text says this race has. Do not use other races, other years, federation-wide rules for other events, or prizes. " +
    "Copy the quote exactly, character for character. If the text states no classes for this race, answer {\"categories\":[]}. Never guess.";
  const user = `Race: ${race.name}\nDate: ${race.startDate}\nPlace: ${race.place ?? "unknown"}\n\nText:\n${text}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 700, system, messages: [{ role: "user", content: user }] }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { content?: { type: string; text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
  const raw = (body.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  let answer: ModelAnswer | null = null;
  try {
    answer = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as ModelAnswer;
  } catch {
    answer = null;
  }
  return { answer, tokensIn: body.usage?.input_tokens ?? 0, tokensOut: body.usage?.output_tokens ?? 0 };
}

/**
 * Read the classes a race states with a language model, for the races the
 * pattern readers could not read: prose, tables, other languages.
 *
 * The model must quote the page for every class, and a class whose quote is not
 * in the text is thrown away. A race is only given a list if at least two
 * distinct bands survive, the same bar as the pattern reader.
 */
export async function fillAgesWithModel(opts?: {
  max?: number;
  dryRun?: boolean;
  ids?: string[];
  log?: (line: string) => void;
}): Promise<{ attempted: number; filled: number; silent: number; failed: number; tokensIn: number; tokensOut: number; costUsd: number }> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 40;
  const today = new Date().toISOString().slice(0, 10);
  const skip = await recentlyProbed(supabase, "llm_ages");

  type Target = { id: string; name: string; startDate: string; regs: string | null; web: string | null; place: string | null; existing: string[] };
  const targets: Target[] = [];
  for (let from = 0; targets.length < max; from += PAGE) {
    let q = supabase
      .from("events")
      .select("id, name, start_date, regulations_url, website_url, age_categories, location:locations(municipality)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today)
      .or("age_categories.is.null,age_categories.eq.{},age_confidence.is.null,age_confidence.eq.default,age_confidence.eq.previous")
      .or("regulations_url.not.is.null,website_url.not.is.null")
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (opts?.ids?.length) q = q.in("id", opts.ids);
    const { data } = await q;
    const rows = (data ?? []) as unknown as {
      id: string; name: string; start_date: string; regulations_url: string | null; website_url: string | null; age_categories: string[] | null; location: { municipality: string | null } | null;
    }[];
    for (const r of rows) {
      if (skip.has(r.id) && !opts?.ids?.length) continue;
      if (CHAMPIONSHIP.test(r.name)) continue;
      // An aggregator's page lists many races; it cannot state this one's classes.
      const web = r.website_url && !/rideandrest\.net|odjazd\.pl|kalendarzrowerowy|sumator|eventivsport|radsport-events|granfondoguide/i.test(r.website_url) ? r.website_url : null;
      const regs = isRegulationsUrl(r.regulations_url) ? r.regulations_url : null;
      if (!web && !regs) continue;
      targets.push({ id: r.id, name: r.name, startDate: r.start_date, regs, web, place: r.location?.municipality ?? null, existing: r.age_categories ?? [] });
      if (targets.length >= max) break;
    }
    if (rows.length < PAGE) break;
  }

  const result = { attempted: targets.length, filled: 0, silent: 0, failed: 0, tokensIn: 0, tokensOut: 0, costUsd: 0 };
  for (const t of targets) {
    try {
      const hints = hintsFor(t.name, t.startDate, t.place);
      const queue = [t.web, t.regs].filter((u): u is string => Boolean(u)).map(directDocumentUrl);
      const seen = new Set<string>();
      let text = "";
      while (queue.length && seen.size < 5 && text.length < MAX_CHARS) {
        const url = queue.shift()!;
        if (seen.has(url)) continue;
        seen.add(url);
        const doc = await readDocument(url).catch(() => null);
        if (!doc) continue;
        const part = relevantWindows(doc.text, Math.min(6000, MAX_CHARS - text.length));
        if (part.length > 200) text += `\n--- ${url}\n${part}`;
        if (doc.html) {
          const related = relatedDocumentLinks(doc.html, url, hints);
          const regs = related.some((r) => r.near) ? null : findRegulationsUrl(url, doc.html);
          for (const link of [...(regs ? [directDocumentUrl(regs)] : []), ...related.map((r) => r.url)]) if (!seen.has(link)) queue.push(link);
        }
      }
      if (text.length < 300) {
        result.silent += 1;
        if (!opts?.dryRun) await recordProbe(supabase, t.id, "llm_ages", "silent");
        continue;
      }
      const { answer, tokensIn, tokensOut } = await askModel({ name: t.name, startDate: t.startDate, place: t.place }, text);
      result.tokensIn += tokensIn;
      result.tokensOut += tokensOut;
      result.costUsd = (result.tokensIn * PRICE_IN + result.tokensOut * PRICE_OUT) / 1_000_000;
      const good = answer ? verifiedCategories(answer, text) : [];
      const ages = new Set<AgeCategory>(ageCategoriesFromList(good.map((c) => ({ name: c.quote })), { refYear: Number(t.startDate.slice(0, 4)) }));
      const specific = [...ages].filter((a) => !["kids", "youth"].includes(a)).length;
      if (specific < 2) {
        result.silent += 1;
        if (!opts?.dryRun) await recordProbe(supabase, t.id, "llm_ages", "silent");
        continue;
      }
      // Only children's classes: add them to what we had, as the pattern reader does.
      if (![...ages].some((a) => ["junior", "u23", "elite", "amateur", "masters"].includes(a))) t.existing.forEach((a) => ages.add(a as AgeCategory));
      const ordered = AGE_CATEGORIES.filter((a) => ages.has(a));
      opts?.log?.(`${opts?.dryRun ? "DRY" : "SET"}  ${t.startDate}  ${t.name}  → ${ordered.join(", ")}\n      ${good.map((c) => `„${c.quote}“`).slice(0, 3).join("  ")}`);
      result.filled += 1;
      if (opts?.dryRun) continue;
      const { error } = await supabase
        .from("events")
        .update({ age_categories: ordered, age_confidence: "explicit", audience: audienceFromAgeCategories(ordered), updated_at: new Date().toISOString() })
        .eq("id", t.id);
      if (error) {
        result.failed += 1;
        await recordProbe(supabase, t.id, "llm_ages", "failed");
      } else await clearProbe(supabase, t.id, "llm_ages");
    } catch (e) {
      result.failed += 1;
      opts?.log?.(`FAIL ${t.name}: ${e instanceof Error ? e.message : e}`);
      if (e instanceof Error && /ANTHROPIC_API_KEY|credit balance|API 4(00|01|03|29)/.test(e.message)) break;
      if (!opts?.dryRun) await recordProbe(supabase, t.id, "llm_ages", "failed");
    }
  }
  return result;
}
