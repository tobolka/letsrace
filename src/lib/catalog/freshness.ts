import { createServerSupabase } from "@/lib/supabase/server";

function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Hide races that vanished from a calendar only when the extract still looks like
 * the same page (healthy overlap) and the drop is a minority — not a parser collapse.
 */
export function shouldHideDroppedFromCalendar(opts: {
  extractedCount: number;
  upcomingCount: number;
  overlapCount: number;
  droppedCount: number;
}): boolean {
  const { extractedCount, upcomingCount, overlapCount, droppedCount } = opts;
  if (droppedCount <= 0) return false;
  if (extractedCount < 3 || upcomingCount < 3) return false;
  if (overlapCount < Math.max(2, Math.ceil(upcomingCount * 0.5))) return false;
  if (droppedCount > Math.max(6, Math.floor(upcomingCount * 0.35))) return false;
  return true;
}

/** 304 / unchanged watches still prove the listing is alive. */
export async function touchLastSeenForWatchedUrl(watchedUrlId: string): Promise<number> {
  const supabase = createServerSupabase();
  const { data: sources } = await supabase
    .from("event_sources")
    .select("event_id")
    .eq("watched_url_id", watchedUrlId);
  const ids = [...new Set((sources ?? []).map((r) => r.event_id as string).filter(Boolean))];
  if (!ids.length) return 0;

  const now = new Date().toISOString();
  const today = todayIso();
  let touched = 0;
  for (const idsChunk of chunk(ids, 80)) {
    const { data } = await supabase
      .from("events")
      .update({ last_seen_at: now })
      .in("id", idsChunk)
      .gte("start_date", today)
      .eq("visibility", "public")
      .select("id");
    touched += data?.length ?? 0;
  }
  return touched;
}

export async function hideDroppedCalendarEvents(opts: {
  watchedUrlId: string;
  extractedExternalIds: Set<string>;
  extractedCount: number;
}): Promise<number> {
  const supabase = createServerSupabase();
  const { data: sources } = await supabase
    .from("event_sources")
    .select("event_id, external_id")
    .eq("watched_url_id", opts.watchedUrlId)
    .not("external_id", "is", null);

  const linked = (sources ?? []).filter(
    (row): row is { event_id: string; external_id: string } =>
      Boolean(row.event_id && row.external_id),
  );
  if (!linked.length) return 0;

  const eventIds = [...new Set(linked.map((r) => r.event_id))];
  const events: { id: string; start_date: string; visibility: string; status: string }[] = [];
  const today = todayIso();
  for (const idsChunk of chunk(eventIds, 80)) {
    const { data } = await supabase
      .from("events")
      .select("id, start_date, visibility, status")
      .in("id", idsChunk)
      .gte("start_date", today)
      .eq("visibility", "public")
      .in("status", ["scheduled", "tbc", "postponed", "registration_open"]);
    events.push(...((data ?? []) as typeof events));
  }

  const upcomingIds = new Set(events.map((e) => e.id));
  const upcoming = linked.filter((row) => upcomingIds.has(row.event_id));
  const upcomingExt = new Set(upcoming.map((r) => r.external_id));
  let overlap = 0;
  for (const id of upcomingExt) {
    if (opts.extractedExternalIds.has(id)) overlap += 1;
  }
  const dropped = upcoming.filter((row) => !opts.extractedExternalIds.has(row.external_id));

  if (
    !shouldHideDroppedFromCalendar({
      extractedCount: opts.extractedCount,
      upcomingCount: upcomingExt.size,
      overlapCount: overlap,
      droppedCount: new Set(dropped.map((r) => r.event_id)).size,
    })
  ) {
    return 0;
  }

  const dropIds = [...new Set(dropped.map((r) => r.event_id))];
  const hide: string[] = [];
  for (const eventId of dropIds) {
    const { count } = await supabase
      .from("event_sources")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .neq("watched_url_id", opts.watchedUrlId);
    if ((count ?? 0) > 0) continue;
    hide.push(eventId);
  }
  if (!hide.length) return 0;

  const now = new Date().toISOString();
  for (const idsChunk of chunk(hide, 80)) {
    await supabase
      .from("events")
      .update({
        visibility: "hidden",
        status: "hidden",
        updated_at: now,
      })
      .in("id", idsChunk);
  }
  return hide.length;
}
