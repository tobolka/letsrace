import { createServerSupabase } from "@/lib/supabase/server";
import { clearProbe, recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { fetchBot } from "@/lib/http/fetch";
import { facebookPageUrl, hostOf, isAggregatorUrl } from "@/lib/watcher/public-url";

/**
 * A race's Facebook page, read off the race's own website.
 *
 * Organisers often post the date, the poster and late changes only on
 * Facebook, and nearly all of them link that page from their site's header or
 * footer. Facebook itself is never read; only the organiser's website is.
 *
 * A page linking one Facebook page names its organiser's. A page linking
 * several (a sponsor, the photographer, a rider) names only the one whose
 * name matches the site or the race; when none does, nothing is taken.
 */

/** First path parts that are Facebook's own pages or single items, never an organiser's page. */
const NOT_A_PAGE = new Set([
  "sharer", "sharer.php", "share", "share.php", "dialog", "plugins", "tr", "login", "login.php", "help", "policies",
  "privacy", "legal", "watch", "hashtag", "media", "photo", "photo.php", "photos", "pg", "events", "groups",
  "story.php", "permalink.php", "l.php", "home.php", "gaming", "marketplace", "ads", "business", "settings",
  "people", "video.php", "videos", "reel", "reels", "notes", "search", "friends", "messages", "profile",
]);

/** Host parts that say nothing about the race: site builders and endings. */
const GENERIC_HOST = /^(www|m|cz|sk|pl|de|at|ch|it|com|eu|net|org|info|webnode|wixsite|estranky|wbs|blogspot|wordpress|mandaone|jimdofree|jimdo)$/;
/** Words every second race has; a page named with them is no more this race's than the next. */
const COMMON_WORDS = new Set([
  "cyclocross", "cyklokros", "cyklo", "cyclo", "cross", "maraton", "marathon", "gravel", "pohar", "poharu", "zavod", "zavody",
  "rennen", "radrennen", "wyscig", "kolarstwie", "przelajowym", "memorial", "memorialu", "ogolnopolski", "miedzynarodowy",
  "international", "mistrovstvi", "championship", "championships", "mountain", "classic", "trophy", "grand", "kolem",
]);

/** National federations' pages: they post about every race, and none of them is a race's own page. */
const FEDERATION_PAGE = /federa|verband|svazcyklistiky|cyklistickysvaz|zwiazek|pzkol|cyclingaustria|swisscycling|czechcycling|britishcycling|ffcyclisme|knwu|slovakcycling|szcyklistiky/;

const fold = (text: string) => text.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const compact = (text: string) => fold(text).replace(/[^a-z0-9]/g, "");

/** One organiser page per address, or null when the link is a share button, a post or Facebook's own page. */
export function organiserFacebookPage(raw: string): string | null {
  const tidy = facebookPageUrl(raw.replace(/&amp;/g, "&"));
  if (!tidy) return null;
  const url = new URL(tidy);
  const parts = url.pathname.split("/").filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
  const first = parts[0]?.toLowerCase();
  if (!first) return null;
  if (first === "profile.php") {
    const id = url.searchParams.get("id");
    return id && /^\d{6,}$/.test(id) ? `https://www.facebook.com/profile.php?id=${id}` : null;
  }
  // Newer and older page addresses carry the page's number: /p/Name-123…, /pages/Name/123…, /Name-123….
  const numbered = (first === "p" || first === "pages" ? parts.slice(1).join("/") : parts[0]!).match(/(?:^|[-/])(\d{9,})$/);
  if (numbered) return `https://www.facebook.com/profile.php?id=${numbered[1]}`;
  if (first === "p" || first === "pages" || NOT_A_PAGE.has(first)) return null;
  // A page name has letters; "facebook.com/2008" is not one.
  if (!/^[a-z0-9.\-_]{3,}$/i.test(parts[0]!) || !/[a-z]{3}/i.test(parts[0]!)) return null;
  // A post or photo of a page still names the page.
  return `https://www.facebook.com/${parts[0]}`;
}

/** What a page's name is compared with: the site's own name and the race's distinctive words. */
export function facebookHints(pageUrl: string, names: string[]): { hosts: string[]; words: string[] } {
  const host = hostOf(pageUrl) ?? "";
  const hosts = host.split(".").filter((part) => !GENERIC_HOST.test(part)).map(compact).filter((h) => h.length >= 4);
  const words = names.flatMap((n) => fold(n).split(/[^a-z0-9]+/)).filter((w) => w.length >= 5 && !COMMON_WORDS.has(w));
  return { hosts, words: [...new Set(words)] };
}

/** A name carries the word, or for a long word its first seven letters ("svefrankenhain" for "Frankenhainer"). */
const carries = (key: string, word: string) => key.includes(word) || (word.length >= 9 && key.includes(word.slice(0, 7)));

/**
 * The organiser's Facebook page among the links of a race's website, or null.
 *
 * A page counts when its name carries the race's (or series') own words. Its likeness to the
 * website's name counts only when the website itself is named after the race: on a federation's
 * calendar, a town's events page or a magazine, the page named like the site is theirs.
 */
export function facebookPageFromHtml(html: string, pageUrl: string, names: string[]): string | null {
  const text = html.replace(/\\\//g, "/");
  const found = new Set<string>();
  for (const m of text.matchAll(/https?:\/\/(?:[a-z0-9-]+\.)?(?:facebook\.com|fb\.com)\/[^\s"'<>\\)]+/gi)) {
    const page = organiserFacebookPage(m[0]);
    if (page) found.add(page);
  }
  if (found.size === 0) return null;
  const { hosts, words } = facebookHints(pageUrl, names);
  const raceSite = hosts.some((h) => words.some((w) => carries(h, w) || (h.length >= 5 && w.includes(h))));
  const scored = [...found].map((page) => {
    const key = compact(new URL(page).pathname);
    if (FEDERATION_PAGE.test(key)) return { page, score: 0 };
    if (key.startsWith("profilephp")) return { page, score: found.size === 1 && raceSite ? 1 : 0 };
    let score = words.filter((w) => carries(key, w)).length * 2;
    if (raceSite && hosts.some((h) => key.includes(h) || (key.length >= 5 && h.includes(key)))) score += 3;
    return { page, score };
  }).sort((a, b) => b.score - a.score);
  const [best, next] = scored;
  return best && best.score > 0 && best.score > (next?.score ?? 0) ? best.page : null;
}

const PAGE = 1000;

/**
 * Fill empty Facebook links of upcoming races from their websites. Each website is read once
 * per run however many races share it; a site that names none is asked again in a month.
 */
export async function fillFacebookLinks(opts?: { max?: number; dryRun?: boolean; log?: (line: string) => void }) {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 60;
  const today = new Date().toISOString().slice(0, 10);
  const skip = await recentlyProbed(supabase, "facebook_link");
  type Target = { id: string; name: string; website: string; series: string | null; revision: string };
  const targets: Target[] = [];
  for (let from = 0; targets.length < max; from += PAGE) {
    const { data, error } = await supabase
      .from("events")
      .select("id, name, website_url, public_revision, series:series!events_series_id_fkey(name), overrides:event_overrides(locked_fields)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today)
      .is("facebook_url", null)
      .not("website_url", "is", null)
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    // The Mac's copy may predate the column; nothing to do until it is taken again.
    if (error?.code === "42703" || /facebook_url/.test(error?.message ?? "")) return { attempted: 0, filled: 0, silent: 0, failed: 0, skipped: "no facebook_url column in this copy" };
    if (error) throw error;
    const rows = (data ?? []) as unknown as { id: string; name: string; website_url: string; public_revision: string; series: { name: string } | null; overrides: { locked_fields: string[] | null } | null }[];
    for (const row of rows) {
      if (skip.has(row.id) || row.overrides?.locked_fields?.includes("facebook_url")) continue;
      if (isAggregatorUrl(row.website_url) && !facebookPageUrl(row.website_url)) continue;
      targets.push({ id: row.id, name: row.name, website: row.website_url, series: row.series?.name ?? null, revision: row.public_revision });
      if (targets.length >= max) break;
    }
    if (rows.length < PAGE) break;
  }

  const result = { attempted: targets.length, filled: 0, silent: 0, failed: 0 };
  const pages = new Map<string, Target[]>();
  for (const t of targets) pages.set(t.website, [...(pages.get(t.website) ?? []), t]);

  const write = async (t: Target, link: string, source: string) => {
    if (opts?.dryRun) { opts.log?.(`DRY  ${t.name}  → ${link}  (${source})`); result.filled += 1; return; }
    const { data, error } = await supabase.from("events").update({ facebook_url: link, updated_at: new Date().toISOString() })
      .eq("id", t.id).eq("public_revision", t.revision).is("facebook_url", null).select("id");
    if (error) throw error;
    if (data?.length) { result.filled += 1; opts?.log?.(`SET  ${t.name}  → ${link}`); await clearProbe(supabase, t.id, "facebook_link"); }
  };
  const record = async (group: Target[], outcome: "silent" | "failed") => {
    result[outcome] += group.length;
    if (!opts?.dryRun) for (const t of group) await recordProbe(supabase, t.id, "facebook_link", outcome);
  };

  const { mapPool } = await import("@/lib/watcher/pool");
  await mapPool([...pages.entries()], 4, async ([website, group]) => {
    try {
      // The race's website is its Facebook page: nothing to read.
      const direct = organiserFacebookPage(website);
      if (direct) { for (const t of group) await write(t, direct, website); return; }
      const res = await fetchBot(website, { timeoutMs: 15_000 });
      if (!res.ok) return record(group, "failed");
      if (!/html/i.test(res.headers.get("content-type") ?? "")) return record(group, "silent");
      const html = await res.text();
      for (const t of group) {
        const link = facebookPageFromHtml(html, res.url || website, [t.name, ...(t.series ? [t.series] : [])]);
        if (link) await write(t, link, res.url || website);
        else await record([t], "silent");
      }
    } catch {
      await record(group, "failed");
    }
  });
  return result;
}
