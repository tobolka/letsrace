import { expect, it } from "vitest";
import { extractJsonLdEvents } from "@/lib/watcher/extractors/jsonld";
import { isCountryOnlyPlace } from "@/lib/catalog/overview-quality";
it("keeps a structured Cyprus assertion even when the footer names Switzerland", () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "SportsEvent", name: "UCI Cyprus Gran Fondo", startDate: "2027-04-02", location: { name: "Cyprus", address: { addressCountry: "CY" } } })}</script><footer>Switzerland Austria Czechia</footer>`;
  expect(extractJsonLdEvents("https://event.test/race", html)[0]).toMatchObject({ countryHint: "CY", placeText: "Cyprus" });
  expect(isCountryOnlyPlace("Cyprus")).toBe(true);
  expect(isCountryOnlyPlace("Söll")).toBe(false);
});
