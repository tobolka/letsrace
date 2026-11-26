import { afterEach, describe, expect, it, vi } from "vitest";
import { resetSerperProcessCounter, serperSearch } from "@/lib/catalog/serper";
import { checkSearxngHealth, resetSearxngProcessCounter, searxngSearch, SearxngUnavailable } from "@/lib/catalog/searxng";
import { activeSearchProviders, runWebSearch } from "@/lib/catalog/web-search";
import { organizerLinks } from "@/lib/discovery/organizer-links";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetSerperProcessCounter();
  resetSearxngProcessCounter();
});

describe("Serper & SearXNG search providers", () => {
  it("sends regional Google query to Serper with social exclusions and maps organic hits", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key");
    vi.stubEnv("SERPER_SEARCH_LIMIT", "5");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        organic: [
          { link: "https://zavod.cz/propozice", title: "Závod 2027", snippet: "Termín 15.5.2027" },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const hits = await serperSearch("mtb závody 2027", { country: "CZ", count: 10 });
    expect(hits).toEqual([
      { url: "https://zavod.cz/propozice", title: "Závod 2027", description: "Termín 15.5.2027" },
    ]);
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(String(init.body));
    expect(body.gl).toBe("cz");
    expect(body.hl).toBe("cs");
    expect(body.q).toContain("-site:facebook.com");
  });

  it("queries local SearXNG JSON endpoint", async () => {
    vi.stubEnv("SEARXNG_URL", "http://127.0.0.1:8888/");
    vi.stubEnv("SEARXNG_SEARCH_LIMIT", "5");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          results: [{ url: "https://klub.cz/kalendar", title: "Kalendář", content: "Závody 2027" }],
        }),
      }),
    );
    const hits = await searxngSearch("cyklo 2027", { country: "CZ", count: 5 });
    expect(hits).toEqual([
      { url: "https://klub.cz/kalendar", title: "Kalendář", description: "Závody 2027" },
    ]);
  });

  it("prefers searxng -> serper -> brave in activeSearchProviders", () => {
    vi.stubEnv("SERPER_API_KEY", "k");
    vi.stubEnv("SEARXNG_URL", "http://127.0.0.1:8888");
    vi.stubEnv("BRAVE_API_KEY", "b");
    vi.stubEnv("BRAVE_SEARCH_LIMIT", "10");
    expect(activeSearchProviders()).toEqual(["searxng", "serper", "brave"]);
  });

  it("falls back to serper when searxng returns empty results", async () => {
    vi.stubEnv("SEARXNG_URL", "http://127.0.0.1:8888");
    vi.stubEnv("SERPER_API_KEY", "k");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          organic: [{ link: "https://zavod.cz", title: "Závod", snippet: "2027" }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const out = await runWebSearch("zavod 2027", { country: "CZ" });
    expect(out.provider).toBe("serper");
    expect(out.hits).toHaveLength(1);
  });

  it("throws SearxngUnavailable on network error and circuit-breaks subsequent calls in the same process", async () => {
    vi.stubEnv("SEARXNG_URL", "http://127.0.0.1:8888");
    const err = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:8888"), { code: "ECONNREFUSED" }),
    });
    const fetchMock = vi.fn().mockRejectedValue(err);
    vi.stubGlobal("fetch", fetchMock);

    await expect(searxngSearch("mtb 2027")).rejects.toThrow(SearxngUnavailable);
    await expect(searxngSearch("gravel 2027")).rejects.toThrow(SearxngUnavailable);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resetSearxngProcessCounter();
    await expect(searxngSearch("road 2027")).rejects.toThrow(SearxngUnavailable);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws SearxngUnavailable when SearXNG returns invalid JSON", async () => {
    vi.stubEnv("SEARXNG_URL", "http://127.0.0.1:8888");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      }),
    );

    await expect(searxngSearch("mtb 2027")).rejects.toThrow(SearxngUnavailable);
  });

  it("falls back cleanly from dead searxng to serper and skips dead searxng on next runWebSearch", async () => {
    vi.stubEnv("SEARXNG_URL", "http://127.0.0.1:8888");
    vi.stubEnv("SERPER_API_KEY", "k");
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.startsWith("http://127.0.0.1:8888")) {
        throw Object.assign(new TypeError("fetch failed"), {
          cause: Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:8888"), { code: "ECONNREFUSED" }),
        });
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          organic: [{ link: "https://zavod.cz", title: "Závod", snippet: "2027" }],
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await runWebSearch("zavod 2027", { country: "CZ" });
    expect(first.provider).toBe("serper");
    expect(first.hits).toHaveLength(1);

    const second = await runWebSearch("jiny zavod 2027", { country: "CZ" });
    expect(second.provider).toBe("serper");
    expect(second.hits).toHaveLength(1);
    const searxngCalls = fetchMock.mock.calls.filter(([u]) => String(u).startsWith("http://127.0.0.1:8888"));
    expect(searxngCalls).toHaveLength(1);
  });

  it("reports SearXNG health status cleanly", async () => {
    vi.stubEnv("SEARXNG_URL", "");
    expect(await checkSearxngHealth(500)).toEqual({ configured: false, ok: false });

    vi.stubEnv("SEARXNG_URL", "http://127.0.0.1:8888");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200 })
      .mockRejectedValueOnce(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await checkSearxngHealth(500)).toEqual({ configured: true, ok: true });
    expect(await checkSearxngHealth(500)).toEqual({ configured: true, ok: false, error: "fetch failed" });
  });

  it("extracts same-host calendar/race subpages in organizerLinks", () => {
    const html = `<html><body>
      <a href="/kalendar-2027">Kalendář</a>
      <a href="/propozice">Propozice</a>
      <a href="https://facebook.com/club">FB</a>
      <a href="/kontakt">Kontakt</a>
    </body></html>`;
    expect(organizerLinks(html, "https://cykloklub.cz/")).toEqual([
      "https://cykloklub.cz/kalendar-2027",
      "https://cykloklub.cz/propozice",
    ]);
  });
});
