import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localSourceReader, readJson, writeJsonAtomic } from "@/lib/catalog/local-source-cache";
const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });
async function directory() { const path = await mkdtemp(join(tmpdir(), "letsrace-source-cache-")); directories.push(path); return path; }

it("resumes cached documents across runs and shares concurrent reads and anchors", async () => {
  const path = await directory();
  const read = vi.fn(async (url: string) => ({ url, text: "Category U13", html: null, thin: false }));
  const options = { directory: path, read, maxAgeMs: 10000, deadline: Date.now() + 10000, stopped: () => false };
  const first = localSourceReader(options);
  await Promise.all([first.read("https://club.cz/race"), first.read("https://club.cz/race#propozice")]);
  expect(read).toHaveBeenCalledTimes(1);
  const resumed = localSourceReader(options);
  expect((await resumed.read("https://club.cz/race"))?.text).toBe("Category U13");
  expect(read).toHaveBeenCalledTimes(1);
  expect(resumed.stats().cached).toBe(1);
});

it("retries failed reads in the next run and starts no requests after the deadline", async () => {
  const path = await directory();
  const read = vi.fn(async () => null);
  const options = { directory: path, read, maxAgeMs: 10000, deadline: Date.now() + 10000, stopped: () => false };
  expect(await localSourceReader(options).read("https://club.cz/race")).toBeNull();
  await localSourceReader(options).read("https://club.cz/race");
  expect(read).toHaveBeenCalledTimes(2);
  await localSourceReader({ ...options, deadline: Date.now() - 1 }).read("https://club.cz/other");
  expect(read).toHaveBeenCalledTimes(2);
});

it("parallel progress writes remain atomic and valid JSON", async () => {
  const path = join(await directory(), "progress.json");
  await Promise.all(Array.from({ length: 8 }, (_, step) => writeJsonAtomic(path, { step })));
  expect(await readJson(path)).toEqual({ step: expect.any(Number) });
});
