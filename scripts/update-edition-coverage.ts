/**
 * Recompute edition-coverage.json directly from the live production catalogue,
 * so the Mac menu bar counter reflects every public next-season edition
 * (whether added by automated cycles or manually via add-announced-races.ts).
 *
 *   npx tsx scripts/update-edition-coverage.ts [--season=2026] [--countries=CZ,SK,DE,AT,PL,CH,IT] [--out=FILE]
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "dotenv";
import {
  computeEditionCoverage,
  DEFAULT_COVERAGE_COUNTRIES,
  mergeEditionCoverageHistory,
  type EditionCoverageFile,
  type EditionCoverageHistoryRow,
} from "../src/lib/catalog/edition-coverage";
import type { EditionIdentity } from "../src/lib/catalog/edition-identity";
import { defaultEditionSeason } from "../src/lib/catalog/edition-season";
import { createServerSupabase } from "../src/lib/supabase/server";

export function defaultCoveragePath(): string {
  const dataDir =
    process.env.LETSRACE_DATA_DIR ||
    join(homedir(), "Library", "Application Support", "LetsRace", "data");
  return join(dataDir, "edition-coverage.json");
}

function loadLocalEnv(): void {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const [key, value] of Object.entries(parse(readFileSync(envPath, "utf8")))) {
    process.env[key] ??= value;
  }
}

async function readPublicEvents(
  from: string,
  until: string,
  excludeRides: boolean,
): Promise<EditionIdentity[]> {
  const db = createServerSupabase();
  const rows: EditionIdentity[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = db
      .from("events")
      .select("id,name,start_date,series_id,disciplines,location:locations(lat,lng,municipality,country_code)")
      .eq("visibility", "public")
      .is("merged_into_id", null)
      .gte("start_date", from)
      .lt("start_date", until)
      .order("id")
      .range(offset, offset + 999);
    if (excludeRides) query = query.or("event_type.is.null,event_type.neq.ride");
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as unknown as EditionIdentity[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export async function refreshLiveEditionCoverage(options: {
  season?: number;
  countries?: readonly string[];
  outPath?: string;
} = {}): Promise<EditionCoverageFile> {
  loadLocalEnv();
  const season = options.season ?? defaultEditionSeason();
  const target = season + 1;
  const countries = options.countries ?? DEFAULT_COVERAGE_COUNTRIES;
  const outPath = options.outPath ?? defaultCoveragePath();

  const [previous, upcoming] = await Promise.all([
    readPublicEvents(`${season}-01-01`, `${target}-01-01`, true),
    readPublicEvents(`${target}-01-01`, `${target + 1}-01-01`, false),
  ]);

  const current = computeEditionCoverage(previous, upcoming, target, countries);
  let oldHistory: EditionCoverageHistoryRow[] = [];
  try {
    const existing = JSON.parse(readFileSync(outPath, "utf8")) as { history?: EditionCoverageHistoryRow[] };
    if (Array.isArray(existing.history)) oldHistory = existing.history;
  } catch {
    // Missing or unreadable previous file: start fresh history.
  }

  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const result: EditionCoverageFile = {
    at: now.toISOString(),
    ...current,
    history: mergeEditionCoverageHistory(oldHistory, current, day),
  };

  mkdirSync(dirname(outPath), { recursive: true, mode: 0o700 });
  const temp = `${outPath}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(result, null, 2), { mode: 0o600 });
  renameSync(temp, outPath);
  return result;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const arg = (name: string) =>
    process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const seasonArg = arg("season");
  const season = seasonArg ? Number(seasonArg) : undefined;
  const countriesArg = arg("countries");
  const countries = countriesArg ? countriesArg.split(",").filter(Boolean) : undefined;
  const outPath = arg("out");
  refreshLiveEditionCoverage({ season, countries, outPath })
    .then(result => {
      console.log(
        `edition_coverage ${JSON.stringify({ season: result.season, races: result.races, withEdition: result.withEdition, publicRaces: result.publicRaces })}`,
      );
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
