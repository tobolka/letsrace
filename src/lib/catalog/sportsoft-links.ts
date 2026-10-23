import { createServerSupabase } from "@/lib/supabase/server";
import { ACTIVE_EVENT_STATUSES } from "@/lib/event-visibility";
import { recordFacts } from "@/lib/catalog/facts";
import { fetchBot } from "@/lib/http/fetch";

const PAGE = 1000;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

/**
 * A race found on kalendar.sportsoft.cz has its own page there, and that page
 * links the entry form (registrace.sportsoft.cz/registration.aspx?e=N) and,
 * when the organiser uploaded one, the regulations PDF (_data/N/propozice.pdf).
 * The calendar's list rows carry neither, so they are read from the race page.
 */
export function sportsoftLinksFromPage(html: string): { registration?: string; regulations?: string } {
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, "&"));
  const registration = hrefs.find((h) => /^https:\/\/registrace\.sportsoft\.cz\/(registration|main)\.aspx\?e=\d+/i.test(h));
  const regulations = hrefs.find((h) => /^https:\/\/registrace\.sportsoft\.cz\/_data\/\d+\/[^"]+\.(pdf|docx?)$/i.test(h));
  return { registration, regulations };
}

async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetchBot(url, { headers: { "user-agent": UA, range: "bytes=0-1023" }, timeoutMs: 15_000 });
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

export async function fillSportsoftLinks(opts?: {
  dryRun?: boolean;
  log?: (line: string) => void;
}): Promise<{ attempted: number; registration: number; regulations: number; failed: number }> {
  const supabase = createServerSupabase();
  const today = new Date().toISOString().slice(0, 10);
  const result = { attempted: 0, registration: 0, regulations: 0, failed: 0 };
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("events")
      .select("id, name, start_date, registration_url, regulations_url, sources:event_sources(source_url)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .in("status", [...ACTIVE_EVENT_STATUSES])
      .gte("start_date", today)
      .or("registration_url.is.null,regulations_url.is.null")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as {
      id: string; name: string; start_date: string;
      registration_url: string | null; regulations_url: string | null;
      sources: { source_url: string | null }[] | null;
    }[];
    for (const row of rows) {
      const page = (row.sources ?? [])
        .map((s) => s.source_url ?? "")
        .find((u) => /^https:\/\/kalendar\.sportsoft\.cz\/race\/\d+\/?$/.test(u));
      if (!page) continue;
      result.attempted += 1;
      let html: string;
      try {
        const res = await fetchBot(page, { headers: { "user-agent": UA } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        html = await res.text();
      } catch (e) {
        result.failed += 1;
        opts?.log?.(`FAIL ${row.name}: ${String(e)}`);
        continue;
      }
      const found = sportsoftLinksFromPage(html);
      const update: Record<string, string> = {};
      const facts: { field: string; value: string; previous: null; sourceUrl: string }[] = [];
      if (!row.registration_url && found.registration) {
        update.registration_url = found.registration;
        facts.push({ field: "registration_url", value: found.registration, previous: null, sourceUrl: page });
      }
      // An uploaded file is linked even before it is there; only a real one is kept.
      if (!row.regulations_url && found.regulations && (await exists(found.regulations))) {
        update.regulations_url = found.regulations;
        facts.push({ field: "regulations_url", value: found.regulations, previous: null, sourceUrl: page });
      }
      if (!facts.length) continue;
      opts?.log?.(`${opts?.dryRun ? "DRY" : "SET"}  ${row.start_date}  ${row.name}  → ${Object.values(update).join("  ")}`);
      if (update.registration_url) result.registration += 1;
      if (update.regulations_url) result.regulations += 1;
      if (opts?.dryRun) continue;
      await supabase.from("events").update({ ...update, updated_at: new Date().toISOString() }).eq("id", row.id);
      await recordFacts(supabase, row.id, facts, { method: "parser:sportsoft-race-page" });
    }
    if (rows.length < PAGE) break;
  }
  return result;
}
