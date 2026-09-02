/**
 * One-off: re-tag MTB marathons whose XCM was lost to the spelling of the word.
 * "maratón" and "minimaraton" both slipped past the old pattern, so a race
 * could be named after a marathon and still be missing from the XCM filter.
 *
 * Only ever adds "xcm" to a race the current rules would tag; nothing is
 * removed, so a wrong existing tag stays a separate question.
 *
 * Usage: npx tsx scripts/backfill-mtb-marathons.ts [--apply]
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inferDisciplines } from "../src/lib/taxonomy";

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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase env (need SUPABASE_SERVICE_ROLE_KEY)");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

type Row = { id: string; name: string; disciplines: string[] | null };

async function page(offset: number): Promise<Row[]> {
  const res = await fetch(
    `${url}/rest/v1/events?select=id,name,disciplines&order=id&limit=1000&offset=${offset}`,
    { headers },
  );
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as Row[];
}

async function main() {
  let offset = 0;
  let scanned = 0;
  const changes: { id: string; name: string; from: string[]; to: string[] }[] = [];

  for (;;) {
    const rows = await page(offset);
    if (rows.length === 0) break;
    scanned += rows.length;
    for (const row of rows) {
      const current = row.disciplines ?? [];
      if (current.includes("xcm")) continue;
      const next = inferDisciplines(row.name, current);
      if (!next.includes("xcm")) continue;
      changes.push({ id: row.id, name: row.name, from: current, to: next });
    }
    offset += rows.length;
    if (rows.length < 1000) break;
  }

  console.log(`scanned ${scanned}, would change ${changes.length}`);
  for (const c of changes.slice(0, 40)) {
    console.log(`  ${c.name}  ${JSON.stringify(c.from)} -> ${JSON.stringify(c.to)}`);
  }
  if (changes.length > 40) console.log(`  … and ${changes.length - 40} more`);
  if (!apply) {
    console.log("\ndry run — pass --apply to write");
    return;
  }

  let written = 0;
  for (const c of changes) {
    const res = await fetch(`${url}/rest/v1/events?id=eq.${c.id}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ disciplines: c.to }),
    });
    if (!res.ok) {
      console.error(`  failed ${c.name}: ${res.status} ${await res.text()}`);
      continue;
    }
    written += 1;
  }
  console.log(`written ${written}`);
}

void main();
