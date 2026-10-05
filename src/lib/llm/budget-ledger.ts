import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

type Hold = { amount: number; day: string; month: string; at: number };
type Ledger = { days: Record<string, number>; months: Record<string, number>; holds: Record<string, Hold> };

/** Optional shared ledger for CLI jobs: process restarts cannot reset daily/monthly caps. */
export async function reserveSharedBudget(amount: number): Promise<((actual: number) => Promise<void>) | null> {
  const path = process.env.LLM_LEDGER_PATH;
  if (!path) return null;
  const daily = Number(process.env.LLM_DAILY_BUDGET_USD ?? 0.50);
  const monthly = Number(process.env.LLM_MONTHLY_BUDGET_USD ?? 5);
  if (![daily, monthly].every((n) => Number.isFinite(n) && n >= 0)) throw new Error("Shared LLM budgets must be finite and non-negative");
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const month = day.slice(0, 7);
  const id = randomUUID();
  const edit = async (change: (ledger: Ledger) => void) => {
    await mkdir(dirname(path), { recursive: true });
    const lock = `${path}.lock`;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    for (let attempts = 0; attempts < 100; attempts++) {
      try { handle = await open(lock, "wx"); break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const age = await stat(lock).catch(() => null);
        if (age && Date.now() - age.mtimeMs > 60_000) await unlink(lock).catch(() => {});
        await new Promise((r) => setTimeout(r, 25));
      }
    }
    if (!handle) throw new Error("Shared LLM budget is busy; retry later");
    try {
      let ledger: Ledger;
      try { ledger = JSON.parse(await readFile(path, "utf8")) as Ledger; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        ledger = { days: {}, months: {}, holds: {} };
      }
      // A crashed request may still have been billed: charge its reserved ceiling.
      for (const [key, hold] of Object.entries(ledger.holds)) if (Date.now() - hold.at > 10 * 60_000) {
        ledger.days[hold.day] = (ledger.days[hold.day] ?? 0) + hold.amount;
        ledger.months[hold.month] = (ledger.months[hold.month] ?? 0) + hold.amount;
        delete ledger.holds[key];
      }
      change(ledger);
      const temporary = `${path}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(ledger, null, 2) + "\n");
      await rename(temporary, path);
    } finally {
      await handle.close();
      await unlink(lock);
    }
  };
  await edit((ledger) => {
    const holds = Object.values(ledger.holds);
    const forDay = holds.filter((h) => h.day === day).reduce((sum, h) => sum + h.amount, 0);
    const forMonth = holds.filter((h) => h.month === month).reduce((sum, h) => sum + h.amount, 0);
    if ((ledger.days[day] ?? 0) + forDay + amount > daily || (ledger.months[month] ?? 0) + forMonth + amount > monthly) {
      throw new Error(`Shared LLM budget: next request exceeds daily $${daily} or monthly $${monthly} cap`);
    }
    ledger.holds[id] = { amount, day, month, at: Date.now() };
  });
  return async (actual) => {
    await edit((ledger) => {
      if (!ledger.holds[id]) return;
      const charged = Math.max(0, actual);
      ledger.days[day] = (ledger.days[day] ?? 0) + charged;
      ledger.months[month] = (ledger.months[month] ?? 0) + charged;
      delete ledger.holds[id];
    });
  };
}
