import * as cheerio from "cheerio";
import { createServerSupabase } from "@/lib/supabase/server";
import { clearProbe, recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { ageCategoriesFromList } from "@/lib/age-bands";
import { audienceFromAgeCategories, type AgeCategory } from "@/lib/taxonomy";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { BOT_UA } from "@/lib/watcher/http";
import { findRegulationsUrl, isRegulationsUrl } from "@/lib/watcher/regulations-url";

const PAGE = 1000;
const MAX_BYTES = 8 * 1024 * 1024;

/** Where a regulations text names who may start. */
const CATEGORY_HEAD =
  /kategori[eíiay]|kategór|categor(?:y|ies|ie|ia|ías|ias)|klassen|altersklass|wertungsklass|klasy|klasyfikac/gi;

/**
 * The classes a regulations text names, read from next to the word
 * "kategorie" (or its cousins) — "pro kategorie žáci, žákyně, kadeti,
 * kadetky", "Klassen: U11, U13, Hobby". The window is short and stops at a
 * blank line, so a sentence about prize money three paragraphs down is not
 * read as a class.
 */
export function categoriesFromRegulationsText(
  text: string,
  refYear?: number,
): { ages: AgeCategory[]; quote: string } {
  const clean = text.replace(/\r/g, "").replace(/[ \t ]+/g, " ");
  const tokens: string[] = [];
  const quotes: string[] = [];
  for (const m of clean.matchAll(CATEGORY_HEAD)) {
    const start = m.index ?? 0;
    let window = clean.slice(start, start + 320);
    const stop = window.search(/\n\s*\n/);
    if (stop > 0) window = window.slice(0, stop);
    quotes.push(window.replace(/\s+/g, " ").trim());
    for (const part of window.split(/[,;\n+/()•·|]|\s(?:a|i|und|and|oraz|et|e|y)\s|\s[–-]\s(?=\p{L})/u)) {
      const t = part.trim();
      // A class is named in a few words; a sentence that happens to hold
      // "6 let" or "ženy" is prose, not a list.
      if (t && t.length <= 32) tokens.push(t);
    }
  }
  const ages = ageCategoriesFromList(tokens.map((name) => ({ name })), { refYear });
  return { ages, quote: quotes.slice(0, 3).join(" … ").slice(0, 400) };
}

/** Bands that say something on their own, beyond the umbrella chips. */
function specificBands(ages: AgeCategory[]): number {
  return ages.filter((a) => a !== "kids" && a !== "youth").length;
}

async function fetchBytes(url: string): Promise<{ type: string; bytes: Uint8Array } | null> {
  const res = await fetch(url, {
    headers: { "user-agent": BOT_UA, accept: "text/html,application/pdf,*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) return null;
  return { type: (res.headers.get("content-type") ?? "").toLowerCase(), bytes: buf };
}

function isPdf(type: string, bytes: Uint8Array, url: string): boolean {
  return (
    type.includes("pdf") ||
    /\.pdf(\?|$)/i.test(url) ||
    (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)
  );
}

async function pdfText(bytes: Uint8Array): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  return (Array.isArray(text) ? text : [text]).join("\n\n");
}

function htmlText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, header, footer").remove();
  $("br").replaceWith("\n");
  $("p, div, li, tr, h1, h2, h3, h4, h5, h6, section, article, table").each((_, el) => {
    $(el).append("\n");
  });
  return $("body").text();
}

/** Read one document; for a web page, also where its regulations link goes. */
async function readDocument(url: string): Promise<{ text: string; regulationsUrl: string | null } | null> {
  const doc = await fetchBytes(url);
  if (!doc) return null;
  if (isPdf(doc.type, doc.bytes, url)) return { text: await pdfText(doc.bytes), regulationsUrl: null };
  const html = new TextDecoder("utf-8").decode(doc.bytes);
  return { text: htmlText(html), regulationsUrl: findRegulationsUrl(url, html) };
}

/**
 * Read the categories a race's own regulations state.
 *
 * Most organisers never fill a category field anywhere we can reach — but
 * almost all of them publish propozice, and the propozice say who may start.
 * This reads them: the regulations link we hold, or the one on the race's own
 * page, PDF or HTML, and the classes named next to "kategorie".
 *
 * It asks for at least two specific bands before it believes a text, and
 * never touches a race whose categories a source already stated.
 */
export async function fillRegulationAgeCategories(opts?: {
  max?: number;
  dryRun?: boolean;
  countries?: string[];
  log?: (line: string) => void;
}): Promise<{ attempted: number; filled: number; silent: number; failed: number }> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 60;
  const today = new Date().toISOString().slice(0, 10);
  const skip = await recentlyProbed(supabase, "regs_ages");

  type Target = { id: string; name: string; startDate: string; regulationsUrl: string | null; websiteUrl: string | null };
  const targets: Target[] = [];
  for (let from = 0; targets.length < max; from += PAGE) {
    let query = supabase
      .from("events")
      .select("id, name, start_date, regulations_url, website_url, location:locations!inner(country_code)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today)
      .or("age_categories.is.null,age_categories.eq.{},age_confidence.is.null,age_confidence.eq.default")
      .or("regulations_url.not.is.null,website_url.not.is.null")
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (opts?.countries?.length) query = query.in("location.country_code", opts.countries);
    const { data } = await query;
    const rows = (data ?? []) as unknown as {
      id: string;
      name: string;
      start_date: string;
      regulations_url: string | null;
      website_url: string | null;
    }[];
    for (const row of rows) {
      if (skip.has(row.id)) continue;
      targets.push({
        id: row.id,
        name: row.name,
        startDate: row.start_date,
        regulationsUrl: isRegulationsUrl(row.regulations_url) ? row.regulations_url : null,
        websiteUrl: row.website_url,
      });
      if (targets.length >= max) break;
    }
    if (rows.length < PAGE) break;
  }

  const result = { attempted: targets.length, filled: 0, silent: 0, failed: 0 };
  const { mapPool } = await import("@/lib/watcher/pool");
  await mapPool(targets, 4, async (target) => {
    try {
      const year = Number(target.startDate.slice(0, 4));
      let found: { ages: AgeCategory[]; quote: string; from: string } | null = null;
      let regulationsUrl = target.regulationsUrl;
      // The race page first when there is no regulations link: it may carry
      // the categories itself, or the link to the propozice.
      if (!regulationsUrl && target.websiteUrl) {
        const page = await readDocument(target.websiteUrl).catch(() => null);
        if (page) {
          const read = categoriesFromRegulationsText(page.text, year);
          if (specificBands(read.ages) >= 2) found = { ...read, from: target.websiteUrl };
          regulationsUrl = page.regulationsUrl;
        }
      }
      if (!found && regulationsUrl) {
        const doc = await readDocument(regulationsUrl).catch(() => null);
        if (doc) {
          const read = categoriesFromRegulationsText(doc.text, year);
          if (specificBands(read.ages) >= 2) found = { ...read, from: regulationsUrl };
        }
      }
      if (!found) {
        result.silent += 1;
        if (!opts?.dryRun) await recordProbe(supabase, target.id, "regs_ages", "silent");
        return;
      }
      opts?.log?.(
        `${opts?.dryRun ? "DRY" : "SET"}  ${target.startDate}  ${target.name}  → ${found.ages.join(", ")}\n      ${found.from}\n      „${found.quote}“`,
      );
      if (opts?.dryRun) {
        result.filled += 1;
        return;
      }
      const { error } = await supabase
        .from("events")
        .update({
          age_categories: found.ages,
          age_confidence: "explicit",
          audience: audienceFromAgeCategories(found.ages),
          updated_at: new Date().toISOString(),
        })
        .eq("id", target.id);
      if (error) {
        result.failed += 1;
        await recordProbe(supabase, target.id, "regs_ages", "failed");
      } else {
        result.filled += 1;
        await clearProbe(supabase, target.id, "regs_ages");
      }
    } catch {
      result.failed += 1;
      if (!opts?.dryRun) await recordProbe(supabase, target.id, "regs_ages", "failed");
    }
  });
  return result;
}
