import { createServerSupabase } from "@/lib/supabase/server";

/** Only empty, unlocked race disciplines inherit from their current primary series. */
export async function fillDisciplinesFromSeries(): Promise<{ filled: number }> {
  const { data, error } = await createServerSupabase().rpc("pipeline_fill_series_disciplines", { p_limit: 3000 });
  if (error) throw new Error(`Filling disciplines from series: ${error.message}`);
  const result = data as { filled?: unknown } | null;
  if (!result || typeof result.filled !== "number" || !Number.isInteger(result.filled) || result.filled < 0 || result.filled > 3000) {
    throw new Error("Series discipline batch was not confirmed");
  }
  return { filled: result.filled };
}
