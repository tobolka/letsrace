/** Bounded archive → review → fresh-source write; all stages share a total cap. */
import { spawnSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const budget = Number(process.env.LLM_BUDGET_USD ?? "0.40");
if (!Number.isFinite(budget) || budget < 0) throw new Error("Invalid total budget");
const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
mkdirSync("tmp/import-validation", { recursive: true });
const path = resolve(`tmp/import-validation/original-categories-${date}-${process.pid}.json`);
const max = process.argv.find(a => a.startsWith("--max=")) ?? "--max=20";
function run(args: string[], cap: number) {
  const result = spawnSync(process.execPath, [resolve("node_modules/tsx/dist/cli.mjs"), resolve("scripts/validate-import.ts"), ...args], {
    stdio: "inherit", env: { ...process.env, LLM_BUDGET_USD: String(cap) },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Category stage failed (${result.status})`);
}
run([max, `--out=${path}`], Math.min(budget, 0.10));
const plan = JSON.parse(readFileSync(path, "utf8")) as { costUsd: number; proposals: { audit?: unknown }[]; stopped: boolean };
run([max, `--audit-plan=${path}`], Math.max(0, budget - plan.costUsd));
const audited = JSON.parse(readFileSync(path, "utf8")) as typeof plan;
// A bounded partial audit can write verified proposals; pending ones are never applied.
if (process.argv.includes("--apply")) run([`--apply-plan=${path}`], 0);
if (audited.stopped || audited.proposals.some(p => !p.audit)) process.exitCode = 2;
