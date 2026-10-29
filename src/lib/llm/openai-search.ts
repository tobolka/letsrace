import { withProviderAvailability } from "@/lib/llm/provider-health";
import { parseJsonReply } from "./json-reply";
import { LlmResponseError, LlmUnavailable, withinBudget, type LlmUsage, type SearchResult } from "./anthropic";

export const OPENAI_DISCOVERY_MODEL = "gpt-6.1-sol";
// Standard short-context rates verified 2026-10-24:
// https://developers.openai.com/api/docs/pricing
// Search results: https://developers.openai.com/api/docs/guides/tools-web-search
export function openaiSearchCost(input: number, output: number, searches: number, cached = 0) {
  return (Math.max(0, input - cached) * 2 + cached * 0.1 + output * 10) / 1_000_000 + searches * 0.01;
}

export type OpenAIResponse = {
  id?: string; status?: string; model?: string;
  usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
  output?: Array<{ type: string; status?: string; action?: { type?: string; sources?: { url?: string; title?: string }[] };
    content?: Array<{ type: string; text?: string }> }>;
};

export function readOpenAISearch<T>(body: OpenAIResponse) {
  const output = body.output ?? [];
  const calls = output.filter(o => o.type === "web_search_call");
  const results: SearchResult[] = calls.flatMap(c => c.action?.sources ?? []).flatMap(r =>
    typeof r.url === "string" ? [{ url: r.url, title: r.title ?? "" }] : []);
  const text = output.filter(o => o.type === "message").flatMap(o => o.content ?? []).filter(c => c.type === "output_text").map(c => c.text ?? "").join("\n");
  const usage: LlmUsage = { tokensIn: body.usage?.input_tokens ?? 0, tokensOut: body.usage?.output_tokens ?? 0,
    costUsd: openaiSearchCost(body.usage?.input_tokens ?? 0, body.usage?.output_tokens ?? 0, calls.length, body.usage?.input_tokens_details?.cached_tokens ?? 0) };
  const json = parseJsonReply<T>(text);
  if (body.status !== "completed" || !calls.length || json === null || calls.some(c => c.status === "failed") || output.some(o => o.content?.some(c => c.type === "refusal"))) {
    throw new LlmResponseError(`OpenAI search ${body.status ?? "unknown"}: no complete JSON answer`, usage);
  }
  return { json, results, searches: calls.length, usage, raw: body };
}

export async function askOpenAIWithSearch<T>(opts: { system: string; user: string; maxSearches?: number; timeoutMs?: number }) {
  if (!process.env.OPENAI_API_KEY) throw new LlmUnavailable("openai_search_unavailable: OPENAI_API_KEY is not configured");
  // Retrieval-token sizes vary. Reserve the entire default process allowance;
  // account actual reported usage, and never reset the existing shared ledger.
  return withProviderAvailability("openai", () => withinBudget({ system: opts.system, user: opts.user, reservationUsd: 0.25 }, async () => {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: OPENAI_DISCOVERY_MODEL, service_tier: "default", store: false,
        instructions: opts.system, input: opts.user, reasoning: { effort: "low" }, max_output_tokens: 6000,
        max_tool_calls: opts.maxSearches ?? 6,
        tool_choice: "required",
        tools: [{ type: "web_search", search_context_size: "low" }],
        include: ["web_search_call.action.sources"] }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 180_000),
    });
    if (!response.ok) {
      // Keep only a machine error code; provider messages can contain request data.
      const body = await response.json().catch(() => null) as { error?: { code?: unknown; type?: unknown } } | null;
      const code = body?.error?.code ?? body?.error?.type;
      const detail = typeof code === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(code) ? ` (${code})` : "";
      throw new LlmUnavailable(`OpenAI search HTTP ${response.status}${detail}`);
    }
    return readOpenAISearch<T>(await response.json() as OpenAIResponse);
  }));
}
