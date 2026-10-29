import { LlmUnavailable } from "./errors";
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

type State = { reason: string; retryAt: number; generation: string; probe?: string; leaseUntil?: number };
type States = Record<string, State>;

export class ProviderDeferred extends LlmUnavailable {
  override name = "ProviderDeferred";
  constructor(provider: string, state: State) {
    super(`provider_deferred:${provider}:${state.reason}:retry_at=${new Date(Math.max(state.retryAt, state.leaseUntil ?? 0)).toISOString()}`);
  }
}

/** Account-wide problems, not a bad document or a malformed model answer. */
export function providerFailure(message: string): { reason: string; delayMs: number } | null {
  if (/credit balance|insufficient_quota|billing/i.test(message)) return { reason: "credit", delayMs: 15 * 60_000 };
  if (/API 40[13]|HTTP 40[13]|API_KEY.*(not set|not configured)/i.test(message)) return { reason: "credentials", delayMs: 60 * 60_000 };
  if (/API 429|HTTP 429/.test(message)) return { reason: "rate_limit", delayMs: 60_000 };
  if (/API 5\d\d|HTTP 5\d\d/.test(message)) return { reason: "provider_unavailable", delayMs: 60_000 };
  return null;
}

/** CLI processes share this file; serverless without a path is process-local. */
export class ProviderHealth {
  private memory: States = {};
  constructor(private readonly path?: string, private readonly now: () => number = Date.now) {}

  private async edit<T>(fn: (states: States) => T): Promise<T> {
    if (!this.path) return fn(this.memory);
    await mkdir(dirname(this.path), { recursive: true });
    const lock = `${this.path}.lock`;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    for (let n = 0; n < 200; n++) {
      try { handle = await open(lock, "wx"); break; }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        try {
          const owner = JSON.parse(await readFile(lock, "utf8")) as { pid: number };
          try { process.kill(owner.pid, 0); }
          catch (e) { if ((e as NodeJS.ErrnoException).code === "ESRCH") await unlink(lock); }
        } catch {
          const info = await stat(lock).catch(() => null);
          if (info && Date.now() - info.mtimeMs > 30_000) await unlink(lock).catch(() => {});
        }
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }
    if (!handle) throw new Error("provider_deferred:state_busy");
    try {
      await handle.writeFile(JSON.stringify({ pid: process.pid }));
      let states: States;
      try { states = JSON.parse(await readFile(this.path, "utf8")) as States; }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; states = {}; }
      const result = fn(states);
      const temp = `${this.path}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(states));
      await rename(temp, this.path);
      return result;
    } finally { await handle.close(); await unlink(lock); }
  }

  /** Explicit operator recovery after replenishing credit; never unlock an active probe. */
  async retryCredit(provider: string): Promise<void> {
    await this.edit(states => {
      const state = states[provider];
      if (state?.reason === "credit" && (state.leaseUntil ?? 0) <= this.now()) state.retryAt = this.now();
    });
  }

  async run<T>(provider: string, request: () => Promise<T>): Promise<T> {
    const probe = await this.edit(states => {
      const state = states[provider];
      if (!state) return null;
      if (state.retryAt > this.now() || (state.leaseUntil ?? 0) > this.now()) throw new ProviderDeferred(provider, state);
      // Only one request probes recovery, even across parallel CLI processes.
      state.probe = randomUUID(); state.leaseUntil = this.now() + 5 * 60_000;
      return state.probe;
    });
    try {
      const result = await request();
      if (probe) await this.edit(states => { if (states[provider]?.probe === probe) delete states[provider]; });
      return result;
    } catch (error) {
      const failure = providerFailure(error instanceof Error ? error.message : String(error));
      if (failure) {
        const state = await this.edit(states => {
          const value = { reason: failure.reason, retryAt: this.now() + failure.delayMs, generation: randomUUID() };
          states[provider] = value; return value;
        });
        throw new ProviderDeferred(provider, state);
      }
      if (probe) await this.edit(states => {
        const state = states[provider];
        if (state?.probe === probe) { delete state.probe; delete state.leaseUntil; state.retryAt = this.now() + 60_000; }
      });
      throw error;
    }
  }
}

const instances = new Map<string, ProviderHealth>();
export function withProviderAvailability<T>(provider: string, request: () => Promise<T>) {
  const path = process.env.LLM_PROVIDER_STATE_PATH ?? (process.env.LLM_LEDGER_PATH ? `${process.env.LLM_LEDGER_PATH}.providers.json` : undefined);
  const key = path ?? "memory";
  if (!instances.has(key)) instances.set(key, new ProviderHealth(path));
  return instances.get(key)!.run(provider, request);
}
