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
