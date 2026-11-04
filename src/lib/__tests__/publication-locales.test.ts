import { beforeEach, expect, it, vi } from "vitest";
import { locales } from "@/lib/i18n/messages";
import { localePath } from "@/lib/localized-paths";

const state = vi.hoisted(() => ({ fetchPublic: vi.fn() }));
vi.mock("@/lib/http/safe-url", () => ({ fetchPublic: state.fetchPublic }));
vi.mock("@/lib/seo", () => ({ getSiteUrl: () => "https://letsrace.test" }));
import { checkPublicationLocales } from "@/lib/pipeline/publication-locales";

beforeEach(() => {
  state.fetchPublic.mockReset().mockImplementation(async (url: string) =>
    new Response(`<html lang="${new URL(url).pathname.split("/")[1]}"><body></body></html>`),
  );
});

it("verifies each locale using its normal public address", async () => {
  const verify = vi.fn();
  expect(await checkPublicationLocales("series/cup", 2000, verify)).toEqual([...locales]);
  expect(state.fetchPublic.mock.calls.map(([url]) => url)).toEqual(locales.map(locale => `https://letsrace.test${localePath(locale, "series/cup")}`));
  expect(verify.mock.calls.map(([, , locale]) => locale)).toEqual(expect.arrayContaining([...locales]));
});

it("cannot finish when a locale silently falls back to a different language", async () => {
  state.fetchPublic.mockImplementation(async () => new Response('<html lang="en"></html>'));
  await expect(checkPublicationLocales("series/cup", 2000, vi.fn())).rejects.toThrow("cs: Public page returned a different language");
});
