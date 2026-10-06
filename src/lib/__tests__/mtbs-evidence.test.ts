import { expect, it } from "vitest";
import { parseMtbsCards } from "@/lib/watcher/extractors/mtbs";
import { isRegulationsUrl, preferRegulationsUrl } from "@/lib/watcher/regulations-url";

const article = "https://mtbs.cz/clanek/moravskotrebovsky-cyklokros-2026-75818/kategorie/cyklokros";
it("keeps the MTBS race detail, official website, registration and inline rules separately", () => {
  const html = `<div class="card-calendar"><h3>10. 10. 2026</h3><div class="card-calendar__info__top"><ul><li><a>cyklokros</a></li><li><a>Moravská Třebová</a></li><li><a href="${article}">Moravskotřebovský cyklokros</a></li></ul></div><a class="a-badge" href="www.club.cz">Web</a><a class="a-badge" href="https://entry.cz/race">Registrace</a><a class="a-badge" href="${article}#propozice">Propozice</a></div><div class="card-calendar"><h3>11. 10. 2026</h3><div class="card-calendar__info__top"><ul><li><a>xc</a></li><li><a>Brno</a></li><li><a href="/clanek/mulda/kategorie/xc">Mulda</a></li></ul></div></div>`;
  const [first, second] = parseMtbsCards(html);
  expect(first).toMatchObject({ sourceUrl: article, websiteUrl: "https://www.club.cz", registrationUrl: "https://entry.cz/race", regulationsUrl: `${article}#propozice` });
  expect(second?.regulationsUrl).toBeUndefined();
  expect(second?.websiteUrl).toBeUndefined();
});

it("accepts the explicit MTBS rules section and prefers official rules when available", () => {
  expect(isRegulationsUrl(`${article}#propozice`)).toBe(true);
  expect(isRegulationsUrl(article)).toBe(false);
  expect(isRegulationsUrl("https://mtbs.cz/sekce/kalendar#propozice")).toBe(false);
  expect(preferRegulationsUrl(`${article}#propozice`, "https://club.cz/propozice.pdf")).toBe("https://club.cz/propozice.pdf");
});
