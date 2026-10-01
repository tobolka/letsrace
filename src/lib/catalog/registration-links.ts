import * as cheerio from "cheerio";
import { createServerSupabase } from "@/lib/supabase/server";
import { clearProbe, recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { BOT_UA } from "@/lib/watcher/http";
import {
  isAccountOrNewsletterUrl,
  isRegistrationPlatformUrl,
  isStartListUrl,
} from "@/lib/watcher/registration-url";

const PAGE = 1000;
const ENTER_TEXT =
  /^(online\s*)?(registrace|registrovat|p[řr]ihl[aá][šs]k|p[řr]ihl[aá]sit|anmeld|nennung|register|registration|sign\s*up|entry|enter|zapisy|zapisz|zg[łl]oszen|iscrizion|iscriviti|inscri|registr[aá]cia|prihl[aá]s)/i;
const NOT_ENTRY =
  /v[ýy]sledk|results|ergebnis|startlist|startovn[ií]\s*listin|seznam\s*registrovan|teilnehmerliste|lista\s*startowa|login|přihlášení\s*do\s*účtu|\/storage\/|\.pdf(\?|$)|training|trainings|kurs|camp|academy|akademie|newsletter|membership|mitglied/i;

/**
 * Where to enter, read off the race's own page.
 *
 * Three in four upcoming races had no entry link, though most organisers put
 * one on their page: a button to their timing company, or a "Registrace" /
 * "Anmeldung" / "Zapisy" link. On a page that lists several races, the link
 * next to this one wins.
 */
export function findEntryLink(
  html: string,
  pageUrl: string,
  hints: string[],
  pageYear = String(new Date().getFullYear()),
): string | null {
  const $ = cheerio.load(html);
  const fold = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const foldedHints = hints.map(fold).filter((h) => h.length >= 3);
  const found: { url: string; score: number }[] = [];
  $("a[href]").each((_, a) => {
    const href = ($(a).attr("href") || "").trim();
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) return;
    let abs: string;
    try {
      abs = new URL(href, pageUrl).toString();
    } catch {
      return;
    }
    const text = $(a).text().replace(/\s+/g, " ").trim();
    if (NOT_ENTRY.test(`${text} ${abs}`) || isStartListUrl(abs) || isAccountOrNewsletterUrl(abs)) return;
    // An entry page for another year is not this race's.
    const years: string[] = abs.match(/20\d{2}/g) ?? [];
    if (years.length && !years.includes(pageYear)) return;
    const platform = isRegistrationPlatformUrl(abs);
    const worded = ENTER_TEXT.test(text);
    if (!platform && !worded) return;
    const around = fold($(a).parent().parent().text().slice(0, 400));
    const near = foldedHints.some((h) => around.includes(h));
    found.push({ url: abs, score: (platform ? 4 : 0) + (worded ? 3 : 0) + (near ? 5 : 0) });
  });
  if (!found.length) return null;
  const nearOnes = found.filter((f) => f.score >= 5 + 3);
  // Many entry links and none near this race: it is someone else's list.
  if (!nearOnes.length && new Set(found.map((f) => f.url)).size > 3) return null;
  return (nearOnes.length ? nearOnes : found).sort((a, b) => b.score - a.score)[0]!.url;
}

function hintsFor(name: string, startDate: string, municipality: string | null): string[] {
  const [, m, d] = startDate.split("-").map(Number);
  const words = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 5);
  return [...words, ...(municipality ? [municipality] : []), `${d}. ${m}.`, `${d}.${m}.`];
}

export async function fillRegistrationLinks(opts?: {
  max?: number;
  dryRun?: boolean;
  log?: (line: string) => void;
}): Promise<{ attempted: number; filled: number; silent: number; failed: number }> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 60;
  const today = new Date().toISOString().slice(0, 10);
  const skip = await recentlyProbed(supabase, "reg_links");
  type Target = { id: string; name: string; startDate: string; website: string; municipality: string | null };
  const targets: Target[] = [];
  for (let from = 0; targets.length < max; from += PAGE) {
    const { data } = await supabase
      .from("events")
      .select("id, name, start_date, website_url, location:locations(municipality)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today)
      .is("registration_url", null)
      .not("website_url", "is", null)
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    const rows = (data ?? []) as unknown as {
      id: string;
      name: string;
      start_date: string;
      website_url: string;
      location: { municipality: string | null } | null;
    }[];
    for (const row of rows) {
      if (skip.has(row.id)) continue;
      targets.push({
        id: row.id,
        name: row.name,
        startDate: row.start_date,
        website: row.website_url,
        municipality: row.location?.municipality ?? null,
      });
      if (targets.length >= max) break;
    }
    if (rows.length < PAGE) break;
  }

  const result = { attempted: targets.length, filled: 0, silent: 0, failed: 0 };
  const { mapPool } = await import("@/lib/watcher/pool");
  await mapPool(targets, 4, async (t) => {
    try {
      // The page itself is a registration platform: that is the entry link.
      let link: string | null = isRegistrationPlatformUrl(t.website) ? t.website : null;
      if (!link) {
        const res = await fetch(t.website, {
          headers: { "user-agent": BOT_UA },
          redirect: "follow",
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          result.failed += 1;
          if (!opts?.dryRun) await recordProbe(supabase, t.id, "reg_links", "failed");
          return;
        }
        const type = res.headers.get("content-type") ?? "";
        if (!/html/i.test(type)) {
          result.silent += 1;
          if (!opts?.dryRun) await recordProbe(supabase, t.id, "reg_links", "silent");
          return;
        }
        link = findEntryLink(
          await res.text(),
          res.url || t.website,
          hintsFor(t.name, t.startDate, t.municipality),
          t.startDate.slice(0, 4),
        );
      }
      if (!link) {
        result.silent += 1;
        if (!opts?.dryRun) await recordProbe(supabase, t.id, "reg_links", "silent");
        return;
      }
      result.filled += 1;
      opts?.log?.(`${opts?.dryRun ? "DRY" : "SET"}  ${t.startDate}  ${t.name}  → ${link}`);
      if (opts?.dryRun) return;
      await supabase
        .from("events")
        .update({ registration_url: link, updated_at: new Date().toISOString() })
        .eq("id", t.id)
        .is("registration_url", null);
      await clearProbe(supabase, t.id, "reg_links");
    } catch {
      result.failed += 1;
      if (!opts?.dryRun) await recordProbe(supabase, t.id, "reg_links", "failed");
    }
  });
  return result;
}
