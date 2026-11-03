import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Fact = {
  field: string;
  value: unknown;
  previous: unknown;
  sourceUrl?: string | null;
  quote?: string | null;
};

/** Keep the evidence for values a machine wrote to a race (see event_facts). */
export async function recordFacts(
  supabase: SupabaseClient,
  eventId: string,
  facts: Fact[],
  how: { method: string; model?: string | null; version?: string | null },
): Promise<void> {
  if (!facts.length) return;
  const { error } = await supabase.from("event_facts").insert(
    facts.map((f) => ({
      event_id: eventId,
      field: f.field,
      value: f.value ?? null,
      previous: f.previous ?? null,
      source_url: f.sourceUrl ?? null,
      quote: f.quote ?? null,
      method: how.method,
      model: how.model ?? null,
      version: how.version ?? null,
    })),
  );
  if (error) throw new Error(`Recording fact evidence: ${error.message}`);
}

export function textHash(text: string): string {
  return createHash("sha1").update(text).digest("hex");
}

export function sameCategoryRows(saved: Record<string, unknown>[], current: Record<string, unknown>[]): boolean {
  const fields = ["id", "event_id", "name", "age_min", "age_max", "distance_km", "elevation_m", "gender", "audience"];
  return saved.length > 0 && saved.every(row => {
    const now = current.find(c => c.id === row.id);
    return now && fields.every(field => (row[field] ?? null) === (now[field] ?? null));
  });
}

/** True when this reader already read this exact text. */
export async function alreadyRead(supabase: SupabaseClient, url: string, reader: string, hash: string): Promise<boolean> {
  const { data, error } = await supabase.from("page_reads").select("text_hash").eq("url", url).eq("reader", reader).maybeSingle();
  if (error) throw new Error(`Reading document checkpoint: ${error.message}`);
  return data?.text_hash === hash;
}

export async function markRead(supabase: SupabaseClient, url: string, reader: string, hash: string): Promise<void> {
  const { error } = await supabase.from("page_reads").upsert({ url, reader, text_hash: hash, read_at: new Date().toISOString() }, { onConflict: "url,reader" });
  if (error) throw new Error(`Saving document checkpoint: ${error.message}`);
}

/**
 * Undo what one method (and optionally one version, or since a time) wrote:
 * each field goes back to what it held before, but only where it still holds
 * the value that method wrote — a later correction is never overwritten.
 */
export async function rollbackFacts(
  supabase: SupabaseClient,
  opts: { method: string; version?: string; since?: string; dryRun?: boolean; log?: (l: string) => void },
): Promise<{ facts: number; restored: number; kept: number }> {
  let q = supabase.from("event_facts").select("id, event_id, field, value, previous").eq("method", opts.method).eq("status", "active");
  if (opts.version) q = q.eq("version", opts.version);
  if (opts.since) q = q.gte("created_at", opts.since);
  const { data, error } = await q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(10000);
  if (error) throw new Error(`Reading rollback evidence: ${error.message}`);
  const result = { facts: data?.length ?? 0, restored: 0, kept: 0 };
  for (const f of (data ?? []) as { id: string; event_id: string; field: string }[]) {
    const { data: receipt, error: rollbackError } = await supabase.rpc("pipeline_rollback_fact", { p_fact: f.id, p_dry_run: opts.dryRun ?? false });
    if (rollbackError) throw new Error(`Rolling back recorded change: ${rollbackError.message}`);
    const outcome = receipt as { status?: string; reason?: string } | null;
    if (!outcome || !["restored", "kept"].includes(outcome.status ?? "")) throw new Error("Fact rollback was not confirmed");
    if (outcome.status === "restored") {
      result.restored++;
      opts.log?.(`${opts.dryRun ? "DRY" : "UNDO"} ${f.event_id}: ${f.field}`);
    } else {
      result.kept++;
      opts.log?.(`KEEP ${f.event_id}: ${f.field} (${outcome.reason ?? "protected"})`);
    }
  }
  return result;
}
