import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ events: Array.from({ length: 51 }, (_, i) => ({ id: String(i), name: `Race ${i}`, startDate: "2027-05-01" })) }));
vi.mock("@/lib/race-hub-data", () => ({ listHubEvents: async () => state.events }));
vi.mock("@/lib/race-collection-data", () => ({ getRaceCollection: async () => ({ events: state.events }), listCollectionSummaries: async () => [] }));
import { generateMetadata as countryMetadata } from "@/app/[locale]/(shell)/c/[code]/page";
import { generateMetadata as disciplineMetadata } from "@/app/[locale]/(shell)/c/[code]/[discipline]/page";
import { generateMetadata as collectionMetadata } from "@/app/[locale]/(shell)/collections/[slug]/[[...country]]/page";
import { collectionPath, hubPath } from "@/lib/localized-paths";
import type { Locale } from "@/lib/i18n/messages";

const cases = [
  { metadata: (page?: string | string[]) => countryMetadata({ params: Promise.resolve({ locale: "cs", code: "cz" }), searchParams: Promise.resolve({ page }) }), path: (l: Locale) => hubPath(l, "CZ") },
  { metadata: (page?: string | string[]) => disciplineMetadata({ params: Promise.resolve({ locale: "cs", code: "cz", discipline: "mtb" }), searchParams: Promise.resolve({ page }) }), path: (l: Locale) => hubPath(l, "CZ", "mtb") },
  { metadata: (page?: string | string[]) => collectionMetadata({ params: Promise.resolve({ locale: "cs", slug: "amateur", country: ["cz"] }), searchParams: Promise.resolve({ page }) }), path: (l: Locale) => collectionPath(l, "amateur", "CZ") },
];
describe.each(cases)("paginated metadata $path", ({ metadata, path }) => {
  it("gives page two its own canonical, translated alternates and share URL", async () => {
    const result = await metadata("2");
    expect(result.alternates?.canonical).toBe(`https://letsrace.cz/cs/${path("cs")}?page=2`);
    expect(result.alternates?.languages?.en).toBe(`https://letsrace.cz/en/${path("en")}?page=2`);
    expect(result.alternates?.languages?.["x-default"]).toBe(result.alternates?.languages?.cs);
    expect(result.openGraph?.url).toBe(result.alternates?.canonical);
  });
  it("canonicalizes out-of-range requests to the slice actually shown", async () => {
    expect((await metadata("999")).alternates).toEqual((await metadata("2")).alternates);
  });
  it("keeps page one clean and rejects malformed page values", async () => {
    for (const page of [undefined, "1", "0", "-1", "bad", ["2", "3"], "99999999999999999999"]) {
      expect((await metadata(page)).alternates?.canonical).toBe(`https://letsrace.cz/cs/${path("cs")}`);
    }
  });
});
