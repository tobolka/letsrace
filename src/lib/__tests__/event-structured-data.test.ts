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
