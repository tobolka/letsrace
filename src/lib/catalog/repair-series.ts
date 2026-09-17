/**
 * Make a series read exactly like its official calendar.
 *
 * Given the rounds as the series' own site lists them, fold duplicate series
 * rows into the canonical one, re-read the official source so every round has
 * an official row, merge everything in a round's date window into one keeper
 * carrying the official name, dates and website (locked, so the watcher keeps
 * them), and detach whatever sits in the series without being a round of it.
 */
import { createServerSupabase } from "@/lib/supabase/server";
import { mergeEventPair } from "@/lib/catalog/merge-duplicates";
import { watchOne } from "@/lib/watcher/run";
import { normalizeName } from "@/lib/domain";

export type Round = {
  start: string;
  end?: string;
  /** Rows dated up to here (inclusive) belong to this round; defaults to `end ?? start`. */
  swallowUntil?: string;
  /** Official name; omitted keeps whatever the keeper is called. */
  name?: string;
  place: string;
  website?: string;
  /** Pull a row from outside the series when the window holds nothing. */
  adopt?: RegExp;
};

export type SeriesPlan = {
  slug: string;
  name: string;
  /** Series rows to fold into this one. */
  duplicates: string[];
  /** Official calendar source to re-read before repairing. */
  sourceUrl: string;
  officialHost: RegExp;
  rounds: Round[];
  /** Rows in the series that are not rounds of it at all. */
  foreign?: { test: RegExp; seriesSlug: string | null; hide?: boolean }[];
  /** Rows dated like this are scraping debris, not races. */
  junk?: (e: EventRow) => boolean;
};

export type EventRow = {
  id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  website_url: string | null;
  series_id: string | null;
  created_at: string;
};

function hostOf(url: string | null): string {
  try {
    return url ? new URL(url).hostname : "";
  } catch {
    return "";
  }
}

export async function repairSeriesPlans(
  plans: SeriesPlan[],
  opts: { dry: boolean; updatedBy: string; emptyDuplicateSeries?: string[] },
): Promise<void> {
  const DRY = opts.dry;
  const UPDATED_BY = opts.updatedBy;
  const TODAY = new Date().toISOString().slice(0, 10);
  const supabase = createServerSupabase();
  const now = () => new Date().toISOString();
  const log = (...a: unknown[]) => console.log(...a);

  const seriesIdBySlug = async (slug: string) => {
    const { data } = await supabase.from("series").select("id").eq("slug", slug).maybeSingle();
    return (data?.id as string | undefined) ?? null;
  };

  for (const plan of plans) {
    log(`\n===== ${plan.name} (${plan.slug})`);
    const canonicalId = await seriesIdBySlug(plan.slug);
    if (!canonicalId) throw new Error(`series ${plan.slug} missing`);

    // 1. Fold duplicate series rows.
    for (const dupSlug of plan.duplicates) {
      const dupId = await seriesIdBySlug(dupSlug);
      if (!dupId) continue;
      const { count } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("series_id", dupId);
      log(`fold ${dupSlug} (${count} events) into ${plan.slug}`);
      if (DRY) continue;
      const { error } = await supabase
        .from("events")
        .update({ series_id: canonicalId, updated_at: now() })
        .eq("series_id", dupId);
      if (error) throw new Error(error.message);
      const { error: delErr } = await supabase.from("series").delete().eq("id", dupId);
      if (delErr) throw new Error(delErr.message);
    }

    // 2. Re-read the official calendar so every round has an official row.
    const { data: source } = await supabase
      .from("watched_urls")
      .select("id,url,kind")
      .or(
        `url.eq.${plan.sourceUrl},url.eq.${plan.sourceUrl.replace(/\/$/, "")},url.eq.${plan.sourceUrl}/`,
      )
      .limit(1)
      .maybeSingle();
    if (source && !DRY) {
      const outcome = await watchOne({ id: source.id, url: source.url, kind: source.kind });
      log(`re-read ${source.url}: ok=${outcome.ok} extracted=${outcome.eventsExtracted ?? "?"} upserted=${outcome.eventsUpserted} ${outcome.error ?? ""}`);
    } else {
      log(`source ${plan.sourceUrl}: ${source ? "dry, skipped" : "not watched"}`);
    }

    // Everything the series holds this season.
    const loadSeries = async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id,name,start_date,end_date,status,website_url,series_id,created_at")
        .eq("series_id", canonicalId)
        .is("merged_into_id", null)
        .gte("start_date", "2026-01-01")
        .order("start_date");
      if (error) throw new Error(error.message);
      return (data ?? []) as EventRow[];
    };
    let rows = await loadSeries();

    // Foreign rows leave before the windows are read, or a BMX cup on the
    // same weekend would be merged into the MTB round.
    const claimed = new Set<string>();
    for (const e of rows) {
      const rule = plan.foreign?.find((f) => f.test.test(e.name));
      if (!rule) continue;
      claimed.add(e.id);
      const target = rule.seriesSlug ? await seriesIdBySlug(rule.seriesSlug) : null;
      log(`  foreign: ${e.start_date} ${e.name} → ${rule.seriesSlug ?? "no series"}${rule.hide ? ", hidden" : ""}`);
      if (DRY) continue;
      const patch: Record<string, unknown> = { series_id: target, updated_at: now() };
      if (rule.hide || plan.junk?.(e)) patch.status = "hidden";
      const { error } = await supabase.from("events").update(patch).eq("id", e.id);
      if (error) throw new Error(error.message);
    }
    rows = rows.filter((e) => !claimed.has(e.id));

    // 3. One keeper per round.
    for (const round of plan.rounds) {
      // Exact windows: Pražský rides Saturday and Sunday as two rounds, so a
      // day of spill would fold one into the other. Weekend rounds carry
      // their Sunday in `end`.
      const windowEnd = round.swallowUntil ?? round.end ?? round.start;
      let inWindow = rows.filter(
        (e) => !claimed.has(e.id) && e.start_date >= round.start && e.start_date <= windowEnd,
      );
      // The partner race exists as its own event; adopt it into the series.
      if (!inWindow.length && round.adopt) {
        const { data } = await supabase
          .from("events")
          .select("id,name,start_date,end_date,status,website_url,series_id,created_at")
          .is("merged_into_id", null)
          .gte("start_date", round.start)
          .lte("start_date", windowEnd);
        inWindow = ((data ?? []) as EventRow[]).filter((e) => round.adopt!.test(e.name));
        if (inWindow.length) log(`  adopt ${inWindow.map((e) => e.name).join(" + ")}`);
      }
      if (!inWindow.length) {
        log(`  MISSING ${round.start} ${round.name ?? round.place} — nothing to keep`);
        continue;
      }
      // A row someone curated by hand outranks anything a source wrote.
      const { data: overrides } = await supabase
        .from("event_overrides")
        .select("event_id,updated_by,locked_fields")
        .in(
          "event_id",
          inWindow.map((e) => e.id),
        );
      const curated = new Map<string, string[]>();
      for (const o of overrides ?? []) {
        if (o.updated_by === "admin" && (o.locked_fields as string[])?.length) {
          curated.set(o.event_id as string, o.locked_fields as string[]);
        }
      }
      const ranked = [...inWindow].sort((a, b) => {
        const ac = curated.has(a.id) ? 0 : 1;
        const bc = curated.has(b.id) ? 0 : 1;
        if (ac !== bc) return ac - bc;
        const ao = plan.officialHost.test(hostOf(a.website_url)) ? 0 : 1;
        const bo = plan.officialHost.test(hostOf(b.website_url)) ? 0 : 1;
        if (ao !== bo) return ao - bo;
        const ah = a.status === "hidden" ? 1 : 0;
        const bh = b.status === "hidden" ? 1 : 0;
        if (ah !== bh) return ah - bh;
        return a.created_at.localeCompare(b.created_at);
      });
      const keeper = ranked[0]!;
      const drops = ranked.slice(1);
      const roundName = round.name ?? keeper.name;
      log(
        `  ${round.start} ${roundName}: keep ${keeper.id.slice(0, 8)} "${keeper.name}"` +
          (drops.length ? ` + merge ${drops.map((d) => `"${d.name}"`).join(", ")}` : ""),
      );
      for (const e of inWindow) claimed.add(e.id);
      if (DRY) continue;
      for (const d of drops) {
        try {
          await mergeEventPair(keeper.id, d.id);
        } catch (err) {
          const message = (err as Error).message;
          // An admin once locked the duplicate's visibility to keep it on
          // the map; the keeper is public, so the lock has nothing left to
          // protect and only blocks the merge.
          if (/locked fields on the duplicate/i.test(message)) {
            const { data: lock } = await supabase
              .from("event_overrides")
              .select("locked_fields,updated_by")
              .eq("event_id", d.id)
              .maybeSingle();
            const locked = (lock?.locked_fields as string[] | undefined) ?? [];
            const ours = /series repair/i.test(String(lock?.updated_by ?? ""));
            if (ours || locked.every((f) => f === "visibility" || f === "status")) {
              await supabase.from("event_overrides").delete().eq("event_id", d.id);
              log(`    dropped ${locked.join(",")} lock on ${d.id.slice(0, 8)} and merged`);
              await mergeEventPair(keeper.id, d.id);
              continue;
            }
          }
          log(`    merge failed for ${d.id}: ${message}`);
        }
      }
      const status =
        keeper.status === "hidden"
          ? (round.end ?? round.start) < TODAY
            ? "completed"
            : "scheduled"
          : keeper.status;
      const fields: Record<string, unknown> = {
        name: roundName,
        name_normalized: normalizeName(roundName),
        start_date: round.start,
        end_date: round.end ?? round.start,
        series_id: canonicalId,
        status,
        visibility: "public",
      };
      if (round.website) fields.website_url = round.website;
      // What an admin locked stays as the admin left it.
      for (const f of curated.get(keeper.id) ?? []) {
        if (f === "name") delete fields.name_normalized;
        delete fields[f];
      }
      const { error } = await supabase
        .from("events")
        .update({ ...fields, updated_at: now() })
        .eq("id", keeper.id);
      if (error) throw new Error(error.message);

      const lockFields: Record<string, unknown> = {
        name: roundName,
        start_date: round.start,
        end_date: round.end ?? round.start,
        series_id: canonicalId,
      };
      if (round.website) lockFields.website_url = round.website;
      for (const f of curated.get(keeper.id) ?? []) delete lockFields[f];
      const { data: existing } = await supabase
        .from("event_overrides")
        .select("fields,locked_fields")
        .eq("event_id", keeper.id)
        .maybeSingle();
      const merged = { ...((existing?.fields as Record<string, unknown>) ?? {}), ...lockFields };
      const locked = [
        ...new Set([...((existing?.locked_fields as string[]) ?? []), ...Object.keys(lockFields)]),
      ];
      const { error: ovErr } = await supabase
        .from("event_overrides")
        .upsert(
          {
            event_id: keeper.id,
            fields: merged,
            locked_fields: locked,
            updated_by: curated.has(keeper.id) ? "admin" : UPDATED_BY,
          },
          { onConflict: "event_id" },
        );
      if (ovErr) throw new Error(ovErr.message);
    }

    // 4. Whatever is left in the series is not a round of it.
    for (const e of rows) {
      if (claimed.has(e.id)) continue;
      const junk = plan.junk?.(e) ?? false;
      log(`  detach: ${e.start_date} ${e.status} ${e.name}${junk ? " (junk, hidden)" : ""}`);
      if (DRY) continue;
      const patch: Record<string, unknown> = { series_id: null, updated_at: now() };
      if (junk) patch.status = "hidden";
      const { error } = await supabase.from("events").update(patch).eq("id", e.id);
      if (error) throw new Error(error.message);
    }

    const after = await loadSeries();
    log(`  → ${plan.slug} now: ${after.filter((e) => e.status !== "hidden").length} races`);
    for (const e of after) log(`     ${e.start_date}  ${e.status.padEnd(9)} ${e.name}`);
  }

  for (const slug of opts.emptyDuplicateSeries ?? []) {
    const id = await seriesIdBySlug(slug);
    if (!id) continue;
    const { count } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("series_id", id);
    if (count) {
      log(`keep ${slug}: ${count} events`);
      continue;
    }
    log(`delete empty series ${slug}`);
    if (!DRY) await supabase.from("series").delete().eq("id", id);
  }
}

