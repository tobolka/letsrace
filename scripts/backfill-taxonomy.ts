/**
 * One-off: normalize disciplines / levels / age categories / UCI class from event names.
 * Usage: npx tsx scripts/backfill-taxonomy.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inferClassification } from "../src/lib/taxonomy";

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!m) continue;
      const val = m[2].replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = val;
    }
  } catch {
    /* ignore */
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Missing Supabase env");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

type Row = {
  id: string;
  name: string;
  disciplines: string[] | null;
  level: string | null;
  class_label: string | null;
  audience: string | null;
  categories: { name: string }[] | null;
};

async function main() {
  let offset = 0;
  const page = 200;
  let updated = 0;
  for (;;) {
    const res = await fetch(
      `${url}/rest/v1/events?select=id,name,disciplines,level,class_label,audience,categories:event_categories(name)&offset=${offset}&limit=${page}`,
      { headers },
    );
    if (!res.ok) throw new Error(`fetch ${res.status}: ${await res.text()}`);
    const rows = (await res.json()) as Row[];
    if (!rows.length) break;

    for (const row of rows) {
      const classified = inferClassification({
        name: row.name,
        disciplines: row.disciplines,
        categoryNames: (row.categories ?? []).map((c) => c.name),
        existingLevel: row.level,
        existingClassLabel: row.class_label,
      });

      const up = await fetch(`${url}/rest/v1/events?id=eq.${row.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          disciplines: classified.disciplines,
          age_categories: classified.ageCategories,
          audience: classified.ageCategories.length
            ? classified.audience
            : row.audience || "mixed",
          level: classified.level,
          uci_class: classified.uciClass,
          class_label: classified.classLabel,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!up.ok) {
        console.error(row.id, await up.text());
        continue;
      }
      updated += 1;
    }

    console.log(`Processed ${offset + rows.length} (updated ${updated})`);
    offset += page;
    if (rows.length < page) break;
  }
  console.log(`Done. Updated ${updated} events.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
