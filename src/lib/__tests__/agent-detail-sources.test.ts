import { describe, expect, it } from "vitest";
import {
  extractOfficialDetailCandidates,
  isGenericSeriesRegulationsUrl,
  isVerifiedDetailUrlForHub,
  needsRoundRegulationsOrDetails,
  resolveDetailSources,
  verifyOfficialDetailPage,
  type DetailPageSnapshot,
  type DetailSourceRace,
} from "@/lib/pipeline2/agent-detail-sources";

const OSTRAVA_RACE: DetailSourceRace = {
  id: "dc545ef1-0000-0000-0000-000000000000",
  name: "UCI Cyclo-cross World Cup Ostrava",
  date: "2026-11-29",
  end_date: null,
  place: "Ostrava",
};

describe("agent-detail-sources", () => {
  it("matches official same-host detail URLs and rejects third-party hosts", () => {
    const hubs = ["https://www.ucicyclocrossworldcup.com/en/calendar/2026-2027"];
    expect(
      isVerifiedDetailUrlForHub("https://www.ucicyclocrossworldcup.com/en/calendar/2026-2027/ostrava", hubs),
    ).toBe(true);
    expect(
      isVerifiedDetailUrlForHub("https://ucicyclocrossworldcup.com/en/calendar/2026-2027/ostrava", hubs),
    ).toBe(true);
    expect(
      isVerifiedDetailUrlForHub("https://evil.example/en/calendar/2026-2027/ostrava", hubs),
    ).toBe(false);
    expect(
      isVerifiedDetailUrlForHub("https://other.wordpress.com/ostrava", ["https://club.wordpress.com/"]),
    ).toBe(false);
  });

  it("resolves Ostrava 2026-2027 detail page from the official World Cup hub", async () => {
    const hubUrl = "https://www.ucicyclocrossworldcup.com/en/calendar/2026-2027";
    const ostravaUrl = "https://www.ucicyclocrossworldcup.com/en/calendar/2026-2027/ostrava";
    const pages: Record<string, DetailPageSnapshot> = {
      [hubUrl]: {
        url: hubUrl,
        text: [
          "UCI Cyclo-cross World Cup Calendar 2026-2027",
          "22 November 2026 - Tábor",
          "29 November 2026 - Ostrava",
          "6 December 2026 - Flamanville",
          "13 December 2026 - Cabras",
          "20 December 2026 - Antwerp",
          "26 December 2026 - Gavere",
        ].join("\n"),
        links: [
          { href: "/en/calendar/2026-2027/tabor", text: "Tábor" },
          { href: "/en/calendar/2026-2027/ostrava", text: "Ostrava" },
          { href: "/en/calendar/2026-2027/antwerp", text: "Antwerp" },
          { href: "/en/calendar/2025-2026/ostrava", text: "Ostrava 2025-2026" },
          { href: "https://thirdparty.example/ostrava", text: "Ostrava" },
        ],
      },
      [ostravaUrl]: {
        url: ostravaUrl,
        text: [
          "UCI Cyclo-cross World Cup Ostrava",
          "Season 2026-2027",
          "Date: 29 November 2026",
          "Venue: Dolní Vítkovice, Ostrava",
          "Parking: Official spectator parking at P1 Dolní Vítkovice.",
        ].join("\n"),
        links: [],
      },
    };

    const candidates = extractOfficialDetailCandidates(hubUrl, pages[hubUrl]!.links, OSTRAVA_RACE);
    expect(candidates).toEqual([ostravaUrl]);

    const resolved = await resolveDetailSources(OSTRAVA_RACE, {
      allowedUrls: [hubUrl],
      fetchPage: async (url) => pages[url] ?? null,
    });

    expect(resolved.officialDetailUrl).toBe(ostravaUrl);
    expect(resolved.urls[0]).toBe(ostravaUrl);
    expect(resolved.urls).toContain(hubUrl);
    expect(resolved.missingDetailReason).toBeNull();
  });

  it("rejects a detail page for another round (Antwerp / Tábor)", () => {
    const antwerp = verifyOfficialDetailPage(
      "https://www.ucicyclocrossworldcup.com/en/calendar/2026-2027/antwerp",
      [
        "UCI Cyclo-cross World Cup Antwerp",
        "Season 2026-2027",
        "20 December 2026",
        "Venue: Sint-Anneke, Antwerp",
      ].join("\n"),
      OSTRAVA_RACE,
    );
    expect(antwerp.ok).toBe(false);

    const tabor = verifyOfficialDetailPage(
      "https://www.ucicyclocrossworldcup.com/en/calendar/2026-2027/tabor",
      [
        "UCI Cyclo-cross World Cup Tábor",
        "Season 2026-2027",
        "22 November 2026",
        "Venue: Komora, Tábor",
      ].join("\n"),
      OSTRAVA_RACE,
    );
    expect(tabor.ok).toBe(false);
  });

  it("rejects a detail page for another season/edition (2025-2026 Ostrava)", () => {
    const previousSeason = verifyOfficialDetailPage(
      "https://www.ucicyclocrossworldcup.com/en/calendar/2025-2026/ostrava",
      [
        "UCI Cyclo-cross World Cup Ostrava",
        "Season 2025-2026",
        "30 November 2025",
        "Venue: Dolní Vítkovice, Ostrava",
      ].join("\n"),
      OSTRAVA_RACE,
    );
    expect(previousSeason.ok).toBe(false);
    expect(previousSeason.reason).toBe("wrong_edition_season");

    // Even without season in URL, a 2025 date on the page must fail
    const oldDateSameSlug = verifyOfficialDetailPage(
      "https://www.ucicyclocrossworldcup.com/en/ostrava",
      [
        "UCI Cyclo-cross World Cup Ostrava",
        "30 November 2025",
        "Venue: Dolní Vítkovice, Ostrava",
      ].join("\n"),
      OSTRAVA_RACE,
    );
    expect(oldDateSameSlug.ok).toBe(false);
  });

  it("returns missingDetailReason and forwards previousMissingReason on next attempt", async () => {
    const hubUrl = "https://www.ucicyclocrossworldcup.com/en/calendar/2026-2027";
    const fetchPage = async (url: string): Promise<DetailPageSnapshot | null> => {
      if (url === hubUrl) {
        return {
          url: hubUrl,
          text: "UCI Cyclo-cross World Cup Calendar 2026-2027\nSchedule coming soon.",
          links: [{ href: "/en/rules", text: "Rules" }],
        };
      }
      return null;
    };

    const firstAttempt = await resolveDetailSources(OSTRAVA_RACE, {
      allowedUrls: [hubUrl],
      fetchPage,
    });
    expect(firstAttempt.officialDetailUrl).toBeNull();
    expect(firstAttempt.urls).toEqual([hubUrl]);
    expect(firstAttempt.missingDetailReason).toContain("official_detail_missing_in_allowed_sources");
    expect(firstAttempt.previousMissingReason).toBeNull();

    const secondAttempt = await resolveDetailSources(OSTRAVA_RACE, {
      allowedUrls: [hubUrl],
      fetchPage,
      previousMissingReason: firstAttempt.missingDetailReason,
    });
    expect(secondAttempt.officialDetailUrl).toBeNull();
    expect(secondAttempt.missingDetailReason).toContain("official_detail_missing_in_allowed_sources");
    expect(secondAttempt.previousMissingReason).toBe(firstAttempt.missingDetailReason);
  });

  it("detects generic series rules/regulations/overview URLs vs round-specific documents", () => {
    expect(isGenericSeriesRegulationsUrl("https://www.iprimacup.cz/o-serialu/pravidla/")).toBe(true);
    expect(isGenericSeriesRegulationsUrl("https://www.ucicyclocrossworldcup.com/en/regulations-en")).toBe(true);
    expect(isGenericSeriesRegulationsUrl("https://www.iprimacup.cz/")).toBe(true);
    expect(isGenericSeriesRegulationsUrl("https://example.com/pravidla")).toBe(true);
    expect(isGenericSeriesRegulationsUrl("https://example.com/rules")).toBe(true);
    expect(isGenericSeriesRegulationsUrl("https://example.com/regulations")).toBe(true);
    expect(isGenericSeriesRegulationsUrl("https://example.com/regulations-de/")).toBe(true);
    expect(isGenericSeriesRegulationsUrl("https://example.com/generalausschreibung")).toBe(true);
    expect(isGenericSeriesRegulationsUrl("https://example.com/reglement")).toBe(true);
    expect(isGenericSeriesRegulationsUrl("https://example.com/series-rules")).toBe(true);
    expect(isGenericSeriesRegulationsUrl("https://example.com/series-regulations")).toBe(true);
    expect(isGenericSeriesRegulationsUrl("https://example.com/calendar")).toBe(true);
    expect(isGenericSeriesRegulationsUrl("https://example.com/kalendar")).toBe(true);

    expect(isGenericSeriesRegulationsUrl("https://www.iprimacup.cz/27-hk/")).toBe(false);
    expect(isGenericSeriesRegulationsUrl("https://www.ucicyclocrossworldcup.com/en/calendar/2026-2027/ostrava")).toBe(false);
    expect(isGenericSeriesRegulationsUrl("https://pzkol.pl/pobierz/14559/14559_regulamin.pdf")).toBe(false);
    expect(isGenericSeriesRegulationsUrl("https://example.com/docs/ostrava-2026-propozice.pdf")).toBe(false);
    expect(isGenericSeriesRegulationsUrl(null)).toBe(false);
  });

  it("determines whether a race still needs round regulations or detail extraction", () => {
    const genericWithDocsOnly = needsRoundRegulationsOrDetails({
      regulations_url: "https://www.iprimacup.cz/o-serialu/pravidla/",
      practical_details: {
        documents: { value: [{ kind: "series_rules", url: "https://www.iprimacup.cz/o-serialu/pravidla/" }] },
      },
    });
    expect(genericWithDocsOnly.genericSeriesRules).toBe(true);
    expect(genericWithDocsOnly.needsRegulations).toBe(true);
    expect(genericWithDocsOnly.needsDetails).toBe(true);
    expect(genericWithDocsOnly.missingCoreFields).toEqual(["venue", "routes", "fees", "schedule", "categories"]);

    const genericWithFourCoreFields = needsRoundRegulationsOrDetails({
      regulations_url: "https://www.iprimacup.cz/o-serialu/pravidla/",
      practical_details: {
        venue: { value: { name: "Aréna Hradec" } },
        routes: { value: [{ name: "Okruh" }] },
        fees: { value: [{ label: "Elite", amount: 500, currency: "CZK" }] },
        schedule: { value: [{ label: "Start", date: "2026-06-27", time: "10:00" }] },
      },
    });
    expect(genericWithFourCoreFields.genericSeriesRules).toBe(true);
    expect(genericWithFourCoreFields.needsRegulations).toBe(false);
    expect(genericWithFourCoreFields.needsDetails).toBe(true);
    expect(genericWithFourCoreFields.missingCoreFields).toEqual(["categories"]);
  });
});
