import { createServerSupabase } from "@/lib/supabase/server";
import { currentSourceLease } from "@/lib/pipeline/source-work";
import type { Database } from "@/lib/supabase/database.types";

type FreshnessArgs = Database["public"]["Functions"]["pipeline_calendar_freshness"]["Args"];

async function updateFreshness(watchedUrlId: string, details?: Pick<FreshnessArgs, "p_ids" | "p_count" | "p_from" | "p_until">) {
  const lease = currentSourceLease();
  if (!lease) throw Error("source_reader_unavailable_or_running: calendar freshness requires a source lease");
  const { data, error } = await createServerSupabase().rpc("pipeline_calendar_freshness", {
    p_source: watchedUrlId, p_key: lease.key, p_token: lease.token, p_url: lease.url, ...details,
  });
  if (error) throw Error(error.message);
  return data;
}

export function touchLastSeenForWatchedUrl(watchedUrlId: string) {
  return updateFreshness(watchedUrlId);
}

export function hideDroppedCalendarEvents(opts: {
  watchedUrlId: string;
  extractedExternalIds: Set<string>;
  extractedCount: number;
  extractedFrom?: string;
  extractedUntil?: string;
}) {
  return updateFreshness(opts.watchedUrlId, {
    p_ids: [...opts.extractedExternalIds],
    p_count: opts.extractedCount,
    p_from: opts.extractedFrom,
    p_until: opts.extractedUntil,
  });
}
