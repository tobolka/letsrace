import { afterEach, beforeEach, expect, it, vi } from "vitest";
const ask = vi.hoisted(() => vi.fn());
vi.mock("@/lib/llm/anthropic", async original => ({ ...await original<typeof import("@/lib/llm/anthropic")>(), askJson: ask }));
import { extractWithLlm, verifyRaces, verifyFollowLinks } from "@/lib/watcher/extractors/llm-calendar";

beforeEach(() => { vi.stubEnv("LLM_EXTRACTION_CACHE_BACKEND", "local"); });
afterEach(() => { vi.unstubAllEnvs(); ask.mockReset(); });
const quote = "11.10.2026 Perlcross Perl CX";
const raw = { name: "Perlcross", start_date: "2026-10-11", quote, place: "Perl" };
const usage = { tokensIn: 100, tokensOut: 100, costUsd: 0.0001 };
const html = `<p>${quote}</p><p>${"background ".repeat(30)}</p>`;

it("revalidates cached assertions against today's date without paying twice", async () => {
  vi.stubEnv("LLM_EXTRACTION_CACHE_DIR", "");
  ask.mockResolvedValue({ json: { races: [raw] }, usage, stopReason: "end_turn" });
  const first = await extractWithLlm("https://club.test/cache", html, { today: "2026-01-01" });
  const next = await extractWithLlm("https://club.test/cache", html, { today: "2026-10-12" });
  expect(first.events).toHaveLength(1);
  expect(first.events[0]?.evidence?.quote).toBe(quote);
  expect(next.events).toEqual([]);
  expect(next.cacheHits).toBe(1);
  expect(next.usage.costUsd).toBe(0);
  expect(ask).toHaveBeenCalledTimes(1);
});

it("preserves completed chunks when a later AI request fails and retries the failed chunk", async () => {
  vi.stubEnv("LLM_EXTRACTION_CACHE_DIR", "");
  const long = html + `<pre>${("background only\n").repeat(3000)}</pre>`;
  ask.mockResolvedValueOnce({ json: { races: [raw] }, usage, stopReason: "end_turn" }).mockRejectedValueOnce(new Error("rate limited"));
  const first = await extractWithLlm("https://club.test/partial", long, { today: "2026-01-01" });
  expect(first.events).toHaveLength(1);
  expect(first.truncated).toBe(true);
  expect(first.chunksRead).toBe(1);
  expect(first.issues).toContain("rate limited");
  ask.mockResolvedValue({ json: { races: [] }, usage, stopReason: "end_turn" });
  const resumed = await extractWithLlm("https://club.test/partial", long, { today: "2026-01-01" });
  expect(resumed.truncated).toBe(false);
  expect(resumed.cacheHits).toBe(1);
  expect(resumed.events).toHaveLength(1);
});

it("resumes beyond the per-run chunk allowance using the cached prefix", async () => {
  vi.stubEnv("LLM_EXTRACTION_CACHE_DIR", "");
  const long = html + `<pre>${"background only\n".repeat(3000)}</pre>`;
  ask.mockResolvedValue({ json: { races: [raw] }, usage, stopReason: "end_turn" });
  const first = await extractWithLlm("https://club.test/resume-limit", long, { today: "2026-01-01", maxChunks: 1 });
  expect(first.truncated).toBe(true);
  expect(first.chunksRead).toBe(1);
  ask.mockResolvedValue({ json: { races: [] }, usage, stopReason: "end_turn" });
  const resumed = await extractWithLlm("https://club.test/resume-limit", long, { today: "2026-01-01", maxChunks: 1 });
  expect(resumed.truncated).toBe(false);
  expect(resumed.cacheHits).toBe(1);
  expect(resumed.chunksRead).toBe(2);
});

it("reports unread chunks rather than calling a capped calendar complete", async () => {
  vi.stubEnv("LLM_EXTRACTION_CACHE_DIR", "");
  ask.mockResolvedValue({ json: { races: [raw] }, usage, stopReason: "end_turn" });
  const read = await extractWithLlm("https://club.test/capped", html + `<pre>${"background\n".repeat(4000)}</pre>`, { today: "2026-01-01", maxChunks: 1 });
  expect(read.truncated).toBe(true);
  expect(read.issues).toContain("chunk_limit");
  expect(read.chunksTotal).toBeGreaterThan(read.chunksRead);
});

it("defers a new model request when the watch deadline is exhausted", async () => {
  vi.stubEnv("LLM_EXTRACTION_CACHE_DIR", "");
  const read = await extractWithLlm("https://club.test/deadline", html, { today: "2026-01-01", deadline: Date.now() });
  expect(read.truncated).toBe(true);
  expect(read.issues).toContain("calendar_time_budget_exhausted");
  expect(ask).not.toHaveBeenCalled();
});

it("does not borrow another row's link or a year from an unrelated season", () => {
  const link = "https://entry.test/other";
  const text = `${quote}\n12.10.2026 Othercross [enter](${link})`;
  const events = verifyRaces([{ ...raw, url: link, country: "CZ" }], text, new Set([link]), "https://club.test/", "2026-01-01");
  expect(events[0]?.sourceUrl).toBe("https://club.test/");
  expect(events[0]?.countryHint).toBeUndefined();
  expect(verifyRaces([{ ...raw, quote: "11.10. Perlcross" }], "Season 2027\n11.10. Perlcross\nArchive 2026", new Set(), "https://club.test/", "2026-01-01")).toEqual([]);
});

it("uses an evidenced series heading for a venue-only row and requires literal cancellation wording", () => {
  const text = "CBA Oderský pohár 2026\n28.10.2026 Rohov — závod zrušen";
  const result = verifyRaces([{ name: "Rohov", start_date: "2026-10-28", quote: "28.10.2026 Rohov — závod zrušen",
    series_name: "CBA Oderský pohár 2026", series_quote: "CBA Oderský pohár 2026", cancelled: true }], text, new Set(), "https://club.test/", "2026-01-01");
  expect(result[0]?.name).toBe("CBA Oderský pohár 2026 — Rohov");
  expect(result[0]?.status).toBe("cancelled");
  expect(verifyRaces([{ ...raw, cancelled: true }], quote, new Set(), "https://club.test/", "2026-01-01")[0]?.status).toBeUndefined();
});

it("follows only source-backed anchors to calendars or documents", () => {
  const pdf = "https://club.test/calendar.pdf", other = "https://club.test/other", invented = "https://club.test/2027";
  const text = `[Calendar 2027](${pdf})\n[Gallery](${other})`;
  expect(verifyFollowLinks([
    { url: pdf, kind: "calendar", quote: "Calendar 2027" },
    { url: other, kind: "calendar", quote: "Calendar 2027" },
    { url: invented, kind: "calendar", quote: "Calendar 2027" },
  ], text, new Set([pdf, other]), "https://club.test/")).toEqual([pdf]);
});
