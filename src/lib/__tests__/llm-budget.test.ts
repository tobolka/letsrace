import { afterEach, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("reserves budget before concurrent requests and releases unused cost", async () => {
  vi.resetModules();
  vi.stubEnv("ANTHROPIC_API_KEY", "test");
  vi.stubEnv("LLM_BUDGET_USD", "0.0002");
  let release!: (r: Response) => void;
  const fetch = vi.fn(() => new Promise<Response>((resolve) => { release = resolve; }));
  vi.stubGlobal("fetch", fetch);
  const { askJson, LlmUnavailable } = await import("@/lib/llm/anthropic");
  const opts = { system: "Read", user: "Race", maxTokens: 100 };
  const first = askJson(opts);
  await expect(askJson(opts)).rejects.toBeInstanceOf(LlmUnavailable);
  expect(fetch).toHaveBeenCalledTimes(1);
  release(new Response(JSON.stringify({ content: [{ type: "text", text: '{"ok":true}' }], usage: { input_tokens: 10, output_tokens: 10 } })));
  expect((await first).json).toEqual({ ok: true });
  const second = askJson(opts);
  await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  release(new Response(JSON.stringify({ content: [{ type: "text", text: '{}' }], usage: { input_tokens: 10, output_tokens: 10 } })));
  await second;
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("reports a truncated reply as an error and still accounts for its cost", async () => {
  vi.resetModules();
  vi.stubEnv("ANTHROPIC_API_KEY", "test");
  vi.stubEnv("LLM_BUDGET_USD", "0.1");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    content: [{ type: "text", text: '{"verdict":"ye' }], stop_reason: "max_tokens", usage: { input_tokens: 125, output_tokens: 60 },
  }))));
  const { askJson, SONNET, LlmResponseError, llmSpent } = await import("@/lib/llm/anthropic");
  await expect(askJson({ model: SONNET, system: "Read", user: "Race", maxTokens: 60 })).rejects.toBeInstanceOf(LlmResponseError);
  expect(llmSpent()).toBeCloseTo(0.00085);
});

it("uses Haiku 5.5 prices and disables thinking for bounded JSON extraction", async () => {
  vi.resetModules();
  vi.stubEnv("ANTHROPIC_API_KEY", "test");
  vi.stubEnv("LLM_BUDGET_USD", "1");
  const fetch = vi.fn< typeof globalThis.fetch >(async () => new Response(JSON.stringify({
    content: [{ type: "text", text: '{"ok":true}' }], usage: { input_tokens: 1000, output_tokens: 100 }, stop_reason: "end_turn",
  })));
  vi.stubGlobal("fetch", fetch);
  const { askJson, HAIKU, tokenCost, LlmUnavailable } = await import("@/lib/llm/anthropic");
  const reply = await askJson({ system: "Read", user: "Race", maxTokens: 700, outputSchema: { type: "object" } });
  const request = JSON.parse(fetch.mock.calls[0]![1]!.body as string);
  expect(request).toMatchObject({ model: HAIKU, max_tokens: 1050, thinking: { type: "disabled" }, output_config: { effort: "medium", format: { type: "json_schema" } } });
  expect(reply.usage.costUsd).toBeCloseTo(0.00015);
  expect(tokenCost(HAIKU, 100_000, 1000)).toBeCloseTo(0.0105);
  expect(tokenCost(HAIKU, 100_001, 1000)).toBeCloseTo(0.0525005);
  expect(new LlmUnavailable("cap").name).toBe("LlmUnavailable");
});

it("charges refusals without accepting their apparent JSON verdict", async () => {
  vi.resetModules();
  vi.stubEnv("ANTHROPIC_API_KEY", "test");
  vi.stubEnv("LLM_BUDGET_USD", "1");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
    content: [{ type: "text", text: '{"ok":true}' }], usage: { input_tokens: 1000, output_tokens: 100 }, stop_reason: "refusal",
  }))));
  const { askJson, llmSpent } = await import("@/lib/llm/anthropic");
  await expect(askJson({ system: "Read", user: "Race" })).rejects.toThrow("refused");
  expect(llmSpent()).toBeCloseTo(0.00015);
});
