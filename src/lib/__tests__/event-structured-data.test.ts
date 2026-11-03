import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EventJsonLd } from "@/components/seo/event-json-ld";
import type { EventListItem } from "@/lib/events";
afterEach(() => vi.useRealTimers());
const base = { name: "Race", slug: "race", startDate: "2027-05-01", status: "scheduled", registrationUrl: "https://club.test/entry", location: { city: "Praha", countryCode: "CZ", lat: 50, lng: 14 } } as unknown as EventListItem;
function data(event: EventListItem) {
  return JSON.parse(renderToStaticMarkup(createElement(EventJsonLd, { event, locale: "cs" })).match(/<script[^>]*>(.*?)<\/script>/)![1]!);
}
it("does not invent registration availability from a link", () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-01"));
  expect(data(base).offers).toEqual({ "@type": "Offer", url: base.registrationUrl });
  expect(data(base).offers).not.toHaveProperty("availability");
});
it("omits entry offers after the deadline and for cancelled or postponed races", () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-01"));
  for (const event of [{ ...base, registrationClosesAt: "2026-10-31T18:00:00Z" }, { ...base, status: "cancelled" }, { ...base, status: "postponed" }, { ...base, startDate: "2026-10-30" }]) {
    expect(data(event as EventListItem)).not.toHaveProperty("offers");
  }
});
it("publishes the same real venue/address/organiser as the visible practical detail without guessed prices or times", () => {
  const evidence = { sourceUrl: "https://club.test/contact", quote: "Race venue Areál Dobrá Voda Turnovská 40", checkedAt: "2026-11-03T08:00:00Z", editionYear: 2027, status: "year_neutral" as const };
  const result = data({ ...base, practicalDetails: { venue: { ...evidence, value: { name: "Areál Dobrá Voda", streetAddress: "Turnovská 40", postalCode: "466 01", locality: "Jablonec nad Nisou 6", precision: "venue" } }, organizer: { ...evidence, value: { name: "Revelations Club", url: "https://club.test/" } } } });
  expect(result.location.name).toBe("Areál Dobrá Voda");
  expect(result.location.address).toMatchObject({ streetAddress: "Turnovská 40", postalCode: "466 01", addressLocality: "Jablonec nad Nisou 6", addressCountry: "CZ" });
  expect(result.organizer).toEqual({ "@type": "Organization", name: "Revelations Club", url: "https://club.test/" });
  expect(result.startDate).toBe(base.startDate);
  expect(result.offers).not.toHaveProperty("price");
});
it("uses a stored venue even before additional practical evidence is available", () => {
  expect(data({ ...base, location: { ...base.location!, venue: "Known race venue" } }).location.name).toBe("Known race venue");
});
