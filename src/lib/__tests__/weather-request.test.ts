import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ allow: true, ledgerError: false, rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ rpc: (name: string, args: unknown) => {
  state.rpc(name, args);
  return { abortSignal: async () => ({ data: !state.allow ? null : name === "weather_provider_claim_batch" ? (args as { p_units: number[] }).p_units.map((_, i) => `claim-${i}`) : name === "weather_provider_claim" ? "claim" : null, error: state.ledgerError ? { message: "offline" } : null }) };
} }) }));
import { openMeteoUnits, weatherRequest } from "@/lib/weather-request";
import { historicalSummaries } from "@/lib/weather";
beforeEach(() => { state.allow = true; state.ledgerError = false; state.rpc.mockReset(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const send = (deadline = Date.now() + 1000) => weatherRequest("open-meteo", "https://archive-api.open-meteo.com/v1/archive", 1, deadline, 1000, {}, true);
describe("real provider accounting", () => {
  it("never calls a provider without a successful shared reservation", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    state.allow = false; await expect(send()).rejects.toThrow("budget_deferred");
    state.allow = true; state.ledgerError = true; await expect(send()).rejects.toThrow("budget_deferred");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("records the real response and includes the request kind", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response('{"daily":{}}')));
    await send();
    expect(state.rpc).toHaveBeenCalledWith("weather_provider_claim", { p_provider: "open-meteo", p_units: 1, p_history: true });
    expect(state.rpc).toHaveBeenCalledWith("weather_provider_finish", { p_token: "claim", p_status: 200 });
  });
  it("records rate limits and network failures rather than retrying invisibly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("limit", { status: 429 })));
    await expect(send()).rejects.toThrow("http_429");
    expect(state.rpc).toHaveBeenCalledWith("weather_provider_finish", { p_token: "claim", p_status: 429 });
    vi.stubGlobal("fetch", vi.fn(async () => { throw Error("offline"); }));
    await expect(send()).rejects.toThrow("offline");
    expect(state.rpc).toHaveBeenCalledWith("weather_provider_finish", { p_token: "claim", p_status: 0 });
  });
  it("does not reserve or fetch after a deadline", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(send(Date.now() - 1)).rejects.toThrow("deadline_deferred");
    expect(state.rpc).not.toHaveBeenCalled(); expect(fetcher).not.toHaveBeenCalled();
  });
  it("accounts for long windows and more than ten variables", () => {
    const base = "https://archive-api.open-meteo.com/v1/archive?start_date=2025-05-01&daily=a,b,c&end_date=";
    expect(openMeteoUnits(base + "2025-05-07")).toBe(1);
    expect(openMeteoUnits(base + "2025-05-31")).toBe(3);
    expect(openMeteoUnits(base + "2025-05-07&hourly=d,e,f,g,h,i,j,k")).toBe(2);
  });
  it("shares one deadline across all archive years and the fallback", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
    const deadline = Date.now() + 1000;
    const fetcher = vi.fn(async (url: string) => {
      vi.setSystemTime(new Date(Date.now() + 2000));
      const from = new URL(url).searchParams.get("start_date")!;
      return new Response(JSON.stringify({ daily: { time: [from], temperature_2m_max: [10], temperature_2m_min: [1], precipitation_sum: [0] } }));
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(historicalSummaries(50, 14, ["2027-07-09"], "2026-11-02", deadline)).rejects.toThrow("deadline_deferred");
    expect(fetcher.mock.calls.length).toBeLessThanOrEqual(2);
    expect(fetcher.mock.calls.every(([url]) => url.includes("archive-api.open-meteo.com"))).toBe(true);
  });
});
