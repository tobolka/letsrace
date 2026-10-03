/**
 * One way to ask Claude for JSON, shared by every reader that uses a model.
 *
 * Plain fetch, no SDK: a reader sends a system prompt and a text, gets back the
 * JSON object the model wrote and what it cost. Callers verify what comes back
 * against the page; nothing here trusts the model.
 */

export const HAIKU = "claude-haiku-4-5-20251001";
/** For judgement calls where a wrong yes costs more than the tokens. */
export const SONNET = "claude-sonnet-5-5";

/** Dollars per million tokens, input and output. */
const PRICES: Record<string, [number, number]> = {
  [HAIKU]: [1, 5],
  [SONNET]: [3, 15],
};

export type LlmUsage = { tokensIn: number; tokensOut: number; costUsd: number };

export class LlmUnavailable extends Error {}

export function llmAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function addUsage(a: LlmUsage, b: LlmUsage): LlmUsage {
  return { tokensIn: a.tokensIn + b.tokensIn, tokensOut: a.tokensOut + b.tokensOut, costUsd: a.costUsd + b.costUsd };
}

export const NO_USAGE: LlmUsage = { tokensIn: 0, tokensOut: 0, costUsd: 0 };

/** Spent by this process. Every request checks it against LLM_BUDGET_USD. */
let spent = 0;
export function llmSpent(): number {
  return spent;
}

export async function askJson<T>(opts: {
  system: string;
  user: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ json: T | null; usage: LlmUsage; stopReason: string | null }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new LlmUnavailable("ANTHROPIC_API_KEY is not set");
  const budget = Number(process.env.LLM_BUDGET_USD ?? 0.25);
  if (spent >= budget) throw new LlmUnavailable(`LLM budget of $${budget} for this run is spent`);
  const model = opts.model ?? HAIKU;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 1000,
      system: opts.system.toWellFormed(),
      // Lone surrogates from a broken page make the body invalid JSON.
      messages: [{ role: "user", content: opts.user.toWellFormed() }],
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    // No credit, a bad key, or a rate limit: stop the whole run, not one race.
    if (res.status === 401 || res.status === 403 || /credit balance/i.test(body)) throw new LlmUnavailable(`Anthropic API ${res.status}: ${body}`);
    throw new Error(`Anthropic API ${res.status}: ${body}`);
  }
  const body = (await res.json()) as {
    content?: { type: string; text?: string }[];
    usage?: { input_tokens?: number; output_tokens?: number };
    stop_reason?: string;
  };
  const out = (body.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  const [pin, pout] = PRICES[model] ?? [3, 15];
  const tokensIn = body.usage?.input_tokens ?? 0;
  const tokensOut = body.usage?.output_tokens ?? 0;
  let json: T | null = null;
  try {
    const start = Math.min(...["{", "["].map((c) => out.indexOf(c)).filter((i) => i >= 0));
    const end = Math.max(out.lastIndexOf("}"), out.lastIndexOf("]"));
    if (Number.isFinite(start) && end > start) json = JSON.parse(out.slice(start, end + 1)) as T;
  } catch {
    json = null;
  }
  spent += (tokensIn * pin + tokensOut * pout) / 1_000_000;
  return {
    json,
    usage: { tokensIn, tokensOut, costUsd: (tokensIn * pin + tokensOut * pout) / 1_000_000 },
    stopReason: body.stop_reason ?? null,
  };
}

/** Dollars per web search the API runs for the model. */
const SEARCH_USD = 0.01;

export type SearchResult = { url: string; title: string };

/**
 * Ask Claude to search the web and answer in JSON. Returns every result the
 * searches brought back, so the caller can hold the answer to them: a URL the
 * model gives that no search returned is a URL it made up.
 */
export async function askWithSearch<T>(opts: {
  system: string;
  user: string;
  model?: string;
  maxSearches?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ json: T | null; results: SearchResult[]; searches: number; usage: LlmUsage }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new LlmUnavailable("ANTHROPIC_API_KEY is not set");
  const budget = Number(process.env.LLM_BUDGET_USD ?? 0.25);
  if (spent >= budget) throw new LlmUnavailable(`LLM budget of $${budget} for this run is spent`);
  const model = opts.model ?? HAIKU;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 800,
      system: opts.system.toWellFormed(),
      messages: [{ role: "user", content: opts.user.toWellFormed() }],
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: opts.maxSearches ?? 3 }],
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 180_000),
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 401 || res.status === 403 || /credit balance/i.test(body)) throw new LlmUnavailable(`Anthropic API ${res.status}: ${body}`);
    throw new Error(`Anthropic API ${res.status}: ${body}`);
  }
  const body = (await res.json()) as {
    content?: { type: string; text?: string; content?: unknown }[];
    usage?: { input_tokens?: number; output_tokens?: number; server_tool_use?: { web_search_requests?: number } };
  };
  const results: SearchResult[] = [];
  for (const block of body.content ?? []) {
    if (block.type !== "web_search_tool_result" || !Array.isArray(block.content)) continue;
    for (const r of block.content as { type?: string; url?: string; title?: string }[]) {
      if (r.type === "web_search_result" && r.url) results.push({ url: r.url, title: r.title ?? "" });
    }
  }
  // The answer is the text after the last search.
  const blocks = body.content ?? [];
  const lastTool = blocks.map((b) => b.type).lastIndexOf("web_search_tool_result");
  const out = blocks.slice(lastTool + 1).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  let json: T | null = null;
  try {
    const start = out.indexOf("{");
    const end = out.lastIndexOf("}");
    if (start >= 0 && end > start) json = JSON.parse(out.slice(start, end + 1)) as T;
  } catch {
    json = null;
  }
  const [pin, pout] = PRICES[model] ?? [3, 15];
  const tokensIn = body.usage?.input_tokens ?? 0;
  const tokensOut = body.usage?.output_tokens ?? 0;
  const searches = body.usage?.server_tool_use?.web_search_requests ?? 0;
  const costUsd = (tokensIn * pin + tokensOut * pout) / 1_000_000 + searches * SEARCH_USD;
  spent += costUsd;
  return { json, results, searches, usage: { tokensIn, tokensOut, costUsd } };
}
