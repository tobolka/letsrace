import { expect, it } from "vitest";
import { parsePrimaListing } from "@/lib/watcher/extractors/cz-calendars";

// The shape of https://www.iprimacup.cz/zavody-2027/ as read on 9 Nov 2026.
const card = (href: string, title: string, date: string, note = "") => `<div class="pc2027-card"><a href="${href}"><img src="x.png"/></a></p> <h3>${title}</h3> <p><strong>${date}</strong>${note}</p> <div class="vc_btn3-container"><a class="vc_btn3" href="${href}">Informace o závodě</a></div> </div>`;
const html = `<h4>Kde se uvidíme v roce 2027?</h4><div class="pc2027-grid">${[
  card("/27-hk/", "Hradec Králové 2027", "10. 4. 2027"),
  card("/27-ha/", "Harrachov – Jakuszyce, Szklarska Poręba 2027", "8. 5. 2027"),
  card("/27-te/", "Kupkolo MTB Trilogy – Teplice nad Metují 2027", "3.–5. 7. 2027"),
  card("/27-pm/", "FILIPA Podkrkonošský maraton – Lázně Bělohrad 2027", "31. 7. 2027"),
  card("/27-va/", "Valtice 2027", "18. 9. 2027", "<br/>Celkové vyhlášení seriálu · nebodovaný závod"),
  card("/27-xx/", "Bez termínu 2027", "termín upřesníme"),
].join("")}</div>`;

it("reads each round of the Prima Cup season from its card", () => {
  const events = parsePrimaListing("https://www.iprimacup.cz/zavody-2027/", html);
  expect(events.map(e => [e.name, e.startDate, e.endDate, e.placeText, e.websiteUrl])).toEqual([
    ["Prima CUP — Hradec Králové", "2027-04-10", undefined, "Hradec Králové", "https://www.iprimacup.cz/27-hk/"],
    ["Prima CUP — Harrachov – Jakuszyce, Szklarska Poręba", "2027-05-08", undefined, "Harrachov", "https://www.iprimacup.cz/27-ha/"],
    ["Kupkolo MTB Trilogy – Teplice nad Metují", "2027-07-03", "2027-07-05", "Teplice nad Metují", "https://www.iprimacup.cz/27-te/"],
    ["FILIPA Podkrkonošský maraton – Lázně Bělohrad", "2027-07-31", undefined, "Lázně Bělohrad", "https://www.iprimacup.cz/27-pm/"],
    ["Prima CUP — Valtice", "2027-09-18", undefined, "Valtice", "https://www.iprimacup.cz/27-va/"],
  ]);
});

it("finds nothing on a listing without dated cards, so the older reader takes over", () => {
  expect(parsePrimaListing("https://www.iprimacup.cz/zavody-2026/", `<a class="vc_gitem-link" href="https://www.iprimacup.cz/26-hk/" title="BEST Hradec Králové 2026">x</a>`)).toEqual([]);
});
