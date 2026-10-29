import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProviderHealth, ProviderDeferred } from "@/lib/llm/provider-health";
const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true }); });

it("shares credit failures across processes and permits only one recovery probe", async () => {
  const dir = await mkdtemp(join(tmpdir(), "provider-health-")); dirs.push(dir);
  let now = 1000;
  const a = new ProviderHealth(join(dir, "health.json"), () => now);
  const b = new ProviderHealth(join(dir, "health.json"), () => now);
  const fail = vi.fn(async () => { throw new Error("Anthropic API 400: credit balance is too low"); });
  await expect(a.run("anthropic", fail)).rejects.toBeInstanceOf(ProviderDeferred);
  await expect(b.run("anthropic", fail)).rejects.toThrow("provider_deferred:anthropic:credit");
  expect(fail).toHaveBeenCalledTimes(1);
  expect(await b.run("openai", async () => "independent")).toBe("independent");
  now += 16 * 60_000;
  let finish!: () => void;
  const recovering = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const probe = a.run("anthropic", recovering);
  await vi.waitFor(() => expect(recovering).toHaveBeenCalledTimes(1));
  await expect(b.run("anthropic", recovering)).rejects.toBeInstanceOf(ProviderDeferred);
  finish(); await probe;
  expect(await b.run("anthropic", async () => "recovered")).toBe("recovered");
});

it("does not clear a newer outage when an older request succeeds", async () => {
  const health = new ProviderHealth();
  let finish!: () => void;
  const first = health.run("anthropic", () => new Promise<void>(resolve => { finish = resolve; }));
  await expect(health.run("anthropic", async () => { throw new Error("Anthropic API 401"); })).rejects.toBeInstanceOf(ProviderDeferred);
  finish(); await first;
  await expect(health.run("anthropic", async () => 1)).rejects.toBeInstanceOf(ProviderDeferred);
});

it("does not confuse a document, JSON or process-budget failure with an account outage", async () => {
  const health = new ProviderHealth();
  for (const message of ["Invalid JSON", "LLM budget of $0.25", "source_http_404"]) {
    await expect(health.run("anthropic", async () => { throw new Error(message); })).rejects.toThrow(message);
    expect(await health.run("anthropic", async () => true)).toBe(true);
  }
});

it('allows an explicit credit retry without clearing authentication failures', async () => {
  const health = new ProviderHealth();
  await expect(health.run('anthropic', async () => { throw Error('credit balance is too low'); })).rejects.toBeInstanceOf(ProviderDeferred);
  await health.retryCredit('anthropic');
  expect(await health.run('anthropic', async () => 'ok')).toBe('ok');
  await expect(health.run('anthropic', async () => { throw Error('Anthropic API 401'); })).rejects.toBeInstanceOf(ProviderDeferred);
  await health.retryCredit('anthropic');
  await expect(health.run('anthropic', async () => 'ok')).rejects.toBeInstanceOf(ProviderDeferred);
});
