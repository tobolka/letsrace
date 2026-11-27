import { beforeEach, describe, expect, it, vi } from "vitest";
import { compactRaceDates } from "@/lib/i18n/dates";
import { eventPagePath } from "@/lib/event-url";
import { StalePublication } from "@/lib/pipeline/publication";
import { RateLimitedPublication } from "@/lib/pipeline/publication-locales";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  readPublicSeries: vi.fn(),
  checkLocales: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: () => ({ rpc: state.rpc }),
}));
vi.mock("@/lib/events", () => ({
  readPublicSeries: state.readPublicSeries,
}));
vi.mock("@/lib/pipeline/publication-locales", async () => {
  const actual = await vi.importActual<typeof import("@/lib/pipeline/publication-locales")>("@/lib/pipeline/publication-locales");
  return {
    ...actual,
    checkPublicationLocales: state.checkLocales,
  };
});

import {
  checkPublicSeriesRevisions,
  seriesRetryDelaySeconds,
  verifyPublicSeries,
} from "@/lib/pipeline/series-publication-check";

const race = { name: "Race", slug: "race", startDate: "2027-06-03", endDate: "2027-06-05", location: { municipality: "Brno", countryCode: "CZ" } };
const series = { series: { id: "series-1", name: "Cup", slug: "cup", description: "Ročník 2027" }, events: [race] } as NonNullable<Parameters<typeof verifyPublicSeries>[2]>;
const page = `<article><div class="browse-intro"><h1 data-page-title>Cup</h1><p>Ročník 2027</p></div></article>
  <div hidden><a class="race-row-link" data-series-round="cup" href="${eventPagePath("cs", "race")}"></a></div><div hidden><span class="race-row-name" data-series-race="race">Race</span></div><div hidden><span class="race-row-meta" data-series-race="race"><time datetime="2027-06-03">${compactRaceDates(race, "cs")}</time><span class="race-row-place">Brno · CZ · XCO</span></span></div>`;

const makeTask = (index: number, attempts = 0) => ({
  key: `series:${index}`,
  token: `lease-${index}`,
  entity_id: "series-1",
  attempts,
  payload: { revision: `rev-${index}`, slug: "cup", expected: { visibility: "public" } },
});

describe("series publication", () => {
  beforeEach(() => {
    state.rpc.mockReset();
    state.readPublicSeries.mockReset().mockResolvedValue(series);
    state.checkLocales.mockReset().mockResolvedValue(["cs", "en"]);
  });

  it("checks actual round content in the series article", () => {
    expect(() => verifyPublicSeries(page, 200, series, "cs")).not.toThrow();
    expect(() => verifyPublicSeries(page.replace("Ročník 2027", "Starý popis"), 200, series, "cs")).toThrow("description");
    expect(() => verifyPublicSeries(page.replace("2027-06-03", "2027-06-02"), 200, series, "cs")).toThrow("round does not match");
    expect(() => verifyPublicSeries(page.replace(compactRaceDates(race, "cs"), "3 čvn"), 200, series, "cs")).toThrow("round does not match");
    expect(() => verifyPublicSeries(page.replace("Brno · CZ", "Jihlava · CZ"), 200, series, "cs")).toThrow("round does not match");
  });
  it("accepts a past round that renders a status badge before the place span", () => {
    const pastPage = `<article><div class="browse-intro"><h1 data-page-title>Cup</h1><p>Ročník 2027</p></div></article>
      <div hidden><a class="race-row-link" data-series-round="cup" href="${eventPagePath("en", "race")}"></a></div>
      <div hidden><span class="race-row-name" data-series-race="race">Race</span></div>
      <div hidden><span class="race-row-meta" data-series-race="race"><time datetime="2027-06-03">${compactRaceDates(race, "en")}</time><span class="race-row-place">Past</span><span class="race-row-place" title="Brno · CZ · XCO">Brno · CZ · XCO</span></span></div>`;
    expect(() => verifyPublicSeries(pastPage, 200, series, "en")).not.toThrow();
    expect(() => verifyPublicSeries(pastPage.replace(/Brno · CZ · XCO/g, "Jihlava · CZ · XCO"), 200, series, "en")).toThrow("round does not match");
  });
  it("does not use unrelated links or hidden responses as proof", () => {
    expect(() => verifyPublicSeries(page.replace('data-series-round="cup"', 'data-series-round="another"'), 200, series, "cs")).toThrow("round count");
    expect(() => verifyPublicSeries(page, 200, null, "cs")).toThrow("still publicly available");
    expect(() => verifyPublicSeries("", 404, null, "cs")).not.toThrow();
  });

  it("waits past the Cloudflare edge TTL on stale HTML and backs off on rate limits and transient errors", () => {
    expect(seriesRetryDelaySeconds(new StalePublication("stale"), 0)).toBe(1860);
    expect(seriesRetryDelaySeconds(new StalePublication("stale"), 1)).toBe(1860);
    expect(seriesRetryDelaySeconds(new StalePublication("stale"), 2)).toBe(1860);
    expect(seriesRetryDelaySeconds(new StalePublication("stale"), 3)).toBe(2400);
    expect(seriesRetryDelaySeconds(new StalePublication("stale"), 10)).toBe(76800);

    expect(seriesRetryDelaySeconds(new RateLimitedPublication("en: Public page returned HTTP 429"), 0)).toBe(300);
    expect(seriesRetryDelaySeconds(new Error("en: Series page returned HTTP 429"), 1)).toBe(600);
    expect(seriesRetryDelaySeconds(new RateLimitedPublication("en: Public page returned HTTP 429"), 2)).toBe(1200);

    expect(seriesRetryDelaySeconds(new Error("timeout"), 0)).toBe(300);
    expect(seriesRetryDelaySeconds(new Error("timeout"), 1)).toBe(600);
    expect(seriesRetryDelaySeconds(new Error("timeout"), 2)).toBe(1200);
  });

  it("stops the batch immediately on HTTP 429 instead of claiming more tasks", async () => {
    let claimCount = 0;
    state.rpc.mockImplementation(async (name: string) => {
      if (name === "pipeline_claim_tasks") {
        claimCount++;
        return { data: [makeTask(claimCount, 0)], error: null };
      }
      return { data: true, error: null };
    });
    state.checkLocales.mockRejectedValue(new RateLimitedPublication("en: Public page returned HTTP 429"));

    const result = await checkPublicSeriesRevisions({
      maxChecks: 10,
      deadline: Date.now() + 60_000,
      timeoutMs: 500,
      betweenChecksMs: 0,
      waveDelayMs: 0,
    });

    expect(result).toEqual({ processed: 1, verified: 0, deferred: 1 });
    expect(claimCount).toBe(1);
    expect(state.rpc).toHaveBeenCalledWith("pipeline_retry_publication_check", expect.objectContaining({
      p_key: "series:1",
      p_stale: false,
      p_error: "en: Public page returned HTTP 429",
      p_delay_seconds: 300,
    }));
  });

  it("stops the rest of the batch when a later task hits HTTP 429 string error", async () => {
    let claimCount = 0;
    state.rpc.mockImplementation(async (name: string) => {
      if (name === "pipeline_claim_tasks") {
        claimCount++;
        return { data: [makeTask(claimCount, 1)], error: null };
      }
      return { data: true, error: null };
    });
    state.checkLocales
      .mockResolvedValueOnce(["cs", "en"])
      .mockRejectedValueOnce(new Error("sk: Series page returned HTTP 429"));

    const result = await checkPublicSeriesRevisions({
      maxChecks: 5,
      deadline: Date.now() + 60_000,
      timeoutMs: 500,
      betweenChecksMs: 0,
      waveDelayMs: 0,
    });

    expect(result).toEqual({ processed: 2, verified: 1, deferred: 1 });
    expect(claimCount).toBe(2);
    expect(state.rpc).toHaveBeenCalledWith("pipeline_retry_publication_check", expect.objectContaining({
      p_key: "series:2",
      p_stale: false,
      p_error: "sk: Series page returned HTTP 429",
      p_delay_seconds: 600,
    }));
  });

  it("retries stale HTML past the edge TTL without stopping the batch", async () => {
    let claimCount = 0;
    state.rpc.mockImplementation(async (name: string) => {
      if (name === "pipeline_claim_tasks") {
        claimCount++;
        return { data: claimCount <= 2 ? [makeTask(claimCount, 0)] : [], error: null };
      }
      return { data: true, error: null };
    });
    state.checkLocales
      .mockRejectedValueOnce(new StalePublication("cs: Public series name does not match the saved series"))
      .mockResolvedValueOnce(["cs", "en"]);

    const result = await checkPublicSeriesRevisions({
      maxChecks: 5,
      deadline: Date.now() + 60_000,
      timeoutMs: 500,
      betweenChecksMs: 0,
      waveDelayMs: 0,
    });

    expect(result).toEqual({ processed: 2, verified: 1, deferred: 1 });
    expect(claimCount).toBe(3);
    expect(state.rpc).toHaveBeenCalledWith("pipeline_retry_publication_check", expect.objectContaining({
      p_key: "series:1",
      p_stale: true,
      p_delay_seconds: 1860,
    }));
  });
});
