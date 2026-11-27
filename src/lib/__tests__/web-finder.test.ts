import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as Array<{
    id: string;
    name: string;
    start_date: string;
    registration_url: string | null;
    website_url: string | null;
    location: { municipality: string | null; country_code: string | null } | null;
  }>,
  probedSkip: new Set<string>(),
  updates: [] as Array<{ id: string; payload: Record<string, unknown> }>,
  recordProbe: vi.fn(async () => {}),
  clearProbe: vi.fn(async () => {}),
  webSearchAvailable: vi.fn(() => true),
  runWebSearch: vi.fn(),
  fetchBot: vi.fn(),
  llmAvailable: vi.fn(() => false),
  askJson: vi.fn(),
  createServerSupabase: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: mocks.createServerSupabase,
}));
vi.mock("@/lib/catalog/probes", () => ({
  recentlyProbed: vi.fn(async () => mocks.probedSkip),
  recordProbe: mocks.recordProbe,
  clearProbe: mocks.clearProbe,
}));
vi.mock("@/lib/catalog/web-search", () => ({
  webSearchAvailable: mocks.webSearchAvailable,
  runWebSearch: mocks.runWebSearch,
}));
vi.mock("@/lib/http/fetch", () => ({
  fetchBot: mocks.fetchBot,
}));
vi.mock("@/lib/llm/anthropic", () => ({
  askJson: mocks.askJson,
  llmAvailable: mocks.llmAvailable,
  LlmUnavailable: class LlmUnavailable extends Error {},
  LlmResponseError: class LlmResponseError extends Error {},
  SONNET: "claude-sonnet-test",
}));

import {
  findWebsites,
  isConfidentMatch,
  looksLikeArticleOrListing,
  namedByThePage,
  namesAnotherEdition,
  pageIsAbout,
  searchQuery,
} from "@/lib/catalog/web-finder";

function makeSupabaseMock() {
  return {
    from: (table: string) => {
      if (table !== "events") throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => {
          const chain = {
            eq: () => chain,
            is: () => chain,
            in: () => chain,
            gte: () => chain,
            or: () => chain,
            order: () => chain,
            range: async (from: number, to: number) => ({
              data: mocks.rows.slice(from, to + 1),
              error: null,
            }),
          };
          return chain;
        },
        update: (payload: Record<string, unknown>) => ({
          eq: (_col: string, id: string) => ({
            or: async () => {
              mocks.updates.push({ id, payload });
              return { error: null };
            },
          }),
        }),
      };
    },
  };
}

function htmlResponse(url: string, html: string, ok = true): Response {
  const res = new Response(html, {
    status: ok ? 200 : 404,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
  Object.defineProperty(res, "url", { value: url });
  return res;
}

describe("web finder", () => {
  it("asks for the race, its town and its year", () => {
    expect(searchQuery("#03 - Bad Harzburg (UCI C1) 2026", "Bad Harzburg", "2026")).toBe("Bad Harzburg 2026");
    expect(searchQuery("Bauhaus Perlcross", "Perl", "2026")).toBe("Bauhaus Perlcross Perl 2026");
  });

  it("recognises articles and calendars, not a race's own site", () => {
    expect(looksLikeArticleOrListing("https://www.ivg.it/2026/09/mountain-bike-memorial/")).toBe(true);
    expect(looksLikeArticleOrListing("https://www.bad-harzburg.de/aktuell/veranstaltungskalender")).toBe(true);
    expect(looksLikeArticleOrListing("https://www.perlcross.de/")).toBe(false);
  });

  it("wants the race's name in the page's address or title, and its season in the text", () => {
    expect(namedByThePage("https://www.perlcross.de/", "Perlcross 2026", "Bauhaus Perlcross")).toBe(true);
    expect(namedByThePage("https://example.com/page", "Welcome", "Bauhaus Perlcross")).toBe(false);
    expect(pageIsAbout("Bauhaus Perlcross 3.10.2026 in Perl, Radcross und Mountainbike", "Bauhaus Perlcross", "Perl", "2026-10-03")).toBe(true);
    // The right name and year, the wrong sport.
    expect(pageIsAbout("Galopprennwoche 2026 Bad Harzburg Pferde Gestüt", "Harzburger Galopp", "Bad Harzburg", "2026-10-04")).toBe(false);
    expect(pageIsAbout("Bauhaus Perlcross 2024 results", "Bauhaus Perlcross", "Perl", "2026-10-03")).toBe(false);
  });

  it("writes only sure finds", () => {
    expect(isConfidentMatch("https://www.perlcross.de/", "Bauhaus Perlcross in Perl 2026", "Bauhaus Perlcross", "Perl")).toBe(true);
    expect(isConfidentMatch("https://x.com/a/b/c/perlcross", "Bauhaus Perlcross in Perl", "Bauhaus Perlcross", "Perl")).toBe(false);
  });

  it("rejects a report on another edition", () => {
    const url = "https://www.fcicomo.it/amatori-34-campionato-intersociale-memorial-alcide-besana-resoconto/";
    expect(looksLikeArticleOrListing(url)).toBe(true);
    expect(namesAnotherEdition(url.replace("-resoconto", ""), '40° CAMPIONATO INTERSOCIALE "MEMORIAL ALCIDE BESANA"', "2026-10-04")).toBe(true);
    expect(namesAnotherEdition("https://rideandrest.net/manifestazione/40-campionato-intersociale-memorial-alcide-besana/", '40° CAMPIONATO INTERSOCIALE "MEMORIAL ALCIDE BESANA"', "2026-10-04")).toBe(false);
    expect(namesAnotherEdition("https://x.cz/zavod-2025/", "Závod", "2026-05-01")).toBe(true);
  });

  it("rejects Czech news paths", () => {
    expect(looksLikeArticleOrListing("https://www.stredoceskysvazcyklistiky.cz/novinky/stredocesky-pohar-v-cyklokrosu-2026-startuje-jiz-4-rijna:a170.htm")).toBe(true);
  });
});

describe("findWebsites", () => {
  const origDeadline = process.env.SOURCE_RUN_DEADLINE;

  beforeEach(() => {
    delete process.env.SOURCE_RUN_DEADLINE;
    mocks.rows = [];
    mocks.probedSkip = new Set();
    mocks.updates = [];
    mocks.recordProbe.mockClear();
    mocks.clearProbe.mockClear();
    mocks.webSearchAvailable.mockReset();
    mocks.webSearchAvailable.mockReturnValue(true);
    mocks.runWebSearch.mockReset();
    mocks.fetchBot.mockReset();
    mocks.llmAvailable.mockReset();
    mocks.llmAvailable.mockReturnValue(false);
    mocks.askJson.mockReset();
    mocks.createServerSupabase.mockReset();
    mocks.createServerSupabase.mockImplementation(makeSupabaseMock);
  });

  afterEach(() => {
    if (origDeadline === undefined) delete process.env.SOURCE_RUN_DEADLINE;
    else process.env.SOURCE_RUN_DEADLINE = origDeadline;
  });

  it("preserves rank-order selection and aborts lower-ranked candidates once confident", async () => {
    mocks.rows = [
      {
        id: "r1",
        name: "Bauhaus Perlcross",
        start_date: "2026-10-03",
        registration_url: null,
        website_url: null,
        location: { municipality: "Perl", country_code: "DE" },
      },
    ];
    mocks.runWebSearch.mockResolvedValue({
      provider: "searxng",
      hits: [
        { url: "https://www.perlcross.de/", title: "Bauhaus Perlcross 2026", description: "" },
        { url: "https://my.raceresult.com/123456/", title: "Bauhaus Perlcross 2026", description: "" },
        { url: "https://other-slow-site.de/perlcross", title: "Bauhaus Perlcross 2026", description: "" },
        { url: "https://fourth-site.de/perlcross", title: "Bauhaus Perlcross 2026", description: "" },
      ],
    });

    const started: string[] = [];
    const aborted: string[] = [];
    mocks.fetchBot.mockImplementation(async (url: string, init?: { signal?: AbortSignal }) => {
      started.push(url);
      if (url.includes("perlcross.de")) {
        // Slower than candidate 1, yet higher ranked and also confident -> must still win.
        await new Promise((r) => setTimeout(r, 40));
        return htmlResponse(url, "<h1>Bauhaus Perlcross in Perl 2026</h1><p>Radcross und MTB</p>");
      }
      if (url.includes("raceresult.com")) {
        return htmlResponse(url, "<h1>Bauhaus Perlcross in Perl 2026</h1><p>Radcross cycling</p>");
      }
      // Candidate 2 starts concurrently in first wave of 3, then gets aborted when candidate 1 finishes.
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          aborted.push(url);
          reject(new Error("aborted"));
        });
      });
      return htmlResponse(url, "");
    });

    const logs: string[] = [];
    const res = await findWebsites({ log: (l) => logs.push(l) });

    expect(res).toEqual({ attempted: 1, found: 1, reviewed: 0, registration: 0, silent: 0, failed: 0 });
    expect(mocks.updates).toHaveLength(1);
    expect(mocks.updates[0]!.payload.website_url).toBe("https://www.perlcross.de/");
    expect(mocks.clearProbe).toHaveBeenCalledWith(expect.anything(), "r1", "web_search");
    expect(aborted).toContain("https://other-slow-site.de/perlcross");
    expect(started).not.toContain("https://fourth-site.de/perlcross");
    expect(logs[0]).toContain("SET  2026-10-03  Bauhaus Perlcross  → website: https://www.perlcross.de/");
  });

  it("serializes same-host candidate fetches while running distinct hosts concurrently", async () => {
    mocks.rows = [
      {
        id: "r1",
        name: "Bauhaus Perlcross",
        start_date: "2026-10-03",
        registration_url: null,
        website_url: null,
        location: { municipality: "Perl", country_code: "DE" },
      },
    ];
    mocks.runWebSearch.mockResolvedValue({
      provider: "searxng",
      hits: [
        { url: "https://same-host.de/a", title: "Bauhaus Perlcross", description: "" },
        { url: "https://same-host.de/b", title: "Bauhaus Perlcross", description: "" },
        { url: "https://host-two.de/perlcross", title: "Bauhaus Perlcross", description: "" },
        { url: "https://host-three.de/a/b/c/perlcross", title: "Bauhaus Perlcross", description: "" },
      ],
    });

    let activeSameHost = 0;
    let maxSameHost = 0;
    let activeTotal = 0;
    let maxTotal = 0;
    mocks.fetchBot.mockImplementation(async (url: string) => {
      activeTotal += 1;
      maxTotal = Math.max(maxTotal, activeTotal);
      if (url.includes("same-host.de")) {
        activeSameHost += 1;
        maxSameHost = Math.max(maxSameHost, activeSameHost);
      }
      await new Promise((r) => setTimeout(r, 25));
      if (url.includes("same-host.de")) activeSameHost -= 1;
      activeTotal -= 1;
      // Only candidate 3 matches likely (no town in text for confident, deep path).
      if (url.includes("host-three.de")) {
        return htmlResponse(url, "<h1>Bauhaus Perlcross 2026</h1><p>Radcross und Mountainbike</p>");
      }
      return htmlResponse(url, "<p>Unrelated page</p>");
    });

    const reviewed: unknown[] = [];
    const res = await findWebsites({ onReview: (s) => reviewed.push(s) });

    expect(maxSameHost).toBe(1);
    expect(maxTotal).toBeGreaterThan(1);
    expect(maxTotal).toBeLessThanOrEqual(3);
    expect(res).toEqual({ attempted: 1, found: 0, reviewed: 1, registration: 0, silent: 0, failed: 0 });
    expect(reviewed).toEqual([
      { id: "r1", name: "Bauhaus Perlcross", startDate: "2026-10-03", url: "https://host-three.de/a/b/c/perlcross", kind: "website", confident: false },
    ]);
    expect(mocks.recordProbe).toHaveBeenCalledWith(expect.anything(), "r1", "web_search", "silent");
  });

  it("processes multiple races concurrently with zero redundant sleep when search provider is active", async () => {
    mocks.rows = [
      { id: "r1", name: "Alpha Cross", start_date: "2026-10-03", registration_url: null, website_url: null, location: { municipality: "Brno", country_code: "CZ" } },
      { id: "r2", name: "Beta Gravel", start_date: "2026-10-04", registration_url: null, website_url: null, location: { municipality: "Plzen", country_code: "CZ" } },
      { id: "r3", name: "Gamma Fondo", start_date: "2026-10-05", registration_url: null, website_url: null, location: { municipality: "Ostrava", country_code: "CZ" } },
      { id: "r4", name: "#03 - Brno", start_date: "2026-10-06", registration_url: null, website_url: null, location: { municipality: "Brno", country_code: "CZ" } },
    ];

    let activeSearches = 0;
    let maxActiveSearches = 0;
    mocks.runWebSearch.mockImplementation(async (query: string) => {
      activeSearches += 1;
      maxActiveSearches = Math.max(maxActiveSearches, activeSearches);
      await new Promise((r) => setTimeout(r, 25));
      activeSearches -= 1;
      if (query.includes("Alpha")) {
        return { provider: "searxng", hits: [{ url: "https://alphacross.cz/", title: "Alpha Cross 2026", description: "" }] };
      }
      if (query.includes("Beta")) {
        return { provider: "searxng", hits: [{ url: "https://my.raceresult.com/999/", title: "Beta Gravel 2026", description: "" }] };
      }
      return { provider: "searxng", hits: [] };
    });
    mocks.fetchBot.mockImplementation(async (url: string) => {
      if (url.includes("alphacross.cz")) {
        return htmlResponse(url, "<h1>Alpha Cross Brno 2026</h1><p>Cyklokros a MTB závod</p>");
      }
      if (url.includes("raceresult.com")) {
        return htmlResponse(url, "<h1>Beta Gravel Plzen 2026</h1><p>Gravel bike cyklistika</p>");
      }
      return htmlResponse(url, "", false);
    });

    const t0 = Date.now();
    const res = await findWebsites();
    const elapsed = Date.now() - t0;

    expect(maxActiveSearches).toBeGreaterThan(1);
    expect(maxActiveSearches).toBeLessThanOrEqual(3);
    // Must not sleep 8-12s per race when a search provider with its own rate limiter is active.
    expect(elapsed).toBeLessThan(2000);
    expect(res).toEqual({ attempted: 4, found: 2, reviewed: 0, registration: 1, silent: 2, failed: 0 });
    expect(mocks.updates).toHaveLength(2);
    expect(mocks.recordProbe).toHaveBeenCalledTimes(1);
    expect(mocks.recordProbe).toHaveBeenCalledWith(expect.anything(), "r3", "web_search", "silent");
  });

  it("exits gracefully when SOURCE_RUN_DEADLINE is already reached or expires mid-run", async () => {
    process.env.SOURCE_RUN_DEADLINE = String(Math.floor(Date.now() / 1000) - 5);
    const early = await findWebsites();
    expect(early).toEqual({ attempted: 0, found: 0, reviewed: 0, registration: 0, silent: 0, failed: 0 });
    expect(mocks.createServerSupabase).not.toHaveBeenCalled();

    delete process.env.SOURCE_RUN_DEADLINE;
    mocks.rows = [
      { id: "r1", name: "Slow Race One", start_date: "2026-10-03", registration_url: null, website_url: null, location: { municipality: "Praha", country_code: "CZ" } },
      { id: "r2", name: "Second Race Two", start_date: "2026-10-04", registration_url: null, website_url: null, location: { municipality: "Brno", country_code: "CZ" } },
    ];
    mocks.runWebSearch.mockResolvedValue({
      provider: "searxng",
      hits: [{ url: "https://slow-race.cz/", title: "Slow Race One 2026", description: "" }],
    });
    mocks.fetchBot.mockImplementation(async (_url: string, init?: { signal?: AbortSignal }) => {
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      });
      return htmlResponse("https://slow-race.cz/", "");
    });

    const res = await findWebsites({
      concurrency: 1,
      deadlineMs: Date.now() + 60,
    });
    expect(res.attempted).toBe(0);
    expect(res.silent).toBe(0);
    expect(mocks.recordProbe).not.toHaveBeenCalled();
  });
});
