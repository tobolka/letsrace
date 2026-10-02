/**
 * Final recount of doplněný CSV series race coverage.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { listEvents } from "../src/lib/events";

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}
loadEnv();

function splitLine(line: string, delim: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === delim && !inQ) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

function parseCsv(path: string) {
  const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const lines = raw.split("\n").filter(Boolean);
  const headers = splitLine(lines[0]!, ",");
  return lines.slice(1).map((line) => {
    const parts = splitLine(line, ",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = (parts[i] || "").trim();
    });
    return row;
  });
}

async function main() {
  const csv = "/Users/radektobolka/Downloads/regional-2026-doplneny-kalendar-url.csv";
  const rows = parseCsv(csv);
  let withRaces = 0;
  let zero = 0;
  let totalRaces = 0;
  const zeros: Record<string, string>[] = [];
  const byStat: Record<string, { ok: number; zero: number }> = {};

  for (const r of rows) {
    const st = r.stat || "?";
    byStat[st] ||= { ok: 0, zero: 0 };
    let n = 0;
    try {
      n = (await listEvents({ seriesSlug: r.slug })).length;
    } catch {
      n = 0;
    }
    if (n > 0) {
      withRaces++;
      totalRaces += n;
      byStat[st]!.ok++;
    } else {
      zero++;
      byStat[st]!.zero++;
      zeros.push(r);
    }
  }

  const summary = { csv: rows.length, withRaces, zero, totalRacesLinked: totalRaces, byStat };
  console.log(JSON.stringify(summary, null, 2));
  console.log("\nSTILL ZERO:");
  for (const z of zeros) {
    console.log(`${z.stat} | ${z.serie} | ${(z.kalendar_url || "").slice(0, 70)}`);
  }

  const headers = Object.keys(rows[0] || {});
  const outLines = [
    headers.join(","),
    ...zeros.map((r) =>
      headers
        .map((h) => {
          const v = r[h] || "";
          return /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(","),
    ),
  ];
  writeFileSync("/Users/radektobolka/Downloads/regional-2026-stale-chybi.csv", outLines.join("\n") + "\n");
  writeFileSync(
    resolve(process.cwd(), "tmp/regional-2026-stale-chybi.csv"),
    outLines.join("\n") + "\n",
  );
  console.log("\nwrote Downloads + tmp regional-2026-stale-chybi.csv", zeros.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
