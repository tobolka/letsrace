import { expect, it } from "vitest";
import { organizerLinks } from "@/lib/discovery/organizer-links";

const detail = "https://www.bikepoint.sk/kalendar/april/25-04-2027/quick-sport-jarny-sprint/";
const block = (href: string, label = "organizátor:") => `<div class="organizator"><strong>${label}</strong><a href="${href}">BEER INSIDE TEAM</a></div>`;

it("follows the explicit organizer link in the race detail", () => {
  expect(organizerLinks(block("http://www.jarnysprint.sk/"), detail)).toEqual(["http://www.jarnysprint.sk/"]);
});
it("does not take another event's organizer from a calendar or unrelated host", () => {
  const html = block("https://organizer.test/");
  for (const url of ["https://www.bikepoint.sk/kalendar/", "https://www.bikepoint.sk/kalendar/april/", "https://unrelated.test/kalendar/april/25-04-2027/race/"]) expect(organizerLinks(html, url)).toEqual([]);
});
it("ignores banners, contact email, placeholders, local addresses and social links", () => {
  const html = `<a href="https://sponsor.test/">Banner</a>${["#", "mailto:organizer@example.test", "http://127.0.0.1/", "https://facebook.com/club", "https://www.bikepoint.sk/"].map(href => block(href)).join("")}`;
  expect(organizerLinks(html, detail)).toEqual([]);
});
it("does not confuse a registration or sponsor block with the organizer", () => {
  expect(organizerLinks(block("https://registration.test/", "registrácia:") + block("https://sponsor.test/", "partner:"), detail)).toEqual([]);
});
it("deduplicates actual links and keeps the read fan-out bounded", () => {
  expect(organizerLinks(block("https://one.test/#nav") + block("https://one.test/") + block("https://two.test/") + block("https://three.test/"), detail)).toEqual(["https://one.test/", "https://two.test/"]);
});
