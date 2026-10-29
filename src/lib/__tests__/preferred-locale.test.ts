import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { preferredLocale, proxy } from "@/proxy";
import { LOCALE_COOKIE } from "@/lib/i18n/locale-preference";
import { locales } from "@/lib/i18n/messages";

describe("preferredLocale", () => {
  it("takes the reader's first language we have", () => {
    expect(preferredLocale("cs-CZ,cs;q=0.9,en;q=0.8")).toBe("cs");
    expect(preferredLocale("de-DE,de;q=0.9,pl;q=0.5")).toBe("de");
    expect(preferredLocale("fr-FR,fr;q=0.9,pl;q=0.5")).toBe("pl");
    expect(preferredLocale("en-US,en;q=0.9,cs;q=0.8")).toBe("en");
    expect(preferredLocale("sk;q=0.4, pl;q=0.9")).toBe("pl");
  });
  it("has nothing to say without a match or a header", () => {
    expect(preferredLocale(null)).toBeNull();
    expect(preferredLocale("fr-FR,fr;q=0.9")).toBeNull();
  });
});

// Exercise the actual redirect: a preference must never leak through CDN caching.
describe("saved language on return visits", () => {
  function visit(cookie?: string, acceptLanguage = "cs-CZ,cs;q=0.9") {
    return proxy(new NextRequest("https://letsrace.cz/?view=list", {
      headers: {
        "accept-language": acceptLanguage,
        ...(cookie ? { cookie: `${LOCALE_COOKIE}=${cookie}` } : {}),
      },
    }));
  }

  it("prioritizes every supported saved language over browser language", () => {
    for (const locale of locales) {
      const response = visit(locale);
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(`https://letsrace.cz/${locale}?view=list`);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("cdn-cache-control")).toBe("no-store");
      expect(response.headers.get("vercel-cdn-cache-control")).toBe("no-store");
    }
  });

  it("falls back to browser language for missing or invalid preferences", () => {
    expect(visit().headers.get("location")).toBe("https://letsrace.cz/cs?view=list");
    expect(visit("invalid").headers.get("location")).toBe("https://letsrace.cz/cs?view=list");
    expect(visit(undefined, "en-US").status).toBe(307);
    expect(visit(undefined, "").status).toBe(308);
  });

  it("respects explicit language links without replacing the saved preference", () => {
    const response = proxy(new NextRequest("https://letsrace.cz/de", {
      headers: { cookie: `${LOCALE_COOKIE}=cs` },
    }));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
