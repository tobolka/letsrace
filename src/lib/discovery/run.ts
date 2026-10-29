import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { braveSearch } from "@/lib/catalog/brave";
import { askWithSearch, llmAvailable, SONNET } from "@/lib/llm/anthropic";
import { fetchPage } from "@/lib/watcher/http";
import { combineExtractedEvents, extractEvents, type ExtractResult } from "@/lib/watcher/core";
import { extractWithLlm } from "@/lib/watcher/extractors/llm-calendar";
import { askOpenAIWithSearch } from "@/lib/llm/openai-search";
import { mapPool, withHostGate } from "@/lib/watcher/pool";
import { groundedHints, hash } from "./plan";
import { DiscoveryStore, type Task } from "./store";
import { DISCOVERY_SEARCH_SYSTEM as SYSTEM } from "./prompt";

type SearchOutput = { urls: string[]; hints: ReturnType<typeof groundedHints>; searches: number; costUsd: number; raw: unknown };
type Document = { html: string; status: number; hash: string; finalUrl?: string; fetchedAt: string; contentType?: string | null };
export type DiscoveryDependencies = {
  search: (task: Task & { kind: "search" }) => Promise<SearchOutput>;
  fetch: (url: string) => Promise<Document>;
  extract: (url: string, html: string, deadline: number) => Promise<ExtractResult>;
};

function dependencies(ai: boolean): DiscoveryDependencies {
  return {
    search: async task => {
      if (task.spec.provider === "brave") {
        const hits = await braveSearch(task.spec.query, { country: task.spec.country, count: 20 });
        return { urls: hits.map(h => h.url), hints: [], searches: 1, costUsd: 0, raw: hits };
      }
      if (!ai) throw new Error("ai_search_unavailable: AI disabled");
      if (task.spec.provider !== "openai" && !llmAvailable()) throw new Error("ai_search_unavailable: credentials missing");
      const result = task.spec.provider === "openai"
        ? await askOpenAIWithSearch<{ races?: unknown }>({ system: SYSTEM, user: task.spec.query, maxSearches: 6 })
        : await askWithSearch<{ races?: unknown }>({ system: SYSTEM, user: task.spec.query, model: SONNET, maxSearches: 6, maxTokens: 6000 });
      const hints = groundedHints(result.json?.races, result.results.map(r => r.url));
      // Keep *every* actual search result, including ones the answer omitted.
      return { urls: result.results.map(r => r.url), hints, searches: result.searches, costUsd: result.usage.costUsd, raw: result };
    },
    fetch: async url => ({ ...await fetchPage(url, { timeoutMs: 20_000, retries: 1 }), fetchedAt: new Date().toISOString() }),
    extract: async (url, html, deadline) => {
      const parsed = await extractEvents(url, html, { ai: false, render: false, deadline });
      if (!ai || !llmAvailable()) return parsed;
      // An adapter returning some rows is not evidence that the next season
      // was completely read. This independent lane audits the same snapshot.
      const read = await extractWithLlm(url, html, { deadline, maxChunks: 2 });
      const events = combineExtractedEvents(parsed.events, read.events);
      return { events, strategy: `${parsed.strategy}+discovery-ai`, childUrls: [...new Set([...parsed.childUrls, ...read.childUrls])],
        confidence: events.length ? Math.min(...events.map(e => e.confidence)) : 0,
        complete: !read.truncated && (read.chunksRead > 0 || parsed.complete !== false),
        issues: [...(read.issues ?? []), ...(read.chunksRead === 0 ? parsed.issues ?? [] : []),
          ...Object.entries(read.rejectionReasons ?? {}).map(([reason, count]) => `rejected:${reason}:${count}`)], usage: read.usage,
        diagnostics: { chunksTotal: read.chunksTotal, chunksRead: read.chunksRead, cacheHits: read.cacheHits, proposed: read.proposed, rejected: read.rejected } };
    },
  };
}

export async function runDiscovery(store: DiscoveryStore, options: {
  directory: string; mode: "search" | "read"; max: number; concurrency?: number; deadline: number;
  ai: boolean; log?: (line: string) => void; deps?: DiscoveryDependencies;
  lane?: "blind" | "benchmark";
}) {
  const deps = options.deps ?? dependencies(options.ai);
  await mkdir(join(options.directory, "documents"), { recursive: true });
  await mkdir(join(options.directory, "searches"), { recursive: true });
  let claimed = 0;
  await mapPool(Array.from({ length: options.concurrency ?? 3 }), options.concurrency ?? 3, async () => {
    while (claimed < options.max && Date.now() < options.deadline - 5000) {
      // Reserve a local slot before awaiting the shared queue mutex.
      claimed++;
      const task = await store.claim([options.mode === "search" ? "search" : "read"], Date.now(), 10 * 60_000, options.lane);
      if (!task) return;
      options.log?.(`${task.kind === "search" ? task.spec.provider : task.lane}: ${task.kind === "search" ? task.spec.query : task.url}`);
      try {
        if (task.kind === "search") {
          const result = await deps.search(task);
          const artifact = join(options.directory, "searches", `${task.id}-${task.attempts}.json`);
          await writeFile(artifact, JSON.stringify({ at: new Date().toISOString(), spec: task.spec, ...result }, null, 2));
          await store.finish(task, { searches: result.searches, modelCostUsd: result.costUsd, results: result.urls.length,
            groundedHints: result.hints.length, artifact, providerCost: task.spec.provider === "brave" ? "Not included; search API billing is separate" : "Included in model cost" }, result);
        } else {
          // Serialize the whole read per host, including local rendering, not just HTTP starts.
          await withHostGate(`discovery:${new URL(task.url).hostname}`, 300, async () => {
            const cache = join(options.directory, "documents", `${hash(task.url)}.json`);
            let document: Document | undefined;
            try {
              const previous = JSON.parse(await readFile(cache, "utf8")) as Document;
              if (Date.now() - Date.parse(previous.fetchedAt) < 24 * 3600_000 && previous.status === 200) document = previous;
            } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT" && !(e instanceof SyntaxError)) throw e; }
            if (!document) {
              document = await deps.fetch(task.url);
              if (document.status !== 200) throw new Error(`source_http_${document.status}`);
              // Cache is a convenience; immutable evidence below is the source of truth.
              const temp = `${cache}.${task.token}.tmp`;
              await writeFile(temp, JSON.stringify(document));
              const { rename } = await import("node:fs/promises");
              await rename(temp, cache);
            }
            const snapshot = join(options.directory, "documents", `${hash(task.url)}-${document.hash}.snapshot.json`);
            try { await writeFile(snapshot, JSON.stringify({ ...document, requestedUrl: task.url }), { flag: "wx" }); }
            catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
            if (/^image\//i.test(document.contentType ?? "") || /\.(?:jpe?g|png|gif|webp)(?:\?|$)/i.test(task.url)) throw new Error("image_source_requires_visual_reader");
            const result = await deps.extract(task.url, document.html, options.deadline);
            const events = result.events.filter(e => e.startDate.slice(0, 4) === String(task.season));
            // Extraction is not official-source/identity approval. Every candidate stays in review.
            const incomplete = result.complete === false;
            await store.finish(task, { strategy: result.strategy, complete: !incomplete,
              issues: result.issues ?? [], extracted: events.length, otherSeason: result.events.length - events.length,
              modelCostUsd: result.usage?.costUsd ?? 0, diagnostics: result.diagnostics, snapshot },
            { urls: result.childUrls, events, snapshot }, incomplete ? (result.issues?.join("; ") || "incomplete_read") : undefined);
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        options.log?.(`deferred: ${message}`);
        await store.finish(task, { error: message }, {}, message);
      }
    }
  });
  return store.snapshot();
}
