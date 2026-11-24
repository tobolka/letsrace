import { afterEach, describe, expect, it, vi } from "vitest";
import { resetSerperProcessCounter, serperSearch } from "@/lib/catalog/serper";
import { resetSearxngProcessCounter, searxngSearch } from "@/lib/catalog/searxng";
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
