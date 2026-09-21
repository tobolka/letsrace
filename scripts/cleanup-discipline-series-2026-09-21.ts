/**
 * Detach races from Hynek discipline-label series shells and hide them.
 * Usage: npx tsx scripts/cleanup-discipline-series-2026-09-21.ts [--dry]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const DRY = process.argv.includes("--dry");
const JUNK_RE = /^(cmm|mcc|edr|track|[0-9]+-(xcm|xco)|[0-9]+-xco-xcc)/;

async function main() {
  const sb = createServerSupabase();
  const { data: all, error } = await sb
    .from("series")
    .select("id, slug")
    .eq("visibility", "public")
    .limit(5000);
  if (error) throw new Error(error.message);

  const rows = (all ?? []).filter((s) => JUNK_RE.test(s.slug as string));
  console.log(
    "junk",
    rows.map((r) => r.slug),
    "dry=",
    DRY,
  );
  if (!rows.length || DRY) return;

  const ids = rows.map((r) => r.id as string);
  const now = new Date().toISOString();
  const { data: detached } = await sb
    .from("events")
    .update({ series_id: null, updated_at: now })
    .in("series_id", ids)
    .is("merged_into_id", null)
    .select("id");
  await sb.from("event_series").delete().in("series_id", ids);
  const { data: hid } = await sb
    .from("series")
    .update({ visibility: "hidden", updated_at: now })
    .in("id", ids)
    .select("slug");
  console.log("detached", detached?.length ?? 0, "hidden", (hid ?? []).map((h) => h.slug).join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
