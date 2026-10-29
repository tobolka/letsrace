import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { ParsedEvent } from "@/lib/domain";
import { discoveryUrl, hash, type RaceHint, type SearchSpec, type DiscoveryCountry } from "./plan";
import { assessCandidate } from "./assessment";

export type SearchTask = { kind: "search"; spec: SearchSpec };
export type ReadTask = { kind: "read"; url: string; season: number; depth: number; lane: "blind" | "benchmark" };
export type Task = (SearchTask | ReadTask) & {
  id: string; status: "pending" | "running" | "done" | "retry";
  attempts: number; availableAt: number; token?: string; leaseUntil?: number;
  error?: string; origins: string[]; result?: unknown;
  history?: { at: string; result: unknown; error?: string }[];
  completedAt?: number;
};
export type Candidate = {
  id: string; season: number; sourceUrl: string; event: ParsedEvent;
  state: "needs_review" | "out_of_scope"; snapshot: string; origins: string[];
  issues?: string[]; dateStatus?: "tentative" | "requires_verification";
};
export type DiscoveryState = {
  version: 1; tasks: Record<string, Task>; candidates: Record<string, Candidate>;
  hints: { taskId: string; hint: RaceHint }[];
  readerVersion?: string;
  country?: DiscoveryCountry;
};
export const emptyState = (): DiscoveryState => ({ version: 1, tasks: {}, candidates: {}, hints: [] });

/** A local durable outbox. Not a serverless/shared filesystem database. */
export class DiscoveryStore {
  constructor(readonly path: string) {}

  async edit<T>(fn: (state: DiscoveryState) => T): Promise<T> {
    await mkdir(dirname(this.path), { recursive: true });
    const lock = `${this.path}.lock`;
    let handle: Awaited<ReturnType<typeof open>> | undefined;
    for (let n = 0; n < 200; n++) {
      try { handle = await open(lock, "wx"); break; }
      catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
        // Reclaim only a dead owner's lock, never a slow live writer.
        try {
          const owner = JSON.parse(await readFile(lock, "utf8")) as { pid: number };
          try { process.kill(owner.pid, 0); }
          catch (err) { if ((err as NodeJS.ErrnoException).code === "ESRCH") await unlink(lock); }
        } catch {
          const info = await stat(lock).catch(() => null);
          if (info && Date.now() - info.mtimeMs > 30_000) await unlink(lock).catch(() => {});
        }
        await new Promise(resolve => setTimeout(resolve, 25));
      }
    }
    if (!handle) throw new Error("Discovery queue busy; retry later");
    try {
      await handle.writeFile(JSON.stringify({ pid: process.pid }));
      let state: DiscoveryState;
      try { state = JSON.parse(await readFile(this.path, "utf8")) as DiscoveryState; }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; state = emptyState(); }
      if (state.version !== 1 || !state.tasks || !state.candidates || !Array.isArray(state.hints)) throw new Error("Invalid discovery queue; refusing to reset");
      const result = fn(state);
      const temp = `${this.path}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(state, null, 2) + "\n");
      await rename(temp, this.path);
      return result;
    } finally { await handle.close(); await unlink(lock); }
  }

  snapshot() { return this.edit(state => structuredClone(state)); }

  retryCreditDeferred() {
    return this.edit(state => {
      for (const task of Object.values(state.tasks)) {
        if (task.status === "retry" && task.error?.includes("provider_deferred:anthropic:credit")) task.availableAt = 0;
      }
    });
  }

  configureCountry(country: DiscoveryCountry) {
    return this.edit(state => {
      if ((state.country ?? "CZ") !== country && Object.keys(state.tasks).length) throw new Error("Use a separate discovery directory for each country");
      state.country = country;
    });
  }

  configureReader(version: string) {
    return this.edit(state => {
      if (state.readerVersion === version) return;
      if (Object.values(state.tasks).some(t => t.kind === "read" && t.status === "running" && (t.leaseUntil ?? 0) > Date.now())) {
        throw new Error("Cannot change discovery reader while reads are running");
      }
      // Retain immutable documents and task history, but re-evaluate conclusions.
      for (const task of Object.values(state.tasks)) if (task.kind === "read") {
        task.status = "pending"; task.availableAt = 0; delete task.token; delete task.leaseUntil;
      }
      state.candidates = {};
      state.readerVersion = version;
    });
  }

  enqueueSearches(specs: SearchSpec[], cycle: string) {
    return this.edit(state => {
      for (const spec of specs) {
        const id = hash(JSON.stringify({ spec, cycle, version: 1 }));
        state.tasks[id] ??= { kind: "search", spec, id, status: "pending", attempts: 0, availableAt: 0, origins: [] };
      }
    });
  }

  enqueueSources(urls: string[], season: number, lane: ReadTask["lane"], origin: string) {
    return this.edit(state => { for (const url of urls) addSource(state, url, season, lane, origin, 0); });
  }

  claim(kinds: Task["kind"][], now = Date.now(), leaseMs = 10 * 60_000, lane?: ReadTask["lane"]) {
    return this.edit(state => {
      const hinted = new Set(state.hints.map(h => h.hint.url));
      // Finish independent search hits before descending into their link trees.
      // Keep global/.net sources eligible; geography is a preference, not a ban.
      const priority = (t: Task) => t.kind === "read" ? (t.lane === "benchmark" && t.depth === 0 ? 1000 : 0)
        + (t.depth === 0 ? 100 : t.depth === 1 ? 20 : 0) + Number(hinted.has(t.url)) * 40
        + Number(new URL(t.url).hostname.endsWith(`.${(state.country ?? "CZ").toLowerCase()}`)) * 15 + Number(t.url.includes(String(t.season))) * 2 : 0;
      const task = Object.values(state.tasks).sort((a, b) => priority(b) - priority(a)).find(t => kinds.includes(t.kind) && (!lane || t.kind !== "read" || t.lane === lane) && (
        (t.status === "pending" || t.status === "retry") && t.availableAt <= now || t.status === "running" && (t.leaseUntil ?? 0) <= now
      ));
      if (!task) return null;
      task.status = "running"; task.token = randomUUID(); task.leaseUntil = now + leaseMs; task.attempts++;
      return structuredClone(task);
    });
  }

  finish(task: Task, result: unknown, discoveries: { urls?: string[]; hints?: RaceHint[]; events?: ParsedEvent[]; snapshot?: string }, retryError?: string) {
    return this.edit(state => {
      const held = state.tasks[task.id];
      if (!held || held.status !== "running" || held.token !== task.token) throw new Error("Discovery lease lost; stale result refused");
      const season = task.kind === "search" ? task.spec.season : task.season;
      const lane = task.kind === "search" ? "blind" : task.lane;
      const depth = task.kind === "search" ? 0 : task.depth + 1;
      // Results and all follow-up work are committed together, before marking done.
      for (const url of discoveries.urls ?? []) if (depth <= 2) addSource(state, url, season, lane, task.id, depth);
      for (const hint of discoveries.hints ?? []) {
        if (!state.hints.some(h => h.taskId === task.id && JSON.stringify(h.hint) === JSON.stringify(hint))) state.hints.push({ taskId: task.id, hint });
      }
      for (const event of discoveries.events ?? []) {
        if (!discoveries.snapshot || event.startDate.slice(0, 4) !== String(season)) continue;
        const id = hash(`${lane}:${task.kind === "read" ? task.url : event.sourceUrl}:${season}:${event.externalId}:${event.startDate}:${event.name}`);
        const old = state.candidates[id];
        state.candidates[id] = { id, season, sourceUrl: task.kind === "read" ? task.url : event.sourceUrl, event,
          snapshot: discoveries.snapshot, ...assessCandidate(event, state.country), origins: [...new Set([...(old?.origins ?? []), task.id])] };
      }
      held.result = result;
      (held.history ??= []).push({ at: new Date().toISOString(), result, error: retryError });
      held.status = retryError ? "retry" : "done";
      if (!retryError) held.completedAt = Date.now();
      held.error = retryError;
      held.availableAt = retryError ? Date.now() + Math.min(24 * 3600_000, 60_000 * 2 ** Math.min(task.attempts, 10)) : 0;
      delete held.token; delete held.leaseUntil;
    });
  }
}

function addSource(state: DiscoveryState, raw: string, season: number, lane: ReadTask["lane"], origin: string, depth: number) {
  const url = discoveryUrl(raw);
  if (!url) return;
  const id = hash(JSON.stringify({ url, season, lane, version: 1 }));
  const task = state.tasks[id] ??= { id, kind: "read", url, season, depth, lane, status: "pending", attempts: 0, availableAt: 0, origins: [] };
  if (!task.origins.includes(origin)) task.origins.push(origin);
  if (task.status === "done" && Date.now() - (task.completedAt ?? Date.now()) > 24 * 3600_000) {
    task.status = "pending"; task.availableAt = 0;
  }
}
