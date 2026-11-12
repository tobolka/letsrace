import { beforeEach, expect, it, vi } from "vitest";
import type { Locale } from "@/lib/i18n/messages";
import { checkPublicRaceRevisions } from "@/lib/pipeline/race-publication-check";

const state = vi.hoisted(() => ({ rpc: vi.fn(), checkLocales: vi.fn() }));
const site = "https://letsrace.test";
const target = {
  id: "canonical", slug: "race-current", name: "Current Race", public_revision: "current",
  start_date: "2027-06-20", end_date: null, status: "scheduled", visibility: "public", location: null,
};
vi.mock("@/lib/seo", () => ({ getSiteUrl: () => "https://letsrace.test" }));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabase: () => ({
    rpc: state.rpc,
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: target, error: null }) }) }) }),
  }),
}));
vi.mock("@/lib/pipeline/publication-locales", () => ({
  checkPublicationLocales: state.checkLocales, publicationLocaleWaves: [["cs"], ["en"]],
}));

const html = `<article data-race-id="canonical" data-race-revision="current"></article><script type="application/ld+json">${JSON.stringify({
  "@type": "SportsEvent", name: target.name, startDate: target.start_date, endDate: target.start_date,
  eventStatus: "https://schema.org/EventScheduled",
})}</script>`;
const task = {
  key: "public:alias", token: "lease", attempts: 1,
  payload: { revision: "merge", slug: "race-merged", previousSlugs: ["race-older"], expected: { merged_into_id: target.id } },
};
const check = () => checkPublicRaceRevisions({ maxChecks: 1, deadline: Date.now() + 10_000, timeoutMs: 500 });

beforeEach(() => {
  state.rpc.mockReset().mockImplementation(async name => ({
    data: name === "pipeline_claim_tasks" ? [task] : true, error: null,
  }));
});

it("checks the current address, merge redirect and earlier address", async () => {
  state.checkLocales.mockReset().mockImplementation(async (path: string, _timeout: number, verify: (html: string, status: number, locale: Locale, url: string) => void) => {
    if (path === "e/race-older") verify("", 404, "cs", site + "/cs/zavod/race-older");
    else verify(html, 200, "cs", site + "/cs/zavod/race-current");
    return ["cs"];
  });
  await expect(check()).resolves.toMatchObject({ publicRevisionsVerified: 1 });
  expect(state.checkLocales.mock.calls.map(([path]) => path)).toEqual(["e/race-current", "e/race-merged", "e/race-older"]);
  expect(state.rpc).toHaveBeenCalledWith("pipeline_finish_task", expect.objectContaining({
    p_result: expect.objectContaining({ revision: "merge", formerSlugs: ["race-merged", "race-older"] }),
  }));
});

it("keeps the merge pending if the former URL still returns its own page", async () => {
  state.checkLocales.mockReset().mockImplementation(async (path: string, _timeout: number, verify: (html: string, status: number, locale: Locale, url: string) => void) => {
    verify(html, 200, "cs", site + "/cs/zavod/" + path.split("/")[1]);
    return ["cs"];
  });
  await expect(check()).resolves.toMatchObject({ publicRevisionsVerified: 0, deferredInBatch: 1 });
  expect(state.rpc).toHaveBeenCalledWith("pipeline_retry_publication_check", expect.objectContaining({ p_stale: true }));
});
