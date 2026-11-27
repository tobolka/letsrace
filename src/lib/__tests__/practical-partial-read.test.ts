import { expect, it, vi } from "vitest";
import { enrichPracticalDetails, regulationsMayBeReplaced, saveFoundLinks } from "@/lib/catalog/practical-enrichment";
import { LlmUnavailable } from "@/lib/llm/anthropic";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), read: vi.fn(), mark: vi.fn(), checkpoint: vi.fn(), ask: vi.fn(), secondRace: false, website: "https://club.test/" as string | null, regulations: null as string | null, rows: null as Record<string, unknown>[] | null }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/read-all", () => ({ readAllRows: async (query: (from: number, to: number) => { table: string }) => query(0, 999).table === "events" ? (mocks.rows ?? (mocks.secondRace ? ["race", "second"] : ["race"]).map(id => ({ id, name: "Fixture race", start_date: "2027-05-01", public_revision: "revision", practical_details: {}, website_url: mocks.website, regulations_url: mocks.regulations, location: { country_code: "CZ" } }))) : [] }));
vi.mock("@/lib/catalog/regulation-ages", () => ({ readDocument: mocks.read }));
vi.mock("@/lib/catalog/facts", () => ({ alreadyRead: async () => false, markRead: mocks.mark }));
vi.mock("@/lib/llm/anthropic", async original => ({ ...await original<object>(), askJson: mocks.ask }));

it("saves useful work but leaves a capped document walk retryable rather than stamping it complete", async () => {
  mocks.from.mockImplementation(table => {
    const query: Record<string, unknown> = { table, single: async () => ({ data: { public_revision: "revision", practical_details: {} }, error: null }), upsert: mocks.checkpoint };
    for (const name of ["select", "eq", "gte", "lte", "is", "not", "or", "order", "range", "in"]) query[name] = () => query;
    return query;
  });
  mocks.checkpoint.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ data: { status: "saved", changed: [], skipped: [] }, error: null });
  mocks.read.mockImplementation(async url => ({ text: "Fixture source text", ...(url === "https://club.test/" ? { html: `<h1>Fixture race</h1>${Array.from({ length: 9 }, (_, n) => `<a href="/rules-${n}.pdf">Rules ${n}</a>`).join("")}` } : {}) }));
  const result = await enrichPracticalDetails({ ids: ["race"], max: 1, structuredOnly: true, apply: true });
  expect(result).toMatchObject({ read: 1, partialReads: 1, deferred: 1, failed: 0, costUsd: 0 });
  expect(mocks.read).toHaveBeenCalledTimes(8);
  expect(mocks.mark).not.toHaveBeenCalled();
  expect(mocks.ask).not.toHaveBeenCalled();
  expect(mocks.checkpoint).toHaveBeenCalledWith(expect.objectContaining({ event_id: "race", outcome: "failed", attempts: 1 }), { onConflict: "event_id,probe" });
});

it("reads a shared document once for two races while assessing their facts separately", async () => {
  mocks.secondRace = true;
  mocks.read.mockClear();
  mocks.read.mockResolvedValue({ url: "https://club.test/", text: "Fixture race, 1. 5. 2027", html: null, thin: false });
  try {
    const result = await enrichPracticalDetails({ max: 2, structuredOnly: true });
    expect(result).toMatchObject({ read: 2, downloadedDocuments: 1, reusedDocuments: 1, failed: 0 });
    expect(mocks.read).toHaveBeenCalledOnce();
  } finally { mocks.secondRace = false; }
});

for (const website of [null, "https://mtbs.cz/sekce/kalendar"]) {
  it(`reads attached regulations when the race website is ${website ?? "missing"}`, async () => {
    mocks.website = website;
    mocks.regulations = "https://maraton.cz/terms/20261117_velesin.pdf";
    mocks.read.mockClear();
    mocks.mark.mockClear();
    mocks.read.mockResolvedValue({ text: "A different round on 17. 11. 2026", html: null });
    try {
      const audit = vi.fn();
      const result = await enrichPracticalDetails({ ids: ["race"], structuredOnly: true, apply: true, audit });
      expect(result).toMatchObject({ considered: 1, read: 1, changedFacts: 0, failed: 0 });
      expect(mocks.read).toHaveBeenCalledExactlyOnceWith(mocks.regulations, expect.anything());
      expect(audit).toHaveBeenCalledWith(expect.objectContaining({ checked: expect.objectContaining({ details: {}, rejected: [] }) }));
      expect(mocks.mark).toHaveBeenCalledWith(expect.anything(), mocks.regulations, expect.stringContaining("race"), expect.any(String));
    } finally { mocks.website = "https://club.test/"; mocks.regulations = null; }
  });
}


it("stops a rejected model configuration once instead of blaming and repeating every race", async () => {
  mocks.secondRace = true;
  mocks.read.mockClear(); mocks.ask.mockClear();
  mocks.read.mockResolvedValue({ text: "Fixture race, 1. 5. 2027\nStart 10:00, Elite 12:30", html: null });
  mocks.ask.mockRejectedValue(new Error('Anthropic API 400: unsupported output schema'));
  try {
    const result = await enrichPracticalDetails({ max: 2 });
    expect(result).toMatchObject({ read: 1, deferred: 1, failed: 0 });
    expect(mocks.ask).toHaveBeenCalledOnce();
  } finally { mocks.secondRace = false; mocks.ask.mockReset(); }
});

it("does not pay the model when no document holds anything a rider could use", async () => {
  mocks.read.mockClear(); mocks.ask.mockClear();
  mocks.read.mockResolvedValue({ text: "Fixture race, welcome to our club 2027", html: null });
  const result = await enrichPracticalDetails({ max: 1 });
  expect(result).toMatchObject({ read: 1, failed: 0, costUsd: 0 });
  expect(mocks.ask).not.toHaveBeenCalled();
});

it("processes different organizer hosts concurrently while serializing same-host races and fetches", async () => {
  mocks.rows = [
    { id: "r1", name: "Race 1", start_date: "2027-05-01", public_revision: "rev", practical_details: {}, website_url: "https://same.test/r1", regulations_url: null, location: { country_code: "CZ" } },
    { id: "r2", name: "Race 2", start_date: "2027-05-02", public_revision: "rev", practical_details: {}, website_url: "https://same.test/r2", regulations_url: null, location: { country_code: "CZ" } },
    { id: "r3", name: "Race 3", start_date: "2027-05-03", public_revision: "rev", practical_details: {}, website_url: "https://other.test/r3", regulations_url: null, location: { country_code: "CZ" } },
    { id: "r4", name: "Race 4", start_date: "2027-05-04", public_revision: "rev", practical_details: {}, website_url: "https://third.test/r4", regulations_url: null, location: { country_code: "CZ" } },
  ];
  let activeTotal = 0, maxTotal = 0;
  const activeByHost = new Map<string, number>(), maxByHost = new Map<string, number>();
  let activeAudit = 0, maxAudit = 0;
  mocks.read.mockClear();
  mocks.read.mockImplementation(async (url: string) => {
    const host = new URL(url).hostname;
    activeTotal++; maxTotal = Math.max(maxTotal, activeTotal);
    const hostActive = (activeByHost.get(host) ?? 0) + 1;
    activeByHost.set(host, hostActive);
    maxByHost.set(host, Math.max(maxByHost.get(host) ?? 0, hostActive));
    await new Promise(resolve => setTimeout(resolve, 25));
    activeByHost.set(host, (activeByHost.get(host) ?? 1) - 1);
    activeTotal--;
    return { text: "Welcome 2027", html: null };
  });
  try {
    const result = await enrichPracticalDetails({
      max: 4,
      structuredOnly: true,
      audit: async () => {
        activeAudit++; maxAudit = Math.max(maxAudit, activeAudit);
        await new Promise(resolve => setTimeout(resolve, 10));
        activeAudit--;
      },
    });
    expect(result).toMatchObject({ considered: 4, read: 4, failed: 0, deferred: 0 });
    expect(maxTotal).toBeGreaterThan(1);
    expect(maxTotal).toBeLessThanOrEqual(3);
    expect(maxByHost.get("same.test")).toBe(1);
    expect(maxAudit).toBe(1);
  } finally {
    mocks.rows = null;
    mocks.read.mockReset();
  }
});

it("fetches independent child documents concurrently within a race while keeping per-host serialization", async () => {
  mocks.rows = [
    { id: "r1", name: "Fixture race", start_date: "2027-05-01", public_revision: "rev", practical_details: {}, website_url: "https://site.test/", regulations_url: null, location: { country_code: "CZ" } },
  ];
  let activeTotal = 0, maxTotal = 0;
  const activeByHost = new Map<string, number>(), maxByHost = new Map<string, number>();
  mocks.read.mockClear();
  mocks.read.mockImplementation(async (url: string) => {
    const host = new URL(url).hostname;
    activeTotal++; maxTotal = Math.max(maxTotal, activeTotal);
    const hostActive = (activeByHost.get(host) ?? 0) + 1;
    activeByHost.set(host, hostActive);
    maxByHost.set(host, Math.max(maxByHost.get(host) ?? 0, hostActive));
    await new Promise(resolve => setTimeout(resolve, 25));
    activeByHost.set(host, (activeByHost.get(host) ?? 1) - 1);
    activeTotal--;
    if (url === "https://site.test/") {
      return {
        text: "Fixture race 1. 5. 2027",
        html: `<h1>Fixture race 1. 5. 2027</h1><a href="https://a.test/rules.pdf">Propozice A</a><a href="https://b.test/rules.pdf">Propozice B</a><a href="https://a.test/extra.pdf">Propozice A2</a>`,
      };
    }
    return { text: "Fixture race 1. 5. 2027 info", html: null };
  });
  try {
    const result = await enrichPracticalDetails({ ids: ["r1"], max: 1, structuredOnly: true });
    expect(result).toMatchObject({ read: 1, failed: 0 });
    expect(mocks.read).toHaveBeenCalledTimes(4);
    expect(maxTotal).toBeGreaterThan(1);
    expect(maxTotal).toBeLessThanOrEqual(3);
    expect(maxByHost.get("a.test")).toBe(1);
  } finally {
    mocks.rows = null;
    mocks.read.mockReset();
  }
});

it("stops claiming new races once deadline is near and records deferred once", async () => {
  mocks.rows = [
    { id: "r1", name: "Race 1", start_date: "2027-05-01", public_revision: "rev", practical_details: {}, website_url: "https://h1.test/", regulations_url: null, location: { country_code: "CZ" } },
    { id: "r2", name: "Race 2", start_date: "2027-05-02", public_revision: "rev", practical_details: {}, website_url: "https://h2.test/", regulations_url: null, location: { country_code: "CZ" } },
    { id: "r3", name: "Race 3", start_date: "2027-05-03", public_revision: "rev", practical_details: {}, website_url: "https://h3.test/", regulations_url: null, location: { country_code: "CZ" } },
  ];
  mocks.read.mockClear();
  try {
    const result = await enrichPracticalDetails({ max: 3, structuredOnly: true, deadline: Date.now() + 30_000 });
    expect(result).toMatchObject({ considered: 3, read: 0, deferred: 1, failed: 0 });
    expect(mocks.read).not.toHaveBeenCalled();
  } finally {
    mocks.rows = null;
  }
});

it("stops claiming new races across workers once AI budget is exhausted", async () => {
  mocks.rows = Array.from({ length: 5 }, (_, i) => ({
    id: `r${i}`, name: `Race ${i}`, start_date: `2027-05-0${i + 1}`, public_revision: "rev", practical_details: {},
    website_url: `https://host${i}.test/`, regulations_url: null, location: { country_code: "CZ" },
  }));
  mocks.read.mockClear();
  mocks.ask.mockClear();
  mocks.read.mockImplementation(async (url: string) => {
    const idx = Number(url.match(/host(\d+)/)?.[1] ?? 0);
    await new Promise(resolve => setTimeout(resolve, idx * 15));
    return { text: `Race ${idx}, ${idx + 1}. 5. 2027\nStart 10:00, Elite 12:30`, html: null };
  });
  mocks.ask.mockRejectedValue(new LlmUnavailable("Shared LLM budget: next request exceeds daily $0.5 cap"));
  try {
    const result = await enrichPracticalDetails({ max: 5 });
    expect(result.deferred).toBeGreaterThanOrEqual(1);
    expect(result.failed).toBe(0);
    expect(result.read).toBeLessThan(5);
    expect(mocks.ask.mock.calls.length).toBeLessThanOrEqual(3);
  } finally {
    mocks.rows = null;
    mocks.read.mockReset();
    mocks.ask.mockReset();
  }
});

it("limits batch enrichment to the 10-month (300-day) horizon while prioritizing nearest races", async () => {
  const isoInDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  const nearDate = isoInDays(20);
  const midDate = isoInDays(250);
  const farDate = isoInDays(340);
  mocks.rows = [
    { id: "far", name: "Far Race", start_date: farDate, public_revision: "rev", practical_details: {}, website_url: "https://far.test/", regulations_url: null, location: { country_code: "CZ" } },
    { id: "mid", name: "Mid Race", start_date: midDate, public_revision: "rev", practical_details: {}, website_url: "https://mid.test/", regulations_url: null, location: { country_code: "CZ" } },
    { id: "near", name: "Near Race", start_date: nearDate, public_revision: "rev", practical_details: {}, website_url: "https://near.test/", regulations_url: null, location: { country_code: "CZ" } },
  ];
  const visited: string[] = [];
  mocks.read.mockClear();
  mocks.read.mockImplementation(async (url: string) => {
    visited.push(url);
    return { text: "Club welcome", html: null };
  });
  try {
    const result = await enrichPracticalDetails({ max: 5, structuredOnly: true });
    expect(result).toMatchObject({ eligible: 2, considered: 2, read: 2 });
    expect(visited).toEqual(["https://near.test/", "https://mid.test/"]);
  } finally {
    mocks.rows = null;
    mocks.read.mockReset();
  }
});

it("upgrades generic series rules regulations_url only when core practical details are empty and round regulations are found", async () => {
  for (const generic of [
    "https://series.test/o-serialu/pravidla/",
    "https://series.test/pravidla",
    "https://series.test/en/regulations-en/",
    "https://series.test/generalausschreibung",
    "https://series.test/reglement/",
  ]) {
    expect(regulationsMayBeReplaced(generic, "https://series.test/2027-brno-propozice.pdf", {})).toBe(true);
    expect(regulationsMayBeReplaced(generic, "https://series.test/regulations", {})).toBe(false);
    expect(regulationsMayBeReplaced(generic, generic, {})).toBe(false);
  }
  const filledDetails = {
    venue: { value: { name: "Brno", precision: "municipality" }, sourceUrl: "https://series.test/", quote: "Místo konání Brno", checkedAt: "2026-11-27T10:00:00Z", editionYear: 2027, status: "current" },
    fees: { value: [{ label: "Elite", amount: 300, currency: "CZK" }], sourceUrl: "https://series.test/", quote: "Startovné Elite 300 Kč", checkedAt: "2026-11-27T10:00:00Z", editionYear: 2027, status: "current" },
    schedule: { value: [{ label: "Start", date: "2027-05-01", time: "10:00" }], sourceUrl: "https://series.test/", quote: "Start závodu v 10:00", checkedAt: "2026-11-27T10:00:00Z", editionYear: 2027, status: "current" },
  };
  expect(regulationsMayBeReplaced("https://series.test/pravidla", "https://series.test/2027-brno-propozice.pdf", filledDetails)).toBe(false);
  expect(regulationsMayBeReplaced("https://series.test/2027-ostrava-propozice.pdf", "https://series.test/2027-brno-propozice.pdf", {})).toBe(false);

  const updates: Record<string, unknown>[] = [];
  const facts: unknown[] = [];
  const previousImpl = mocks.from.getMockImplementation();
  mocks.from.mockImplementation((table: string) => {
    const query: Record<string, unknown> = {
      maybeSingle: async () => ({ data: { locked_fields: [] }, error: null }),
      update: (payload: Record<string, unknown>) => { updates.push(payload); return query; },
      insert: async (payload: unknown) => { facts.push(payload); return { error: null }; },
      select: () => query,
      eq: asyncOrChain(),
    };
    function asyncOrChain() {
      return () => Object.assign(Promise.resolve({ error: null }), query);
    }
    if (table === "event_overrides") query.eq = () => query;
    return query;
  });
  try {
    const saved = await saveFoundLinks(
      { id: "race-1", regulations_url: "https://series.test/o-serialu/pravidla/", practical_details: {} },
      { regulations: "https://series.test/2027-brno-propozice.pdf" },
    );
    expect(saved).toBe(1);
    expect(updates).toEqual([{ regulations_url: "https://series.test/2027-brno-propozice.pdf" }]);
    expect(facts).toHaveLength(1);
  } finally {
    if (previousImpl) mocks.from.mockImplementation(previousImpl);
  }
});
