import { expect, it } from "vitest";
import { spawnSync } from "node:child_process";

const run = (seconds: string, code: string, timeout = 7000) => spawnSync(process.execPath,
  ["scripts/bounded-pipeline-step.cjs",seconds,process.execPath,"-e",code], { encoding: "utf8", timeout });

it("preserves success and failures and ends an overlong phase as deferred work", () => {
  expect(run("1","process.exit(0)").status).toBe(0);
  expect(run("1","process.exit(7)").status).toBe(7);
  const interrupted = run("0.1","require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)']);setInterval(()=>{},1000)");
  expect(interrupted.status).toBe(2);
  expect(interrupted.stdout).toContain("phase_time_budget");
  expect(interrupted.error).toBeUndefined();
});

it("ends a worker that outlives its wrapper and ignores the request to stop", () => {
  // The wrapper dies at once; the worker it started keeps our output open and ignores SIGTERM.
  const worker = "process.on('SIGTERM',()=>{});console.log('worker '+process.pid);setInterval(()=>{},1000)";
  const wrapper = `require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(worker)}],{stdio:'inherit'});setInterval(()=>{},1000)`;
  const started = Date.now();
  const result = run("0.3", wrapper, 15000);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(2);
  expect(Date.now() - started).toBeLessThan(9000);
  const pid = Number(/worker (\d+)/.exec(result.stdout)?.[1]);
  expect(pid).toBeGreaterThan(0);
  expect(() => process.kill(pid, 0)).toThrow();
}, 20000);
