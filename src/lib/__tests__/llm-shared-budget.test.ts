import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { reserveSharedBudget } from "@/lib/llm/budget-ledger";
let directory: string | undefined;
afterEach(async () => { vi.unstubAllEnvs(); if (directory) await rm(directory, { recursive: true, force: true }); directory = undefined; });
it("shares reservations and actual spending across callers", async () => {
  directory = await mkdtemp(join(tmpdir(), "letsrace-budget-"));
  vi.stubEnv("LLM_LEDGER_PATH", join(directory, "budget.json"));
  vi.stubEnv("LLM_DAILY_BUDGET_USD", "0.10");
  vi.stubEnv("LLM_MONTHLY_BUDGET_USD", "1");
  const first = await reserveSharedBudget(0.07);
  await expect(reserveSharedBudget(0.04)).rejects.toThrow("Shared LLM budget");
  await first!(0.01);
  const second = await reserveSharedBudget(0.08);
  await second!(0.08);
  await expect(reserveSharedBudget(0.02)).rejects.toThrow("Shared LLM budget");
});
it("enforces the monthly cap even when the daily cap has room", async () => {
  directory = await mkdtemp(join(tmpdir(), "letsrace-budget-"));
  vi.stubEnv("LLM_LEDGER_PATH", join(directory, "budget.json"));
  vi.stubEnv("LLM_DAILY_BUDGET_USD", "10");
  vi.stubEnv("LLM_MONTHLY_BUDGET_USD", "0.05");
  const first = await reserveSharedBudget(0.04);
  await first!(0.04);
  await expect(reserveSharedBudget(0.02)).rejects.toThrow("monthly");
});
it("fails closed on a corrupt ledger", async () => {
  directory = await mkdtemp(join(tmpdir(), "letsrace-budget-"));
  const path = join(directory, "budget.json");
  vi.stubEnv("LLM_LEDGER_PATH", path);
  await writeFile(path, "broken ledger");
  await expect(reserveSharedBudget(0.01)).rejects.toThrow();
});

it("allows sequential refresh steps under the default daily cap and frees unused reservations", async () => {
  directory = await mkdtemp(join(tmpdir(), "letsrace-budget-"));
  vi.stubEnv("LLM_LEDGER_PATH", join(directory, "budget.json"));
  vi.stubEnv("LLM_DAILY_BUDGET_USD", undefined);
  vi.stubEnv("LLM_MONTHLY_BUDGET_USD", undefined);
  // Each reservation is larger than the eventual bill. A $0.15 daily cap
  // would block the second step, despite only $0.02 having been spent.
  const calendar = await reserveSharedBudget(0.12);
  await calendar!(0.02);
  const research = await reserveSharedBudget(0.20);
  await research!(0.03);
  const enrichment = await reserveSharedBudget(0.20);
  await enrichment!(0.04);
  const audit = await reserveSharedBudget(0.35);
  await audit!(0);
  // Actual spending is $0.09; the daily ceiling remains $0.50.
  await expect(reserveSharedBudget(0.42)).rejects.toThrow("daily $0.5");
});
