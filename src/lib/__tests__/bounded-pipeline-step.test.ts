import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";

it("preserves success and failures and ends an overlong phase as deferred work", () => {
  const run = (seconds: string, code: string) => spawnSync(process.execPath,
    ["scripts/bounded-pipeline-step.cjs",seconds,process.execPath,"-e",code], { encoding: "utf8", timeout: 7000 });
  expect(run("1","process.exit(0)").status).toBe(0);
  expect(run("1","process.exit(7)").status).toBe(7);
  const interrupted = run("0.1","require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)']);setInterval(()=>{},1000)");
  expect(interrupted.status).toBe(2);
  expect(interrupted.stdout).toContain("phase_time_budget");
  expect(interrupted.error).toBeUndefined();
});
