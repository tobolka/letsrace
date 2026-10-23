import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { readJson, writeJsonAtomic } from "@/lib/catalog/local-source-cache";
import { NO_USAGE, LlmResponseError, type LlmUsage } from "@/lib/llm/anthropic";
import { createServerSupabase } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

type Reply<T> = { value: T; usage: LlmUsage };
type Entry = { value: unknown; savedAt: number };
const memory = new Map<string, Entry>();
const pending = new Map<string, Promise<Reply<unknown>>>();
const MAX_ENTRIES = 64;
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
let prune: Promise<void> | undefined;

function databaseCache(): SupabaseClient | null {
  const backend = process.env.LLM_EXTRACTION_CACHE_BACKEND ?? (process.env.VERCEL ? "supabase" : "local");
  return backend === "supabase" ? createServerSupabase() : null;
}

/** Cache extracted assertions, never final verified events. Revalidate on every use.
 * The complete request (including model and prompt version) forms the key.
 * CLI runs use a directory; serverless uses the private database cache. Both
 * also use bounded process memory and coalesce concurrent identical requests.
 */
export async function cachedExtraction<T>(request: unknown, run: () => Promise<Reply<T>>): Promise<Reply<T> & { cached: boolean }> {
  const key = createHash("sha256").update(JSON.stringify(request)).digest("hex");
  const dir = process.env.LLM_EXTRACTION_CACHE_DIR;
  const path = dir ? resolve(dir, `${key}.json`) : null;
  const db = databaseCache();
  let saved = memory.get(key);
  if (!saved && db) {
    prune ??= (async () => {
      const { error } = await db.from("pipeline_extraction_cache").delete().lt("expires_at", new Date().toISOString());
      if (error) throw new Error(`Pruning extraction cache: ${error.message}`);
    })();
    await prune;
    const { data, error } = await db.from("pipeline_extraction_cache").select("value,saved_at")
      .eq("key", key).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (error) throw new Error(`Reading extraction cache (apply pipeline migration first): ${error.message}`);
    if (data) saved = { value: data.value, savedAt: Date.parse(data.saved_at) };
  } else if (!saved && path) {
    const disk = await readJson<Entry>(path);
    if (disk && typeof disk.savedAt === "number" && "value" in disk) saved = disk;
  }
  if (saved && Date.now() - saved.savedAt < MAX_AGE) {
    return { value: saved.value as T, usage: NO_USAGE, cached: true };
  }
  const waiting = pending.get(key);
  if (waiting) return { value: (await waiting).value as T, usage: NO_USAGE, cached: true };
  const work = (async () => {
    const reply = await run(); // Failed/partial responses are never checkpoints.
    const entry = { value: reply.value, savedAt: Date.now() };
    memory.set(key, entry);
    while (memory.size > MAX_ENTRIES) memory.delete(memory.keys().next().value!);
    try {
      if (db) {
        const { error } = await db.from("pipeline_extraction_cache").upsert({ key, value: reply.value,
          saved_at: new Date(entry.savedAt).toISOString(), expires_at: new Date(entry.savedAt + MAX_AGE).toISOString() }, { onConflict: "key" });
        if (error) throw new Error(error.message);
      } else if (path) await writeJsonAtomic(path, entry);
    } catch (error) {
      // The model was already billed even if its checkpoint could not be saved.
      throw new LlmResponseError(`Saving extraction checkpoint: ${error instanceof Error ? error.message : error}`, reply.usage);
    }
    return reply;
  })();
  pending.set(key, work);
  try { return { ...await work, cached: false }; }
  finally { pending.delete(key); }
}
