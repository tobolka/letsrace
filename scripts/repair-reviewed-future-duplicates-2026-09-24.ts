/** Merge two checked future duplicate pairs. Dry by default. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerSupabase } from "../src/lib/supabase/server";
import { mergeEventPair } from "../src/lib/catalog/merge-duplicates";

try {
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]!]) process.env[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
  }
} catch { /* Environment may already be loaded. */ }

const PAIRS = [
  {
    keep: "eea36490-37d8-4f3f-aa50-9f62d0d1a3cd",
    drop: "2927f19b-1b5c-45e6-b42a-37ab4a247e27",
    date: "2027-01-03", keepName: "UCI Cyclo-cross World Cup — Zonhoven",
    dropName: "9. závod SP (ME,WE) — Zonhoven (Belgie)",
    officialHost: "ucicyclocrossworldcup.com",
  },
  {
    keep: "c04842aa-824c-4879-af74-3013d5c47681",
    drop: "39587dda-4c6d-43a5-aac3-e483543a297c",
    date: "2027-06-19", keepName: "L'Etape Czech Republic - Hilly Stage 2027",
    dropName: "Kopcovitá etapa 2027 (Hilly Stage)",
    officialHost: "letapeczech.cz",
  },
] as const;

async function main() {
  const sb = createServerSupabase();
  for (const pair of PAIRS) {
    const { data, error } = await sb.from("events")
      .select("id,name,start_date,website_url,merged_into_id,location:locations(lat,lng)")
      .in("id", [pair.keep, pair.drop]);
    if (error || data?.length !== 2) throw new Error(error?.message ?? "Reviewed pair missing");
    const keep = data.find((row) => row.id === pair.keep);
    const drop = data.find((row) => row.id === pair.drop);
    const loc = (row: typeof keep) => Array.isArray(row?.location) ? row?.location[0] : row?.location;
    if (!keep || !drop || keep.name !== pair.keepName || drop.name !== pair.dropName ||
        keep.start_date !== pair.date || drop.start_date !== pair.date ||
        keep.merged_into_id || drop.merged_into_id ||
        loc(keep)?.lat !== loc(drop)?.lat || loc(keep)?.lng !== loc(drop)?.lng ||
        !keep.website_url?.includes(pair.officialHost)) {
      throw new Error(`${pair.date}: reviewed identity changed`);
    }
    console.log(`${drop.name} → ${keep.name}`);
    if (process.argv.includes("--apply")) await mergeEventPair(pair.keep, pair.drop);
  }
  console.log(process.argv.includes("--apply") ? "Merged" : "Dry run only");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
