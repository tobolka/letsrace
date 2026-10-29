import { afterEach, describe, expect, it, vi } from "vitest";
import { askOpenAIWithSearch, openaiSearchCost, readOpenAISearch } from "@/lib/llm/openai-search";
import { discoveryPlan, groundedHints } from "@/lib/discovery/plan";
import { LlmResponseError } from "@/lib/llm/anthropic";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("OpenAI discovery adapter", () => {
  it("uses the identical blind research assignment for both AI providers", () => {
    const plan = discoveryPlan(2027, ["ai", "openai"]);
    expect(plan.map(p => p.provider)).toEqual(["ai", "openai"]);
    expect(plan[0]?.query).toBe(plan[1]?.query);
  });
  it("grounds returned races in tool sources, not arbitrary addresses in answer text", () => {
    const answer = readOpenAISearch<{ races: unknown[] }>({ status: "completed", usage: { input_tokens: 1000, output_tokens: 200 }, output: [
      { type: "web_search_call", action: { type: "search", sources: [{ url: "https://club.cz/race", title: "Race" }] } },
      { type: "message", content: [{ type: "output_text", text: JSON.stringify({ races: [{ name: "Real", url: "https://club.cz/race" }, { name: "Invented", url: "https://invented.cz/race" }] }) }] },
    ] });
    expect(groundedHints(answer.json?.races, answer.results.map(r => r.url)).map(r => r.name)).toEqual(["Real"]);
    expect(answer.usage.costUsd).toBeCloseTo(0.014);
  });
  it("retains new prompt fields and accepts a date alone without requiring a sentence", () => {
    const [hint] = groundedHints([{ name: "Regionální BMX", date: "28. 8. 2027", start_date: "2027-08-28", end_date: null,
      city: "Červený Kostelec", region: "Královéhradecký kraj", discipline: "BMX", series: "Regionální pohár",
      children: "unknown", status: "confirmed", source_url: "https://club.cz/race" }], ["https://club.cz/race"]);
    expect(hint).toMatchObject({ name: "Regionální BMX", dateText: "28. 8. 2027", startDate: "2027-08-28", place: "Červený Kostelec",
      region: "Královéhradecký kraj", discipline: "BMX", series: "Regionální pohár", children: "unknown", status: "confirmed", url: "https://club.cz/race" });
    expect(hint?.endDate).toBeUndefined();
  });
  it("preserves announced editions with unknown dates and separate series rounds", () => {
    const source_url = "https://club.cz/series";
    const unknown = { name: "Pohár 2027", date: null, start_date: null, end_date: null, city: null, region: null,
      children: "unknown", status: "date_unknown", source_url };
    const roundOne = { ...unknown, name: "Pohár I.", date: "1. 5. 2027", start_date: "2027-05-01", status: "preliminary" };
    const roundTwo = { ...roundOne, name: "Pohár II.", date: "2. 5. 2027", start_date: "2027-05-02" };
    const hints = groundedHints([unknown, roundOne, roundOne, roundTwo], [source_url]);
    expect(hints).toHaveLength(3);
    expect(hints[0]).toMatchObject({ status: "date_unknown", children: "unknown" });
    expect(hints[0]?.startDate).toBeUndefined();
    expect(hints[0]?.place).toBeUndefined();
    expect(hints.slice(1).map(h => h.startDate)).toEqual(["2027-05-01", "2027-05-02"]);
  });
  it("does not treat a truncated response as a completed empty search", () => {
    expect(() => readOpenAISearch({ status: "incomplete", usage: { input_tokens: 1000, output_tokens: 200 }, output: [] })).toThrow(LlmResponseError);
  });
  it("does not count an answer from model memory as a real search", () => {
    expect(() => readOpenAISearch({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: '{"races":[]}' }] }] })).toThrow(LlmResponseError);
  });
  it("records the missing key explicitly without making a network request", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    await expect(askOpenAIWithSearch({ system: "Find races", user: "CZ 2027" })).rejects.toThrow("OPENAI_API_KEY");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("requires search and requests the complete source list without storing the response", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-key");
    vi.stubEnv("LLM_LEDGER_PATH", "");
    vi.stubEnv("LLM_BUDGET_USD", "1");
    const fetch = vi.fn(async () => new Response(JSON.stringify({ status: "completed",
      usage: { input_tokens: 100, output_tokens: 20 }, output: [{ type: "web_search_call", status: "completed", action: { type: "search", sources: [] } },
        { type: "message", content: [{ type: "output_text", text: '{"races":[]}' }] }] })));
    vi.stubGlobal("fetch", fetch);
    await askOpenAIWithSearch({ system: "Find races", user: "CZ 2027", maxSearches: 6 });
    const request = JSON.parse((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(request).toMatchObject({ model: "gpt-6.1-sol", tool_choice: "required", max_tool_calls: 6, store: false,
      include: ["web_search_call.action.sources"] });
  });
  it("accounts reported cached input and web calls separately", () => {
    expect(openaiSearchCost(1000, 200, 2, 500)).toBeCloseTo(0.02305);
  });
  it("distinguishes exhausted quota from rate limits without logging provider messages", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-only-key");
    vi.stubEnv("LLM_LEDGER_PATH", "");
    vi.stubEnv("LLM_BUDGET_USD", "1");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: {
      code: "insufficient_quota", message: "private request details",
    } }), { status: 429 })));
    await expect(askOpenAIWithSearch({ system: "Find races", user: "CZ 2027" }))
      .rejects.toThrow(/^provider_deferred:openai:credit:retry_at=/);
  });
});
