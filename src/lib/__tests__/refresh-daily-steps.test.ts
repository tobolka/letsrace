import { expect, it } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

it("resumes failed and deadline-skipped daily steps while preserving successful work", () => {
  const source = readFileSync("scripts/refresh-data.sh", "utf8");
  const functions = source.slice(source.indexOf("step() {"), source.indexOf('step "Coverage before"'));
  const directory = mkdtempSync(join(tmpdir(), "letsrace-refresh-"));
  try {
    execFileSync("bash", ["-c", `set -eu
${functions}
TODAY=2026-10-08
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
SOURCE_RUN_DEADLINE=0
LLM_FORCE_DAILY=1
daily_step "Reader" scripts/fill-llm-enrich.ts --apply
[ "$CALLS" = "5" ]
# A deferred read must not stamp the step complete or count as a crash.
FAIL_ON=2
daily_step "Deferred" scripts/deferred-reader.ts --apply
[ "$DEFERRED" = "1" ]
[ "$FAILURES" = "1" ]
[ ! -f tmp/.llm-steps/deferred-reader-apply ]
FAIL_ON=0
daily_step "Deferred" scripts/deferred-reader.ts --apply
[ -f tmp/.llm-steps/deferred-reader-apply ]
`], { cwd: directory, stdio: "pipe" });
    expect(true).toBe(true);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
