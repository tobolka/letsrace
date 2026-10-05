import { afterEach, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("reserves budget before concurrent requests and releases unused cost", async () => {
  vi.resetModules();
  vi.stubEnv("ANTHROPIC_API_KEY", "test");
  vi.stubEnv("LLM_BUDGET_USD", "0.002");
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
