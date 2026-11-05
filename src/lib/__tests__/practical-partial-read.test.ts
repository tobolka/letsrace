import { expect, it, vi } from "vitest";
import { enrichPracticalDetails } from "@/lib/catalog/practical-enrichment";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), read: vi.fn(), mark: vi.fn(), checkpoint: vi.fn(), ask: vi.fn(), secondRace: false, website: "https://club.test/" as string | null, regulations: null as string | null }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabase: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/read-all", () => ({ readAllRows: async (query: (from: number, to: number) => { table: string }) => query(0, 999).table === "events" ? (mocks.secondRace ? ["race", "second"] : ["race"]).map(id => ({ id, name: "Fixture race", start_date: "2027-05-01", public_revision: "revision", practical_details: {}, website_url: mocks.website, regulations_url: mocks.regulations, location: { country_code: "CZ" } })) : [] }));
vi.mock("@/lib/catalog/regulation-ages", () => ({ readDocument: mocks.read }));
vi.mock("@/lib/catalog/facts", () => ({ alreadyRead: async () => false, markRead: mocks.mark }));
vi.mock("@/lib/llm/anthropic", async original => ({ ...await original<object>(), askJson: mocks.ask }));

it("saves useful work but leaves a capped document walk retryable rather than stamping it complete", async () => {
  mocks.from.mockImplementation(table => {
    const query: Record<string, unknown> = { table, single: async () => ({ data: { public_revision: "revision", practical_details: {} }, error: null }), upsert: mocks.checkpoint };
    for (const name of ["select", "eq", "gte", "is", "not", "or", "order", "range", "in"]) query[name] = () => query;
    return query;
  });
  mocks.checkpoint.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ data: { status: "saved", changed: [], skipped: [] }, error: null });
  mocks.read.mockImplementation(async url => ({ text: "Fixture source text", ...(url === "https://club.test/" ? { html: `<h1>Fixture race</h1>${Array.from({ length: 6 }, (_, n) => `<a href="/rules-${n}.pdf">Rules ${n}</a>`).join("")}` } : {}) }));
  const result = await enrichPracticalDetails({ ids: ["race"], max: 1, structuredOnly: true, apply: true });
  expect(result).toMatchObject({ read: 1, partialReads: 1, deferred: 1, failed: 0, costUsd: 0 });
  expect(mocks.read).toHaveBeenCalledTimes(5);
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
      expect(audit).toHaveBeenCalledWith(expect.objectContaining({ checked: { details: {}, rejected: [] } }));
      expect(mocks.mark).toHaveBeenCalledWith(expect.anything(), mocks.regulations, expect.stringContaining("race"), expect.any(String));
    } finally { mocks.website = "https://club.test/"; mocks.regulations = null; }
  });
}


it("stops a rejected model configuration once instead of blaming and repeating every race", async () => {
  mocks.secondRace = true;
  mocks.read.mockClear(); mocks.ask.mockClear();
  mocks.read.mockResolvedValue({ text: "Fixture race, 1. 5. 2027", html: null });
  mocks.ask.mockRejectedValue(new Error('Anthropic API 400: unsupported output schema'));
  try {
    const result = await enrichPracticalDetails({ max: 2 });
    expect(result).toMatchObject({ read: 1, deferred: 1, failed: 0 });
    expect(mocks.ask).toHaveBeenCalledOnce();
  } finally { mocks.secondRace = false; mocks.ask.mockReset(); }
});
