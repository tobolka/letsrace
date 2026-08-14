/**
 * Fill empty event (and series) age_categories from name + series.
 * Does not overwrite non-empty age_categories.
 *
 * Usage: nvm use 22 && npx tsx scripts/backfill-age-categories.ts
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
  start_date?: string;
  audience: string | null;
  age_categories: string[] | null;
  level: string | null;
  class_label: string | null;
  disciplines: string[] | null;
  series: { name: string | null; slug: string | null } | null;
};

async function main() {
  let offset = 0;
  const page = 200;
  let updated = 0;
  let skipped = 0;
  let unchanged = 0;

  for (;;) {
    const res = await fetch(
      `${url}/rest/v1/events?select=id,name,start_date,audience,age_categories,level,class_label,disciplines,series:series(name,slug)&offset=${offset}&limit=${page}&order=start_date`,
      { headers },
    );
    if (!res.ok) throw new Error(`fetch ${res.status}: ${await res.text()}`);
    const rows = (await res.json()) as Row[];
    if (!rows.length) break;

    for (const row of rows) {
      if ((row.age_categories ?? []).length) {
        skipped += 1;
        continue;
      }
      const classified = inferClassification({
        name: row.name,
        seriesName: row.series?.name,
        seriesSlug: row.series?.slug,
        disciplines: row.disciplines,
        existingLevel: row.level,
        existingClassLabel: row.class_label,
        existingAudience: row.audience,
        startDate: row.start_date,
      });
      if (!classified.ageCategories.length) {
        unchanged += 1;
        continue;
      }
      const up = await fetch(`${url}/rest/v1/events?id=eq.${row.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          age_categories: classified.ageCategories,
          audience: classified.audience,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!up.ok) {
        console.error(row.id, row.name, await up.text());
        continue;
      }
      updated += 1;
    }

    console.log(
      `events ${offset + rows.length} (filled ${updated}, already set ${skipped}, still unknown ${unchanged})`,
    );
    offset += page;
    if (rows.length < page) break;
  }

  // Series: copy inferred ages onto series with empty age_categories
  const seriesRes = await fetch(
    `${url}/rest/v1/series?select=id,name,slug,age_categories,audience_hint,level&visibility=eq.public`,
    { headers },
  );
  if (!seriesRes.ok) throw new Error(`series ${seriesRes.status}: ${await seriesRes.text()}`);
  const seriesRows = (await seriesRes.json()) as {
    id: string;
    name: string;
    slug: string;
    age_categories: string[] | null;
    audience_hint: string | null;
    level: string | null;
  }[];
  let seriesUpdated = 0;
  for (const s of seriesRows) {
    if ((s.age_categories ?? []).length) continue;
    const classified = inferClassification({
      name: s.name,
      seriesName: s.name,
      seriesSlug: s.slug,
      existingLevel: s.level,
      existingAudience: s.audience_hint,
    });
    if (!classified.ageCategories.length) continue;
    const up = await fetch(`${url}/rest/v1/series?id=eq.${s.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        age_categories: classified.ageCategories,
        audience_hint: classified.audience,
        updated_at: new Date().toISOString(),
      }),
    });
    if (!up.ok) {
      console.error("series", s.slug, await up.text());
      continue;
    }
    seriesUpdated += 1;
  }

  console.log(
    `Done. Events filled ${updated}, still unknown ${unchanged}. Series filled ${seriesUpdated}.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
