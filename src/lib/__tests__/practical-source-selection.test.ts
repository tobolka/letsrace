import { expect, it } from "vitest";
import { practicalSeedUrls, practicalChildLinks } from "@/lib/catalog/practical-enrichment";

it("keeps an attached document without promoting its aggregator to the race website", () => {
  expect(practicalSeedUrls({ website_url: "https://mtbs.cz/kalendar", regulations_url: "https://maraton.cz/terms/race.pdf" })).toEqual(["https://maraton.cz/terms/race.pdf"]);
  expect(practicalSeedUrls({ registration_url: "https://club.test/konto/register" })).toEqual([]);
  expect(practicalSeedUrls({ regulations_url: "javascript:alert(1)" })).toEqual([]);
});

it("follows organiser regulations and contact links, not results or old archives", () => {
  const links = ["https://club.test/contact", "https://club.test/programme", "https://files.test/rules.pdf", "https://club.test/results/2026.pdf", "https://club.test/archive/rules.pdf", "https://club.test/course.gpx", "https://other.test/contact"];
  expect(practicalChildLinks("https://club.test/", links, {})).toEqual(links.slice(0, 3));
});

it("does not expand the supplied entry platform or federation calendar into other races' documents", () => {
  const links = ["https://files.test/some-other-race.pdf"];
  expect(practicalChildLinks("https://zpn-timing.de/events/", links, { registration_url: "https://zpn-timing.de/events/" })).toEqual([]);
  expect(practicalChildLinks("https://www.cyklistikaszc.sk/sk/cyklokros/kalendar", links, {})).toEqual([]);
});
