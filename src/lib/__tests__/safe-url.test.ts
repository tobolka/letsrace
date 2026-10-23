import { afterEach, describe, expect, it, vi } from "vitest";

const lookup = vi.fn();
vi.mock("node:dns/promises", () => ({ lookup: (...args: unknown[]) => lookup(...args) }));

import {
  assertPublicHttpUrl,
  checkPublicUrl,
  fetchPublic,
  isPrivateAddress,
  UnsafeUrlError,
} from "@/lib/http/safe-url";

afterEach(() => {
  vi.restoreAllMocks();
  lookup.mockReset();
});

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
    "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255",
    "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe",
  ])("%s is private", (ip) => expect(isPrivateAddress(ip)).toBe(true));

  it.each(["8.8.8.8", "172.32.0.1", "172.15.0.1", "100.63.0.1", "93.184.216.34", "2606:4700:4700::1111", "::ffff:8.8.8.8"])(
    "%s is public",
    (ip) => expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe("checkPublicUrl", () => {
  it.each([
    "https://letsrace.cz/x?y=1", "http://example.com", "https://example.com:443/a", "http://example.com:80", "https://sub.example.co.uk",
  ])("accepts %s", (url) => expect(checkPublicUrl(url).href).toBeTruthy());

  it.each([
    "file:///etc/passwd", "ftp://example.com", "javascript:alert(1)", "not a url",
    "http://localhost/", "http://app.localhost/", "http://printer.local/", "http://db.internal/", "http://intranet/",
    "http://127.0.0.1/", "http://2130706433/", "http://0x7f.1/", "http://[::1]/", "http://169.254.169.254/latest/meta-data/",
    "http://[::ffff:127.0.0.1]/", "https://example.com:8443/", "http://example.com:22/", "https://user:pw@example.com/",
  ])("refuses %s", (url) => expect(() => checkPublicUrl(url)).toThrow(UnsafeUrlError));
});

describe("assertPublicHttpUrl", () => {
  it("refuses a name that resolves to a private address", async () => {
    lookup.mockResolvedValue([{ address: "93.184.216.34" }, { address: "10.0.0.5" }]);
    await expect(assertPublicHttpUrl("https://sneaky.example.com/")).rejects.toThrow(/private address/);
  });

  it("accepts a name that resolves to public addresses only", async () => {
    lookup.mockResolvedValue([{ address: "93.184.216.34" }]);
    await expect(assertPublicHttpUrl("https://example.com/")).resolves.toBeInstanceOf(URL);
  });

  it("leaves a name that does not resolve to the request to report", async () => {
    lookup.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(assertPublicHttpUrl("https://nope.example.com/")).resolves.toBeInstanceOf(URL);
  });

  it("does not ask DNS about a literal address", async () => {
    await expect(assertPublicHttpUrl("https://8.8.8.8/")).resolves.toBeInstanceOf(URL);
    expect(lookup).not.toHaveBeenCalled();
  });
});

describe("fetchPublic", () => {
  const redirect = (status: number, location: string) =>
    new Response(null, { status, headers: { location } });

  it("follows redirects across public hosts", async () => {
    lookup.mockResolvedValue([{ address: "93.184.216.34" }]);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(redirect(301, "https://www.example.com/page"))
      .mockResolvedValueOnce(new Response("hello"));
    const res = await fetchPublic("http://example.com/page");
    expect(await res.text()).toBe("hello");
    expect(String(fetchMock.mock.calls[1]![0])).toBe("https://www.example.com/page");
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ redirect: "manual" });
  });

  it("will not be redirected to the cloud metadata address", async () => {
    lookup.mockResolvedValue([{ address: "93.184.216.34" }]);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(redirect(302, "http://169.254.169.254/latest/meta-data/"));
    await expect(fetchPublic("https://example.com/")).rejects.toThrow(UnsafeUrlError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("turns a 302 after a POST into a GET and keeps a 307 as it was", async () => {
    lookup.mockResolvedValue([{ address: "93.184.216.34" }]);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(redirect(302, "/a"))
      .mockResolvedValueOnce(redirect(307, "/b"))
      .mockResolvedValueOnce(new Response("done"));
    await fetchPublic("https://example.com/", { method: "POST", body: "x=1" });
    expect(fetchMock.mock.calls[1]![1]).toMatchObject({ method: "GET", body: undefined });
    expect(fetchMock.mock.calls[2]![1]).toMatchObject({ method: "GET", body: undefined });
  });

  it("gives up on a loop", async () => {
    lookup.mockResolvedValue([{ address: "93.184.216.34" }]);
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => redirect(302, "/again"));
    await expect(fetchPublic("https://example.com/")).rejects.toThrow(/too many redirects/);
  });

  it("returns a 304 as it is", async () => {
    lookup.mockResolvedValue([{ address: "93.184.216.34" }]);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 304, headers: { location: "/x" } }));
    expect((await fetchPublic("https://example.com/")).status).toBe(304);
  });
});
