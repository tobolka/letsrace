import * as cheerio from "cheerio";
import { createServerSupabase } from "@/lib/supabase/server";
import { clearProbe, recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { ageCategoriesFromList } from "@/lib/age-bands";
import { audienceFromAgeCategories, type AgeCategory } from "@/lib/taxonomy";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { findRegulationsUrl, isRegulationsUrl } from "@/lib/watcher/regulations-url";
import { linkLabel } from "@/lib/watcher/link-label";
import { fetchBot } from "@/lib/http/fetch";

const PAGE = 1000;
const MAX_BYTES = 8 * 1024 * 1024;

/** Where a regulations text names who may start. */
const CATEGORY_HEAD =
  /kategori[eíiay]|kategór|categor(?:y|ies|ie|ia|ías|ias)|klassen|altersklass|wertungsklass|klasy|klasyfikac/gi;

export const CHAMPIONSHIP =
  /\bm[čc]r\b|mistrovstv[ií]\s+(česk|čr|cr)|majstrovstv[áa]\s+(slovensk|sr)|mistrzostwa\s+polski|deutsche\s+meisterschaft|national\s+championship|campionato\s+italiano|world\s+cup|weltcup|uci\s/i;

/** Where a regulations document moves on from the classes to something else. */
const NEXT_SECTION =
  /\n\s*(program|harmonogram|startovn|startovné|ceny|cenov|prezentace|tra[tť]|kontakt|po[řr]adatel|registrace|p[řr]ihl[aá][šs]k|v[ýy]sledk|ubytov|parkov|ob[čc]erstv|startgeld|nenngeld|anmeld|siegerehrung|zeitplan|preise|iscrizion|premi|programma|wpisowe|nagrody|zapisy|biuro)/i;

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
    // Long enough for a full class list (a kids' cup lists a dozen), cut
    // at the next section of the document rather than at the first blank
    // line: PDFs put a blank line between every class.
    let window = clean.slice(start, start + 1200);
    const stop = window.slice(20).search(NEXT_SECTION);
    if (stop >= 0) window = window.slice(0, stop + 20);
    const gap = window.search(/\n\s*\n\s*\n/);
    if (gap > 0) window = window.slice(0, gap);
    quotes.push(window.replace(/\s+/g, " ").trim());
    for (const part of window.split(/[,;\n+/()•·|]|\s(?:a|i|und|and|oraz|et|e|y)\s|\s[–-]\s(?=\p{L})/u)) {
      const t = part.trim();
      // A class is named in a few words; a sentence that happens to hold
      // "6 let" or "ženy" is prose, not a list.
      if (t && t.length <= 32) tokens.push(t);
    }
  }
  // Registration platforms give each class an age field instead of a list:
  // dostartu's "Wiek 0-7", a German "Alter: 13–14". Every one is a class.
  for (const m of clean.matchAll(/(?:wiek|v[ěe]k|alter|age)\s*:?\s*\n?\s*(\d{1,2})\s*[-–]\s*(\d{1,2})(?!\d)/gi)) {
    tokens.push(`${m[1]}-${m[2]} let`);
    if (!quotes.length) quotes.push(m[0].replace(/\s+/g, " "));
  }
  for (const m of clean.matchAll(/(?:wiek|v[ěe]k|alter|age)\s*:?\s*\n?\s*(\d{1,2})\s*\+/gi)) {
    tokens.push(`${m[1]} a více`);
  }
  const ages = ageCategoriesFromList(tokens.map((name) => ({ name })), { refYear });
  return { ages, quote: quotes.slice(0, 3).join(" … ").slice(0, 400) };
}

/** Bands that say something on their own, beyond the umbrella chips. */
function specificBands(ages: AgeCategory[]): number {
  return ages.filter((a) => a !== "kids" && a !== "youth").length;
}

async function fetchBytes(url: string, requestedMaxBytes = MAX_BYTES): Promise<{ type: string; bytes: Uint8Array } | null> {
  const maxBytes = Number.isFinite(requestedMaxBytes) ? Math.min(16 * 1024 * 1024, Math.max(1, requestedMaxBytes)) : MAX_BYTES;
  const res = await fetchBot(url, { headers: { accept: "text/html,application/pdf,*/*" } });
  if (!res.ok) return null;
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > maxBytes) { await res.body?.cancel(); return null; }
  if (!res.body) return null;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); return null; }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buf = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { buf.set(chunk, offset); offset += chunk.byteLength; }
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
  // Broken embedded fonts make pdf.js print one "Warning:" line per glyph.
  // The text still extracts; only real failures should reach the log.
  const pdf = await getDocumentProxy(bytes, { verbosity: 0 });
  const { text } = await extractText(pdf, { mergePages: false });
  return (Array.isArray(text) ? text : [text]).join("\n\n");
}

export function htmlText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, nav, header, footer").remove();
  $("br").replaceWith("\n");
  // Keep table columns separate: U15 and a birth-year cell must not become
  // "U152012-2013". Preserve each complete row for admission extraction.
  $("td, th").append(" | ");
  $("p, div, li, tr, h1, h2, h3, h4, h5, h6, section, article, table").each((_, el) => {
    $(el).append("\n");
  });
  return $("body").text();
}

/** A Drive or Docs viewer link, turned into the file itself. */
export function directDocumentUrl(url: string): string {
  try {
    const viewer = new URL(url);
    const source = viewer.searchParams.get("url");
    if (viewer.hostname === "docs.google.com" && /^\/(?:viewer|gview)$/.test(viewer.pathname) && source) {
      const document = new URL(source);
      if (/^https?:$/.test(document.protocol)) return document.toString();
    }
  } catch { /* Not a usable public document viewer. */ }
  const file = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([A-Za-z0-9_-]{10,})/);
  if (file) return `https://drive.google.com/uc?export=download&id=${file[1]}`;
  const doc = url.match(/docs\.google\.com\/document\/d\/([A-Za-z0-9_-]{10,})/);
  if (doc) return `https://docs.google.com/document/d/${doc[1]}/export?format=txt`;
  return url;
}

const LINK_WORDS =
  /propozic|pravidl|technical\s*guide|kategori|ausschreib|regulamin|r[eè]glement|rozpis|regolamento|bulletin|pokyny|klassen|info\s*(o|zum|about)/i;
const LINK_SKIP =
  /facebook|instagram|youtube|strava|komoot|wa\.me|mailto:|tel:|v[ýy]sledk|results|ergebnis|galerie|gallery|foto|photo|gdpr|cookie|privacy/i;

/**
 * Links on a race page worth reading for its classes: the propozice (often a
 * PDF, often on Google Drive), a "Kategorie" page. On a series page that lists
 * several races, the link next to this race's name, town or date wins — VKCT
 * keeps every round on one page, each with its own "(propozice)".
 */
export function relatedDocumentLinks(
  html: string,
  pageUrl: string,
  hints: string[],
): { url: string; near: boolean }[] {
  const $ = cheerio.load(html);
  const host = (() => {
    try {
      return new URL(pageUrl).hostname;
    } catch {
      return "";
    }
  })();
  const fold = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const foldedHints = hints.map(fold).filter((h) => h.length >= 3);
  const found: { url: string; score: number }[] = [];
  $("a[href]").each((_, a) => {
    const href = ($(a).attr("href") || "").trim();
    if (!href || href.startsWith("#")) return;
    let abs: string;
    try {
      abs = new URL(href, pageUrl).toString();
    } catch {
      return;
    }
    const text = linkLabel($(a));
    const around = $(a).parent().text().replace(/\s+/g, " ").trim().slice(0, 240);
    const blob = `${text} ${abs}`;
    if (LINK_SKIP.test(blob)) return;
    const isDoc = /\.pdf(\?|$)/i.test(abs) || /drive\.google\.com|docs\.google\.com/i.test(abs);
    const wordy = LINK_WORDS.test(blob);
    if (!isDoc && !wordy) return;
    let sameSite = false;
    try {
      sameSite = new URL(abs).hostname === host;
    } catch {
      /* ignore */
    }
    if (!isDoc && !sameSite && $(a).attr("data-catalog-external-info") !== "true") return;
    const near = foldedHints.some((h) => fold(around).includes(h) || fold(text).includes(h));
    found.push({ url: directDocumentUrl(abs), score: (near ? 6 : 0) + (wordy ? 3 : 0) + (isDoc ? 2 : 0) });
  });
  // A page with many documents is a series page: then only the ones next to
  // this race count.
  const docs = found.filter((f) => f.score > 0);
  // When any link sits next to this race, only those count: the rest belong
  // to the other rounds on the page. Otherwise a page with many documents is
  // someone else's list, and a page with a few is this race's.
  const near = docs.filter((f) => f.score >= 6);
  const pick = near.length ? near : docs.length > 4 ? [] : docs;
  return [...new Map(pick.sort((a, b) => b.score - a.score).map((f) => [f.url, f])).values()]
    .slice(0, 4)
    .map((f) => ({ url: f.url, near: f.score >= 6 }));
}

/** Word, RTF or OpenDocument: propozice are often a .doc on the club's site. */
function isOfficeDocument(type: string, bytes: Uint8Array, url: string): boolean {
  if (/msword|officedocument\.wordprocessing|rtf|opendocument\.text/i.test(type)) return true;
  if (/\.(docx?|rtf|odt)(\?|$)/i.test(url)) return true;
  // The old binary Word header.
  return bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
}

/**
 * Text of an office document, through macOS `textutil` where the reader runs
 * on a Mac; elsewhere nothing (a garbled byte dump is worse than no text).
 */
async function officeText(bytes: Uint8Array, url: string): Promise<string | null> {
  if (process.platform !== "darwin" || process.env.VERCEL) return null;
  const { mkdtemp, writeFile, readFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { execFile } = await import("node:child_process");
  const ext = (url.match(/\.(docx?|rtf|odt)(\?|$)/i)?.[1] ?? (bytes[0] === 0x50 ? "docx" : "doc")).toLowerCase();
  const dir = await mkdtemp(join(tmpdir(), "letsrace-doc-"));
  try {
    const src = join(dir, `in.${ext}`);
    await writeFile(src, bytes);
    await new Promise<void>((ok, fail) =>
      execFile("/usr/bin/textutil", ["-convert", "txt", "-encoding", "UTF-8", "-output", join(dir, "out.txt"), src], { timeout: 20_000 }, (e) => (e ? fail(e) : ok())),
    );
    return await readFile(join(dir, "out.txt"), "utf8");
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export type ReadDoc = { url: string; text: string; html: string | null; thin: boolean };

export async function readDocument(url: string, opts?: { maxBytes?: number }): Promise<ReadDoc | null> {
  const doc = await fetchBytes(url, opts?.maxBytes);
  if (!doc) return null;
  if (isPdf(doc.type, doc.bytes, url)) return { url, text: await pdfText(doc.bytes), html: null, thin: false };
  if (/text\/plain/.test(doc.type)) return { url, text: new TextDecoder("utf-8").decode(doc.bytes), html: null, thin: false };
  if (isOfficeDocument(doc.type, doc.bytes, url)) {
    const text = await officeText(doc.bytes, url);
    return text ? { url, text, html: null, thin: false } : null;
  }
  const html = new TextDecoder("utf-8").decode(doc.bytes);
  if (/^https?:\/\/my\.raceresult\.com\/\d+(?:\/|$)/i.test(url)) {
    const { raceResultDocument } = await import("@/lib/catalog/raceresult-documents");
    const publicDocument = await raceResultDocument(url, html).catch(() => null);
    if (publicDocument) return { url, ...publicDocument, thin: publicDocument.text.length < 300 };
  }
  const text = htmlText(html);
  // A shell for a script to fill: little text, a script that will write it.
  // Or an app that renders itself (Next, Nuxt, React, Angular): its first
  // HTML may carry a menu and a footer but not the race.
  const thin =
    (text.replace(/\s+/g, " ").trim().length < 600 && /<script/i.test(html)) ||
    /id="(root|app|__next|__nuxt)"|data-reactroot|ng-version=|__NEXT_DATA__|window\.__NUXT__/i.test(html);
  return { url, text, html, thin };
}

export function hintsFor(name: string, startDate: string, municipality: string | null): string[] {
  const [, m, d] = startDate.split("-").map(Number);
  const words = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 5 && !/^(zavod|zavody|memorial|pohar|cyklotour|cross|race|rennen|cup|trophy|serie|series)$/.test(w));
  return [...words, ...(municipality ? [municipality] : []), `${d}. ${m}.`, `${d}.${m}.`, `${d}. ${m}`];
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
  /** Only these races, read again even if asked recently. */
  ids?: string[];
  log?: (line: string) => void;
}): Promise<{ attempted: number; filled: number; silent: number; failed: number }> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 60;
  const today = new Date().toISOString().slice(0, 10);
  const skip = await recentlyProbed(supabase, "regs_ages");

  type Target = {
    id: string;
    name: string;
    startDate: string;
    regulationsUrl: string | null;
    websiteUrl: string | null;
    municipality: string | null;
    existing: string[];
  };
  const targets: Target[] = [];
  for (let from = 0; targets.length < max; from += PAGE) {
    let query = supabase
      .from("events")
      .select("id, name, start_date, regulations_url, website_url, age_categories, location:locations!inner(country_code, municipality)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today)
      .or("age_categories.is.null,age_categories.eq.{},age_confidence.is.null,age_confidence.eq.default,age_confidence.eq.previous")
      .or("regulations_url.not.is.null,website_url.not.is.null")
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (opts?.countries?.length) query = query.in("location.country_code", opts.countries);
    if (opts?.ids?.length) query = query.in("id", opts.ids);
    const { data } = await query;
    const rows = (data ?? []) as unknown as {
      id: string;
      name: string;
      start_date: string;
      regulations_url: string | null;
      website_url: string | null;
      age_categories: string[] | null;
      location: { municipality: string | null } | null;
    }[];
    for (const row of rows) {
      if (skip.has(row.id) && !opts?.ids?.length) continue;
      // A national championship runs the federation's classes, not the ones
      // on the club page it shares a site with.
      if (CHAMPIONSHIP.test(row.name)) continue;
      targets.push({
        id: row.id,
        name: row.name,
        startDate: row.start_date,
        regulationsUrl: isRegulationsUrl(row.regulations_url) ? row.regulations_url : null,
        websiteUrl: row.website_url,
        municipality: row.location?.municipality ?? null,
        existing: row.age_categories ?? [],
      });
      if (targets.length >= max) break;
    }
    if (rows.length < PAGE) break;
  }

  const result = { attempted: targets.length, filled: 0, silent: 0, failed: 0 };
  const { mapPool } = await import("@/lib/watcher/pool");
  // Pages that are only a script shell, kept to render in one Chrome later.
  const thinPages: { target: Target; url: string }[] = [];

  /**
   * Every document that may name this race's classes: its page, its stored
   * regulations, and what the page links as propozice or "Kategorie". Each
   * that names two specific bands or more is evidence; all evidence is
   * unioned — a series page and the round's own PDF often each hold half.
   */
  const readTarget = async (
    target: Target,
    rendered?: Map<string, string>,
  ): Promise<{ ages: AgeCategory[]; quote: string; from: string } | null> => {
    const year = Number(target.startDate.slice(0, 4));
    const hints = hintsFor(target.name, target.startDate, target.municipality);
    const queue = [target.websiteUrl, target.regulationsUrl].filter((u): u is string => Boolean(u)).map(directDocumentUrl);
    const seen = new Set<string>();
    const ages = new Set<AgeCategory>();
    let quote = "";
    let from = "";
    while (queue.length && seen.size < 6) {
      const url = queue.shift()!;
      if (seen.has(url)) continue;
      seen.add(url);
      let doc: ReadDoc | null;
      const html = rendered?.get(url);
      if (html) doc = { url, text: htmlText(html), html, thin: false };
      else doc = await readDocument(url).catch(() => null);
      if (!doc) continue;
      if (doc.thin && !rendered) thinPages.push({ target, url });
      const read = categoriesFromRegulationsText(doc.text, year);
      if (specificBands(read.ages) >= 2) {
        read.ages.forEach((a) => ages.add(a));
        if (!quote) {
          quote = read.quote;
          from = url;
        }
      }
      if (doc.html) {
        const related = relatedDocumentLinks(doc.html, url, hints);
        // The generic "regulations link on this page" knows nothing of which
        // race it belongs to; trust it only where nothing points at this one.
        const regs = related.some((r) => r.near) ? null : findRegulationsUrl(url, doc.html);
        for (const link of [...(regs ? [directDocumentUrl(regs)] : []), ...related.map((r) => r.url)]) {
          if (!seen.has(link)) queue.push(link);
        }
      }
    }
    if (!ages.size) return null;
    // Only children's classes found — a kids' page of a race that also runs
    // adults. Stated as the whole list it would hide the race from every
    // adult; so the children are added to what we had, not put in its place.
    const ADULT = ["junior", "u23", "elite", "amateur", "masters"];
    if (![...ages].some((a) => ADULT.includes(a))) target.existing.forEach((a) => ages.add(a as AgeCategory));
    const ordered = (await import("@/lib/taxonomy")).AGE_CATEGORIES.filter((a) => ages.has(a));
    return { ages: ordered, quote, from };
  };

  const write = async (target: Target, found: { ages: AgeCategory[]; quote: string; from: string } | null) => {
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
  };

  const waiting = new Set<string>();
  await mapPool(targets, 4, async (target) => {
    try {
      const found = await readTarget(target);
      // Nothing yet, but a page was only a shell: decide after rendering it.
      if (!found && thinPages.some((p) => p.target.id === target.id)) {
        waiting.add(target.id);
        return;
      }
      await write(target, found);
    } catch {
      result.failed += 1;
      if (!opts?.dryRun) await recordProbe(supabase, target.id, "regs_ages", "failed");
    }
  });

  if (waiting.size) {
    const { renderPagesHtml } = await import("@/lib/watcher/extractors/csc-render");
    const urls = [...new Set(thinPages.filter((p) => waiting.has(p.target.id)).map((p) => p.url))];
    const rendered = await renderPagesHtml(urls);
    for (const target of targets.filter((t) => waiting.has(t.id))) {
      try {
        await write(target, rendered.size ? await readTarget(target, rendered) : null);
      } catch {
        result.failed += 1;
      }
    }
  }
  return result;
}
