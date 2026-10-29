import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoveryPlan, discoveryUrl, groundedHints } from "@/lib/discovery/plan";
import { DiscoveryStore } from "@/lib/discovery/store";
import { runDiscovery, type DiscoveryDependencies } from "@/lib/discovery/run";
import { claimedDate, discoveryReport, parseBenchmark, reviewDiscoveryCandidates, type CatalogRow } from "@/lib/discovery/report";
import { emptyState } from "@/lib/discovery/store";
import { canonicalExploreUrl } from "@/lib/watcher/explore";
import { assessCandidate } from "@/lib/discovery/assessment";
import { queueDiscoverySources } from "@/lib/discovery/sync";
import { discoveryContributions } from "@/lib/discovery/contributions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

const directories: string[] = [];
afterEach(async () => { for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true }); });
async function queue() {
  const dir = await mkdtemp(join(tmpdir(), "race-discovery-")); directories.push(dir);
  return { store: new DiscoveryStore(join(dir, "queue.json")), dir };
}
const race = { externalId: "may-2027", name: "May Divide", startDate: "2027-05-01", sourceUrl: "https://bike-paradise.cz/", placeText: "Mostek", confidence: 0.9 };

describe("candidate catalogue review", () => {
  const review = (catalog: CatalogRow[] | null, quote = "May Divide 1. 5. 2027") => {
    const state = emptyState();
    state.candidates.one = { id: "one", season: 2027, sourceUrl: race.sourceUrl, snapshot: "saved-source.json", origins: [], state: "needs_review",
      event: { ...race, evidence: { quote, sourceUrl: race.sourceUrl, method: "llm_calendar", version: "calendar-v6" } } };
    return reviewDiscoveryCandidates(state, catalog)[0]!;
  };
  const row: CatalogRow = { id: "hidden", name: race.name, start_date: "2027-05-01", visibility: "hidden", status: "tbc", merged_into_id: "keeper", country: "CZ", website_url: race.sourceUrl };
  it("finds a hidden/merged edition but never approves publication", () => {
    expect(review([row])).toMatchObject({ category: "possible_existing_edition", publicationApproved: false, catalogueSuggestions: [{ id: "hidden", visibility: "hidden" }] });
  });
  it("separates an old edition from a current-season date conflict", () => {
    expect(review([{ ...row, start_date: "2026-05-01" }]).category).toBe("possible_missing_edition");
    expect(review([{ ...row, start_date: "2027-05-02" }]).category).toBe("possible_date_or_identity_conflict");
  });
  it("cannot give a matching catalogue record priority over a false date proof", () => {
    expect(review([row], "May Divide 2. 5. 2027")).toMatchObject({ category: "date_evidence_review", dateSupported: false });
    expect(review(null).category).toBe("catalogue_not_loaded");
  });
  it("surfaces same-site aliases without treating a shared site as proven identity", () => {
    expect(review([{ ...row, name: "Another race", start_date: "2027-05-01" }])).toMatchObject({
      category: "shared_source_identity_review", catalogueSuggestions: [], catalogueSourceSuggestions: [{ id: "hidden" }], publicationApproved: false,
    });
  });
  it("does not turn a foreign namesake into a Czech date conflict", () => {
    expect(review([{ ...row, country: "CH", website_url: "https://swiss.test/", start_date: "2027-05-02" }]))
      .toMatchObject({ category: "identity_review", catalogueSuggestions: [] });
  });
});

describe("independent discovery", () => {
  it("searches the whole requested season without needing known races", () => {
    const plan = discoveryPlan(2027);
    expect(plan).toHaveLength(9);
    expect(new Set(plan.map(p => p.provider))).toEqual(new Set(["ai", "brave"]));
    for (const p of plan) expect(p.query).toContain("2027");
    expect(plan.map(p => p.query).join(" ")).toMatch(/silniční.*gravel.*dětské.*bikepacking/);
  });

  it("preserves content identity and accepts sources excluded from own-site discovery", () => {
    const joomla = "https://www.tjsokolchotebuz.cz/index.php?Itemid=36&id=17&option=com_content&view=article";
    expect(new URL(canonicalExploreUrl(joomla)!).searchParams.get("id")).toBe("17");
    expect(canonicalExploreUrl("https://club.cz/?p=7288&utm_source=foo")).toBe("https://club.cz/?p=7288");
    expect(discoveryUrl(joomla)).toContain("id=17");
    for (const url of ["https://juniorcup.net/", "https://uci.org/competition-details/2027/ROA/80572", "https://maraton.cz/terminovka", "https://svckostelec.cz/organizace-skolniho-roku"]) expect(discoveryUrl(url)).not.toBeNull();
    for (const url of ["http://127.0.0.1/", "http://10.0.0.1/", "file:///etc/passwd", "http://user:password@club.cz/", "https://letsrace.cz/cs"]) expect(discoveryUrl(url)).toBeNull();
  });

  it("does not accept invented AI URLs or promote uncertain date hints", () => {
    const hints = groundedHints([{ name: "Race", date: "Duben*", url: "https://club.cz/article" }, { name: "Made up", url: "https://invented.cz/" }], ["https://club.cz/article"]);
    expect(hints).toEqual([{ name: "Race", dateText: "Duben*", place: undefined, discipline: undefined, url: "https://club.cz/article" }]);
  });

  it("claims once across competing workers, recovers expired leases and fences old results", async () => {
    const { store } = await queue();
    await store.enqueueSearches(discoveryPlan(2027).slice(0, 1), "cycle");
    const [a, b] = await Promise.all([store.claim(["search"], 1000, 10), store.claim(["search"], 1000, 10)]);
    const claimed = a ?? b; expect(claimed).not.toBeNull(); expect(a && b).toBeFalsy();
    const resumed = await store.claim(["search"], 1011, 100);
    expect(resumed?.id).toBe(claimed?.id); expect(resumed?.token).not.toBe(claimed?.token);
    await expect(store.finish(claimed!, {}, {})).rejects.toThrow("lease lost");
    await store.finish(resumed!, {}, {});
    expect(await store.claim(["search"], 2000)).toBeNull();
  });

  it("reads original hits before foreign follow-up trees and credits their discovery provider", async () => {
    const { store } = await queue();
    await store.enqueueSearches(discoveryPlan(2027, ["ai"]), "cycle");
    await store.finish((await store.claim(["search"]))!, {}, { urls: ["https://club.cz/", "https://global.org/"] });
    const first = (await store.claim(["read"]))!;
    expect(first.kind === "read" && first.url).toBe("https://club.cz/");
    await store.finish(first, {}, { urls: ["https://foreign.org/2027"], events: [race], snapshot: "source" });
    const next = (await store.claim(["read"]))!;
    expect(next.kind === "read" && next.url).toBe("https://global.org/");
    const contributions = discoveryContributions(await store.snapshot());
    expect(contributions.find(c => c.provider === "ai")).toMatchObject({ initialSources: 2, sourcesIncludingFollowups: 3 });
    expect(contributions.find(c => c.provider === "openai")).toMatchObject({ status: "not_requested", publicationVerifiedRaces: null });
  });

  it("refuses to overwrite a corrupt queue", async () => {
    const { store } = await queue(); await writeFile(store.path, "{broken");
    await expect(store.snapshot()).rejects.toThrow();
    expect(await readFile(store.path, "utf8")).toBe("{broken");
  });

  it("retains every result before bounded reads and preserves lane isolation", async () => {
    const { store, dir } = await queue();
    await store.enqueueSearches(discoveryPlan(2027).slice(0, 1), "cycle");
    const urls = Array.from({ length: 25 }, (_, i) => `https://club.cz/race/${i}`);
    const deps: DiscoveryDependencies = {
      search: async () => ({ urls, hints: [], searches: 2, costUsd: 0.02, raw: urls }),
      fetch: async () => ({ html: "<h1>May Divide 2027</h1>", hash: "snapshot", status: 200, fetchedAt: new Date().toISOString() }),
      extract: async () => ({ events: [race], strategy: "test", childUrls: [], confidence: 0.9 }),
    };
    const options = { directory: dir, max: 1, deadline: Date.now() + 60_000, ai: true, deps };
    await runDiscovery(store, { ...options, mode: "search" });
    const fresh = new DiscoveryStore(store.path);
    let state = await fresh.snapshot();
    expect(Object.values(state.tasks).filter(t => t.kind === "read")).toHaveLength(25);
    await runDiscovery(fresh, { ...options, mode: "read" });
    state = await fresh.snapshot();
    expect(Object.values(state.tasks).filter(t => t.kind === "read" && t.status === "pending")).toHaveLength(24);
    expect(Object.values(state.candidates)[0]?.state).toBe("needs_review");
    await fresh.enqueueSources([urls[0]], 2027, "benchmark", "CSV");
    expect(Object.values((await fresh.snapshot()).tasks).filter(t => t.kind === "read")).toHaveLength(26);
    const report = discoveryReport(await fresh.snapshot(), [{ name: "May Divide", dateText: "1. 5.", url: urls[0], place: "Mostek", discipline: "Ultra" }], 2027, null);
    expect(report.benchmark[0]?.benchmarkCandidates).toHaveLength(0);
  });

  it("does not turn provider failure into a completed empty search", async () => {
    const { store, dir } = await queue();
    await store.enqueueSearches(discoveryPlan(2027).slice(0, 1), "cycle");
    const state = await runDiscovery(store, { directory: dir, mode: "search", max: 1, deadline: Date.now() + 60_000, ai: true,
      deps: { search: async () => { throw new Error("provider HTTP 429"); }, fetch: async () => { throw new Error("unused"); }, extract: async () => { throw new Error("unused"); } } });
    expect(Object.values(state.tasks)[0]).toMatchObject({ status: "retry", error: "provider HTTP 429" });
    expect(Object.keys(state.candidates)).toHaveLength(0);
  });

  it("retains partial reads and multiple races on the same URL without publishing", async () => {
    const { store } = await queue();
    await store.enqueueSources([race.sourceUrl], 2027, "benchmark", "CSV");
    const t = (await store.claim(["read"]))!;
    await store.finish(t, { complete: false }, { events: [race, { ...race, externalId: "v4", name: "V4", startDate: "2027-08-01" }], snapshot: "file" }, "budget exhausted");
    const state = await store.snapshot();
    expect(Object.values(state.candidates)).toHaveLength(2);
    expect(Object.values(state.tasks)[0]?.status).toBe("retry");
  });

  it("reprocesses cached sources after a reader change without re-running search", async () => {
    const { store } = await queue();
    await store.configureReader("old");
    await store.enqueueSources([race.sourceUrl], 2027, "benchmark", "CSV");
    const task = (await store.claim(["read"]))!;
    await store.finish(task, {}, { events: [race], snapshot: "immutable-evidence" });
    await store.configureReader("new");
    const state = await store.snapshot();
    expect(Object.keys(state.candidates)).toHaveLength(0);
    expect(Object.values(state.tasks)[0]).toMatchObject({ status: "pending", history: [{ result: {} }] });
  });

  it("marks explicit foreign/non-cycling entries and tentative dates separately", () => {
    expect(assessCandidate({ ...race, name: "MS v hokeji 2027" }).state).toBe("out_of_scope");
    expect(assessCandidate({ ...race, name: "Zonhoven", countryHint: "CZ", placeText: "Zonhoven (Belgie)" }).state).toBe("out_of_scope");
    expect(assessCandidate({ ...race, name: "BSK Giro (připravuje se)" }).dateStatus).toBe("tentative");
  });

  it("hands blind source evidence to the existing review queue without resetting rejected/paused sources", async () => {
    const { store } = await queue();
    const evidence = { quote: "1. 5. 2027 May Divide", sourceUrl: race.sourceUrl, method: "test", version: "test" };
    await store.enqueueSources([race.sourceUrl, "https://paused.cz/"], 2027, "blind", "search");
    for (let i = 0; i < 2; i++) {
      const task = (await store.claim(["read"]))!;
      await store.finish(task, {}, { events: [{ ...race, evidence }], snapshot: "file" });
    }
    const writes: unknown[] = [];
    const db = { from: (table: string) => ({
      select: () => ({ order: () => ({ range: async () => ({ data: table === "watched_urls" ? [{ url: "https://paused.cz/" }] : [], error: null }) }) }),
      upsert: async (rows: unknown, opts: unknown) => { writes.push({ table, rows, opts }); return { error: null }; },
    }) } as unknown as SupabaseClient<Database>;
    await queueDiscoverySources(db, await store.snapshot());
    expect(writes).toEqual([{ table: "discovered_links", rows: [{ url: "https://bike-paradise.cz", status: "pending", hint_kind: "independent_season_discovery" }], opts: { onConflict: "url", ignoreDuplicates: true } }]);
  });
});

describe("CSV diagnostics", () => {
  it("preserves all 51 benchmark rows and uncertainty, including multi-day claims", async () => {
    const rows = parseBenchmark(await readFile("docs/fixtures/cyklisticke_zavody_cr_2027.csv", "utf8"));
    expect(rows).toHaveLength(51); expect(new Set(rows.map(r => r.url)).size).toBe(38);
    expect(rows.filter(r => r.dateText.includes("*"))).toHaveLength(5);
    expect(claimedDate("21.–23. 5.", 2027)).toEqual({ precision: "day", start: "2027-05-21", end: "2027-05-23" });
    expect(claimedDate("20. 6.*", 2027)).toEqual({ precision: "tentative", start: "2027-06-20", end: "2027-06-20" });
    expect(claimedDate("Září*", 2027).start).toBeNull();
    expect(() => claimedDate("31. 2.", 2027)).toThrow();
  });

  it("finds hidden/merged and wrong-date suggestions rather than requiring a date match", async () => {
    const { store } = await queue();
    const report = discoveryReport(await store.snapshot(), [{ name: "May Divide", dateText: "1. 5.", url: race.sourceUrl, place: "x", discipline: "Ultra" }], 2027,
      [{ id: "hidden", name: "May Divide", start_date: "2027-05-02", visibility: "hidden", status: "tbc", merged_into_id: "old", website_url: race.sourceUrl, country: "CZ" }]);
    expect(report.benchmark[0]?.catalogSuggestions?.[0]).toMatchObject({ id: "hidden", visibility: "hidden", start_date: "2027-05-02" });
  });
});
