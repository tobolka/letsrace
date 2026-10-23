import { createServerSupabase } from "@/lib/supabase/server";
import { recentlyProbed, recordProbe } from "@/lib/catalog/probes";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { isRegistrationPlatformUrl } from "@/lib/watcher/registration-url";
import { fetchBot } from "@/lib/http/fetch";

const PAGE = 1000;
const FREE_MAIL =
  /^(gmail|googlemail|yahoo|hotmail|outlook|live|libero|virgilio|alice|tin|tiscali|email|fastwebnet|icloud|me|aruba|pec|legalmail|msn|inwind|teletu|katamail|gmx|web|t-online|seznam|centrum|wp|o2|interia|onet)\./i;
const NOT_A_SITE =
  /federciclismo|eventbrite|facebook|instagram|youtube|strava|komoot|google|wa\.me|whatsapp|bit\.ly|linktr\.ee|endu\.net|iscrizioni|wiclax|ks-timing|kronoservice|mysdam|tds-live/i;

/**
 * The organiser's site, read from an Italian federation race page.
 *
 * The federation's page has no website field, and 174 of 189 upcoming Italian
 * races had no link at all. The organiser usually says it anyway: in the
 * description ("sul sito ufficiale www.endurowintertrophy.it"), or by writing
 * from their own domain (info@granfondoxyz.it). A free mailbox says nothing,
 * and neither does a social or timing page.
 */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 5 && !/^(trofeo|memorial|coppa|giro|della|delle|citta|comune|gara|campionato|italiano|regionale|provinciale|team|sport|ciclismo|cycling|bike|asd|a\.s\.d)$/.test(w));
}

export function fciWebsiteFromPage(html: string, raceName = ""): string | null {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&");
  const organiser = text.match(/Organizzatore:\s*([^\n]{2,80}?)\s{2,}|Organizzatore:\s*(.{2,60}?)\s*Telefono:/i);
  const names = [...words(raceName), ...words(organiser?.[1] ?? organiser?.[2] ?? "")];
  // A link in the description counts only when its domain carries the race's
  // or the organiser's name: descriptions also advertise the next event.
  for (const m of text.matchAll(/\b(?:https?:\/\/)?(www\.[a-z0-9-]+(?:\.[a-z0-9-]+)+|[a-z0-9-]+\.(?:it|com|org|eu|net|bike|cc)(?:\/[^\s"'<>),;]*)?)(?=[\s"'<>),;.]|$)/gi)) {
    if (/@/.test(text.slice(Math.max(0, m.index! - 1), m.index!))) continue;
    const raw = m[0]!.replace(/[.,;]+$/, "");
    const url = /^https?:/i.test(raw) ? raw : `https://${raw}`;
    if (NOT_A_SITE.test(url) || isRegistrationPlatformUrl(url)) continue;
    const host = url.replace(/^https?:\/\/(www\.)?/i, "").split(/[/?#]/)[0]!.toLowerCase().replace(/-/g, "");
    if (names.some((w) => host.includes(w))) return url;
  }
  // The organiser writing from their own domain: that is their site.
  const email = text.match(/[a-z0-9._%+-]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i)?.[1]?.toLowerCase();
  // Also only in its own name: an agency writes for several races.
  if (email && !FREE_MAIL.test(email) && !NOT_A_SITE.test(email)) {
    const host = email.replace(/^www\./, "");
    if (names.some((w) => host.replace(/-/g, "").includes(w))) return `https://${host}`;
  }
  return null;
}

async function reachable(url: string): Promise<boolean> {
  try {
    const res = await fetchBot(url, { timeoutMs: 10_000 });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fillFciWebsites(opts?: {
  max?: number;
  dryRun?: boolean;
  log?: (line: string) => void;
}): Promise<{ attempted: number; filled: number; silent: number; failed: number }> {
  const supabase = createServerSupabase();
  const max = opts?.max ?? 60;
  const today = new Date().toISOString().slice(0, 10);
  const skip = await recentlyProbed(supabase, "fci_website");

  const targets: { id: string; name: string; startDate: string; url: string }[] = [];
  for (let from = 0; targets.length < max; from += PAGE) {
    const { data } = await supabase
      .from("events")
      .select("id, name, start_date, sources:event_sources(source_url)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today)
      .is("website_url", null)
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    const rows = data ?? [];
    for (const row of rows) {
      if (skip.has(row.id)) continue;
      const url = (row.sources ?? [])
        .map((s) => s.source_url ?? "")
        .find((u) => /members\.federciclismo\.it\/race\/detail\/\d+/.test(u));
      if (!url) continue;
      targets.push({ id: row.id, name: row.name, startDate: row.start_date, url });
      if (targets.length >= max) break;
    }
    if (rows.length < PAGE) break;
  }

  const result = { attempted: targets.length, filled: 0, silent: 0, failed: 0 };
  for (const target of targets) {
    try {
      const res = await fetchBot(target.url);
      if (!res.ok) {
        result.failed += 1;
        if (!opts?.dryRun) await recordProbe(supabase, target.id, "fci_website", "failed");
        continue;
      }
      const site = fciWebsiteFromPage(await res.text(), target.name);
      // A site we could not open is not worth a link.
      if (!site || !(await reachable(site))) {
        result.silent += 1;
        if (!opts?.dryRun) await recordProbe(supabase, target.id, "fci_website", "silent");
        continue;
      }
      result.filled += 1;
      opts?.log?.(`${opts?.dryRun ? "DRY" : "SET"}  ${target.startDate}  ${target.name}  → ${site}`);
      if (!opts?.dryRun) {
        await supabase
          .from("events")
          .update({ website_url: site, updated_at: new Date().toISOString() })
          .eq("id", target.id)
          .is("website_url", null);
      }
    } catch {
      result.failed += 1;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return result;
}
