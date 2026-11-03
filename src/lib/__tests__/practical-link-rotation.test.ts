import { expect, it } from "vitest";
import { rotatePracticalLinks } from "@/lib/catalog/practical-enrichment";

it("eventually puts every child document first under a fixed read budget", () => {
  const links = ["https://club.test/contact", "https://club.test/programme", "https://club.test/rules.pdf", "https://club.test/routes"];
  const visited = links.map((_, attempt) => rotatePracticalLinks(links, attempt)[0]);
  expect(visited).toEqual(links);
  expect(rotatePracticalLinks(links, 4)).toEqual(links);
});

it("deduplicates child links before rotating without dropping any", () => {
  expect(rotatePracticalLinks(["a", "b", "a", "c"], 1)).toEqual(["b", "c", "a"]);
  expect(rotatePracticalLinks([], 2)).toEqual([]);
});
