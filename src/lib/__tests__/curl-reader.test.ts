import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ execute: vi.fn(), lookup: vi.fn() }));
vi.mock("node:util", () => ({ promisify: () => state.execute }));
vi.mock("node:dns/promises", () => ({ lookup: state.lookup }));
import { fetchPublicViaCurl } from "@/lib/watcher/curl";
const answer = (status: number, headers = "", body = "Race") => ({ stdout: Buffer.from(`HTTP/2 ${status}\r\n${headers}\r\n${body}`) });
beforeEach(() => { state.execute.mockReset().mockResolvedValue(answer(200, "content-type: text/html\r\n")); state.lookup.mockReset().mockResolvedValue([{ address: "93.184.216.34" }]); });
it("keeps the real HTTP result, TLS validation and bounded execution", async () => {
  state.execute.mockResolvedValue(answer(403, "content-type: text/html\r\n", "Access denied"));
  const response = await fetchPublicViaCurl("https://race.test/", { Accept: "text/html" }, 5000);
  expect(response.status).toBe(403); expect(await response.text()).toBe("Access denied");
  const [command, args, options] = state.execute.mock.calls[0];
  expect(command).toBe("/usr/bin/curl"); expect(args[0]).toBe("-q");
  expect(args).toContain("race.test:443:93.184.216.34");
  for (const dangerous of ["-k", "--insecure", "-L", "--location"]) expect(args).not.toContain(dangerous);
  expect(options.maxBuffer).toBe(6_000_000); expect(options.timeout).toBeLessThanOrEqual(6000);
});
it("checks a redirect before allowing curl to read the next address", async () => {
  state.execute.mockResolvedValueOnce(answer(302, "location: http://127.0.0.1/private\r\n"));
  await expect(fetchPublicViaCurl("https://race.test/", {}, 5000)).rejects.toThrow("Refusing to fetch");
  expect(state.execute).toHaveBeenCalledTimes(1);
});
it("rejects a private address introduced after the first DNS check", async () => {
  state.lookup.mockResolvedValueOnce([{ address: "93.184.216.34" }]).mockResolvedValueOnce([{ address: "10.0.0.1" }]);
  await expect(fetchPublicViaCurl("https://race.test/", {}, 5000)).rejects.toThrow("public addresses");
  expect(state.execute).not.toHaveBeenCalled();
});
it("propagates system certificate failures instead of retrying with verification disabled", async () => {
  state.execute.mockRejectedValue(Error("certificate verify failed"));
  await expect(fetchPublicViaCurl("https://race.test/", {}, 5000)).rejects.toThrow("certificate verify failed");
  expect(state.execute).toHaveBeenCalledTimes(1);
});
it("preserves the final URL after a checked public redirect", async () => {
  state.execute.mockResolvedValueOnce(answer(302, "location: /race\r\n")).mockResolvedValueOnce(answer(200, "content-type: text/html\r\n"));
  const response = await fetchPublicViaCurl("https://race.test/", {}, 5000);
  expect(response.url).toBe("https://race.test/race"); expect(await response.text()).toBe("Race");
});
