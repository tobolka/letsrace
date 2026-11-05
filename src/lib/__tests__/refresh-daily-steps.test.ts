import { expect, it } from "vitest";
import { readFileSync, mkdtempSync, rmSync, mkdirSync, copyFileSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

it("resumes failed and deadline-skipped daily steps while preserving successful work", () => {
  const source = readFileSync("scripts/refresh-data.sh", "utf8");
  const functions = source.slice(source.indexOf("step() {"), source.indexOf('# Main bounded cycle.'));
  const directory = mkdtempSync(join(tmpdir(), "letsrace-refresh-"));
  try {
    execFileSync("bash", ["-c", `set -eu
${functions}
TODAY=2026-10-08
SOURCE_RUN_DEADLINE=$(( $(date +%s) + 900 ))
FAILURES=0
DEFERRED=0
CALLS=0
FAIL_ON=0
node() { CALLS=$((CALLS + 1)); return "$FAIL_ON"; }
daily_step "Series" scripts/enrich-series-documents.ts --apply
[ "$CALLS" = "1" ]
daily_step "Series" scripts/enrich-series-documents.ts --apply
[ "$CALLS" = "1" ]
# A reviewed step must not prevent the separate apply mode.
daily_step "Series review" scripts/enrich-series-documents.ts
[ "$CALLS" = "2" ]
FAIL_ON=1
daily_step "Reader" scripts/fill-llm-enrich.ts --apply
[ "$FAILURES" = "1" ]
[ ! -f tmp/.llm-steps/fill-llm-enrich-apply ]
FAIL_ON=0
daily_step "Reader" scripts/fill-llm-enrich.ts --apply
[ "$CALLS" = "4" ]
[ -f tmp/.llm-steps/fill-llm-enrich-apply ]
SOURCE_RUN_DEADLINE=1
daily_step "Classes" scripts/fill-dossier-classes.ts --apply
[ "$CALLS" = "4" ]
[ ! -f tmp/.llm-steps/fill-dossier-classes-apply ]
[ "$DEFERRED" = "1" ]
SOURCE_RUN_DEADLINE=$(( $(command date +%s) + 900 ))
LLM_FORCE_DAILY=1
daily_step "Reader" scripts/fill-llm-enrich.ts --apply
[ "$CALLS" = "5" ]
# A deferred read must not stamp the step complete or count as a crash.
FAIL_ON=2
daily_step "Deferred" scripts/deferred-reader.ts --apply
[ "$DEFERRED" = "2" ]
[ "$FAILURES" = "1" ]
[ ! -f tmp/.llm-steps/deferred-reader-apply ]
FAIL_ON=0
daily_step "Deferred" scripts/deferred-reader.ts --apply
[ -f tmp/.llm-steps/deferred-reader-apply ]
`], { cwd: directory, stdio: "pipe" });
    expect(true).toBe(true);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

it("gives the main cycle a bounded source batch, enrichment and publication before optional maintenance", () => {
  const directory = mkdtempSync(join(tmpdir(), "letsrace-cycle-"));
  try {
    mkdirSync(join(directory, "scripts")); mkdirSync(join(directory, "bin"));
    for (const file of ["refresh-data.sh", "pipeline-mode.sh"]) copyFileSync(join("scripts",file),join(directory,"scripts",file));
    const fake = join(directory,"bin","node");
    writeFileSync(fake, '#!/bin/bash\nprintf "%s\\n" "$*" >> "$CALL_LOG"\n'); chmodSync(fake, 0o755);
    execFileSync("bash", [join(directory,"scripts","refresh-data.sh")], { env: { ...process.env,
      PATH: `${join(directory,"bin")}:${process.env.PATH}`, CALL_LOG: join(directory,"calls"), PIPELINE_AI_MODE: "free", PIPELINE_SKIP_MAINTENANCE: "1", SOURCE_RUN_DEADLINE: "0",
    }, stdio: "pipe" });
    const calls = readFileSync(join(directory,"calls"),"utf8").split("\n").filter(Boolean);
    expect(calls.filter(line => line.includes("reload-calendars.ts"))).toHaveLength(1);
    expect(calls.find(line => line.includes("reload-calendars.ts"))).toContain("--rounds=1 --limit=30");
    expect(calls.some(line => line.includes("drain-due-watches"))).toBe(false);
    const enrichment = calls.findIndex(line => line.includes("enrich-practical-details"));
    expect(enrichment).toBeGreaterThan(0);
    expect(calls[enrichment]).toContain("--max=20 --minutes=4 --structured-only --apply");
    expect(calls.findIndex(line => line.includes("publish-catalogue-changes"))).toBeGreaterThan(enrichment);
    expect(calls.some(line => line.includes("fill-registration-links"))).toBe(false);
    expect(calls.every(line => line.includes("bounded-pipeline-step.cjs"))).toBe(true);
  } finally { rmSync(directory,{ recursive: true, force: true }); }
});

function runCycles(env: Record<string, string>, cycles = 1) {
  const directory = mkdtempSync(join(tmpdir(), "letsrace-cycle-"));
  try {
    mkdirSync(join(directory, "scripts")); mkdirSync(join(directory, "bin"));
    for (const file of ["refresh-data.sh", "pipeline-mode.sh"]) copyFileSync(join("scripts", file), join(directory, "scripts", file));
    const fake = join(directory, "bin", "node");
    writeFileSync(fake, '#!/bin/bash\nprintf "%s\\n" "$*" >> "$CALL_LOG"\n'); chmodSync(fake, 0o755);
    const options = { env: { ...process.env, PATH: `${join(directory, "bin")}:${process.env.PATH}`, CALL_LOG: join(directory, "calls"), SOURCE_RUN_DEADLINE: "0", ...env }, stdio: "pipe" as const };
    for (let cycle = 0; cycle < cycles; cycle++) execFileSync("bash", [join(directory, "scripts", "refresh-data.sh")], options);
    return readFileSync(join(directory, "calls"), "utf8").split("\n").filter(Boolean);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}
const capOf = (line: string | undefined) => Number(/bounded-pipeline-step\.cjs (\d+) /.exec(line ?? "")?.[1]);

it("merges sure duplicates every free cycle without calling the model", () => {
  const calls = runCycles({ PIPELINE_AI_MODE: "free" }, 2);
  expect(calls.filter(line => line.includes("merge-duplicates.ts"))).toHaveLength(2);
  expect(calls.some(line => line.includes("judge-duplicates.ts"))).toBe(false);
  expect(calls.findIndex(line => line.includes("merge-duplicates.ts"))).toBeGreaterThan(calls.findIndex(line => line.includes("publish-catalogue-changes.ts")));
  expect(capOf(calls.find(line => line.includes("fill-registration-links.ts")))).toBe(300);
});

it("judges duplicates across all future races before other model readers can spend the day's cap", () => {
  const calls = runCycles({ PIPELINE_AI_MODE: "ai" });
  const judged = calls.filter(line => line.includes("judge-duplicates.ts"));
  expect(judged).toHaveLength(1);
  expect(judged[0]).toContain("--max=150 --apply");
  expect(judged[0]).not.toContain("--newer-than-hours");
  expect(calls.indexOf(judged[0]!)).toBeLessThan(calls.findIndex(line => line.includes("fill-llm-enrich.ts")));
  expect(capOf(judged[0])).toBeGreaterThan(4433);
});

it("gives a deep collection the hours it asked for, without loosening other steps", () => {
  const calls = runCycles({ PIPELINE_AI_MODE: "free", SOURCE_DEEP: "1", SOURCE_DEEP_HOURS: "4" });
  const deep = calls.find(line => line.includes("collect-source-dossiers.ts"));
  expect(capOf(deep)).toBeGreaterThan(3 * 3600);
  expect(deep).toMatch(/--hours=[34]\./);
  expect(capOf(calls.find(line => line.includes("fill-registration-links.ts")))).toBe(300);
});

it('runs the browser task once per week, records partial work, and does not stamp deadline skips', () => {
 const source = readFileSync('scripts/refresh-data.sh', 'utf8');
 const functions = source.slice(source.indexOf('step() {'), source.indexOf('# Main bounded cycle.'));
 const directory = mkdtempSync(join(tmpdir(), 'letsrace-browser-'));
 try {
  execFileSync('bash', ['-c', `set -eu
${functions}
mkdir -p tmp
FAILURES=0 DEFERRED=0 CALLS=0
node() { CALLS=$((CALLS+1)); return 2; }
date() { case "$*" in +%u) echo 1 ;; +%H) echo 10 ;; +%G-%V) echo 2026-44 ;; *) command date "$@" ;; esac; }
SOURCE_RUN_DEADLINE=1
weekly_browser_step
[ ! -f tmp/.browser-csc-week ] && [ "$CALLS" = 0 ]
SOURCE_RUN_DEADLINE=$(( $(command date +%s) + 900 ))
weekly_browser_step
[ "$(cat tmp/.browser-csc-week)" = 2026-44 ] && [ "$CALLS" = 1 ]
weekly_browser_step
[ "$CALLS" = 1 ] && [ "$DEFERRED" = 2 ]
`], { cwd: directory, stdio: 'pipe' });
  expect(true).toBe(true);
 } finally { rmSync(directory,{recursive:true,force:true}); }
});
