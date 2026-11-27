import { describe, expect, it } from "vitest";
import { isPrimaCupRoundUrl, primaCupFacts } from "@/lib/catalog/primacup";
import { verifyPracticalExtraction } from "@/lib/catalog/practical-extraction";

const hkUrl = "https://www.iprimacup.cz/27-hk/";
const hkLinks = [
  "https://www.iprimacup.cz/",
  "https://sport-base.eu/competitions/pc-hradec-27/register",
  "https://mapy.cz/s/homehezaho",
  "https://mapy.cz/s/bapacesene",
  "https://mapy.cz/s/donololugo",
  "https://www.iprimacup.cz/o-serialu/pravidla/",
  "https://sport-base.eu/competitions/pc-hradec-27/start-list",
];
const hkText = `Hradec Králové 2027

[Home](https://www.iprimacup.cz/)Hradec Králové 2027

10. dubna 2027 Hradec Králové · Stříbrný rybník
[Registrovat se](https://sport-base.eu/competitions/pc-hradec-27/register)
Trasy závodu
Trasa A
Délka 65 km, převýšení 430 m · [Mapa trasy](https://mapy.cz/s/homehezaho)
Občerstvení na 25., 44. a 53. km a v cíli.
Trasa B
Délka 46 km, převýšení 300 m · [Mapa trasy](https://mapy.cz/s/homehezaho)
Občerstvení na 25. a 35. km a v cíli.
Trasa C
Délka 20 km, převýšení 50 m · [Mapa trasy](https://mapy.cz/s/homehezaho)
Občerstvení pouze v cíli.
Trasa Classic
Podrobnosti doplníme.
Důležité upozorněníVšechny starty tras A, B, C a Classic proběhnou na Stříbrném rybníku, nikoliv na Malém náměstí. Start, cíl a zázemí všech čtyř tras jsou v rekreačním kempu Stříbrný rybník.

Místo a zázemí
K parkování vozidel doporučujeme využít bezplatné [Parkoviště Stříbrný rybník](https://mapy.cz/s/bapacesene). Nenechávejte svá kola a cennosti bez dozoru, za případnou ztrátu neručíme!

Start, cíl a zázemí závodu jsou v [Rekreačním areálu Stříbrný rybník](https://mapy.cz/s/donololugo), kde proběhne i vyhlášení.

Startovné
Trasa / kategorie | Do 15. 3. | 16. 3.–2. 4. | 3.–8. 4. | Od 9. 4. / na místě
Trasa AHobby, Master a Elite | 1 000 Kč | 1 200 Kč | 1 300 Kč | 1 500 Kč
Trasa BDospělí 19+; Electro od 16 let | 900 Kč | 1 100 Kč | 1 200 Kč | 1 400 Kč
Trasa B – mládežKadeti a kadetky 15–16 let; junioři a juniorky 17–18 let | 400 Kč | 450 Kč | 500 Kč | 600 Kč
ClassicVšechny vypsané kategorie, včetně gravelů a elektrokol | 900 Kč | 1 100 Kč | 1 200 Kč | 1 400 Kč
Trasa CŽeny, muži a Electro Bike mix od 15 let | 700 Kč | 900 Kč | 1 000 Kč | 1 100 Kč
Trasa C – žáciMladší žáci a žákyně 11–12 let (2015–2016); starší 13–14 let (2013–2014) | 200 Kč | 250 Kč | 300 Kč | 400 Kč
Dětské závody D1–D4Děti do 10 let (2017–2027); D1 také odrážedla | 120 Kč | 120 Kč | 120 Kč | 150 Kč

Registrace a výdej čísel
[Registrace ↗](https://sport-base.eu/competitions/pc-hradec-27/register)[Startovní listina ↗](https://sport-base.eu/competitions/pc-hradec-27/start-list)
Prezentace závodu: [Rekreační areál Stříbrný rybník](https://mapy.cz/s/donololugo)

Časový harmonogram
Pátek 9. dubna 2027:

18:00 - 19:00 - registrace a výdej čísel

Sobota, 10. dubna 2027:

07:00 - 12:00 - registrace a výdej čísel; pro jednotlivé trasy platí dřívější uzávěrky uvedené v části Registrace a výdej čísel

09:00 - start trasy A (65 km), Stříbrný rybník

09:15 - dětské závody, areál kempu Stříbrný rybník

11:00 - start trasy B (46 km), Stříbrný rybník

11:15 - vyhlášení dětských závodů

12:00 - start trasy C (20 km), Stříbrný rybník

14:00 - vyhlášení trasy C

14:30 - vyhlášení trasy A

15:00 - vyhlášení trasy B

15:20 - tombola

Classic: Podrobnosti doplníme.

Vypsané kategorie
Trasa A
Ženy i muži: Hobby 19–34 let, Master 35–44 a 45–54 let, Elite 19+.
Ženy Master 55+; muži Master 55–64 let a 65+.
Trasa B
Kadetky a kadeti 15–16 let; juniorky a junioři 17–18 let.
Ženy i muži: 19–34, 35–44 a 45–54 let.
Ženy 55+; muži 55–64 let a 65+.
Electro Woman a Electro Man od 16 let.
Classic
Ženy i muži: 15–44 a 45–54 let.
Ženy 55+; muži 55–64 let a 65+.
Gravel ženy i muži: 15–44 let a 45+.
Electro Woman a Electro Man od 16 let.
Trasa C
Mladší žákyně a žáci: 11–12 let, ročníky 2015–2016.
Starší žákyně a žáci: 13–14 let, ročníky 2013–2014.
Ženy 15+, muži 15+ a Electro Bike mix 15+.
Dětské závody
D1: holky a kluci do 4 let, ročníky 2023–2027, kolo i odrážedlo.
D2: holky a kluci 5–6 let, ročníky 2021–2022.
D3: holky a kluci 7–8 let, ročníky 2019–2020.
D4: holky a kluci 9–10 let, ročníky 2017–2018.

Vyhlášení
11:15 - Vyhlášení dětských závodů.
`;

const dmUrl = "https://www.iprimacup.cz/27-dm/";
const dmLinks = [
  "https://www.iprimacup.cz/",
  "https://sport-base.eu/competitions/pc-dolni-morava-27/register",
  "https://mapy.com/s/fubekufono",
  "https://goo.gl/maps/qawopgjL1a62",
  "https://www.dolnimorava.cz/parkovani-resort",
  "https://www.ubytovaninadolnimorave.eu/autokemp-dolni-morava/",
];
const dmText = `Dolní Morava 2027

[Home](https://www.iprimacup.cz/)Dolní Morava 2027

5. června 2027 Dolní Morava · areál U Slona
[Registrovat se](https://sport-base.eu/competitions/pc-dolni-morava-27/register)
Trasy závodu
Trasa A
Muži: délka 91 km, převýšení 3 000 m, start 07:00.
Ženy: délka 81 km, převýšení 2 500 m, start 07:15. Mapu ženské varianty doplníme.
Trasa B
Délka 59 km, převýšení 1 750 m, start 09:30.
Trasa C
Délka 15 km, převýšení 400 m, start 12:15.
Přednostní řazení na start mají mladší a starší žáci a žákyně.
Trasa Classic
Podrobnosti doplníme.
[Mapy tras A, B a C včetně občerstvovacích stanic](https://mapy.com/s/fubekufono)

Místo a zázemí
Kancelář závodu, registrace a vyhlášení: [parkoviště u Chaty U Slona – mapa](https://goo.gl/maps/qawopgjL1a62).
Parkování
Využijte pouze místa vyhrazená k parkování. [Aktuální informace o parkování v resortu](https://www.dolnimorava.cz/parkovani-resort).
Parkování týmového obytného vozu v prostoru areálu je možné pouze po domluvě na telefonu 608 345 120. Jde o týmové vozy se zázemím pro více členů týmu; parkování osobních vozidel a dodávek zde není možné.
Pro další možnosti parkování a pobytu můžete využít [autokemp V Zátiší](https://www.ubytovaninadolnimorave.eu/autokemp-dolni-morava/), telefon 602 456 310.

Startovné
Trasa / kategorie | Do 9. 5. | 10.–28. 5. | 29. 5.–3. 6. | Od 4. 6. / na místě
Trasa AHobby, Master a Elite | 1 000 Kč | 1 200 Kč | 1 300 Kč | 1 500 Kč
Trasa BDospělí 19+; Electro od 16 let | 900 Kč | 1 100 Kč | 1 200 Kč | 1 400 Kč
Trasa B – mládežKadeti a kadetky 15–16 let; junioři a juniorky 17–18 let | 400 Kč | 450 Kč | 500 Kč | 600 Kč
ClassicVšechny vypsané kategorie, včetně gravelů a elektrokol | 900 Kč | 1 100 Kč | 1 200 Kč | 1 400 Kč
Trasa CŽeny, muži a Electro Bike mix od 15 let | 700 Kč | 900 Kč | 1 000 Kč | 1 100 Kč
Trasa C – žáciMladší žáci a žákyně 11–12 let (2015–2016); starší 13–14 let (2013–2014) | 200 Kč | 250 Kč | 300 Kč | 400 Kč
Dětské závody D1–D4Děti do 10 let (2017–2027); D1 také odrážedla | 120 Kč | 120 Kč | 120 Kč | 150 Kč

Časový harmonogram
Pátek 4. června 2027
19:00–20:00 – výdej čísel a nové přihlášky
19:00 – informační schůze týmů k trase A
Sobota 5. června 2027
06:15–09:30 – výdej čísel a nové přihlášky; platí uzávěrka před startem příslušné trasy uvedená v části Registrace
07:00 – start trasy A, muži (91 km)
07:15 – start trasy A, ženy (81 km)
09:30 – start trasy B (59 km)
10:00 – dětské závody do 10 let, od nejstarších
11:30 – vyhlášení dětských závodů
11:40–11:45 – výdej čísel a nové přihlášky pro trasu C
12:15 – start trasy C (15 km)
14:45 – vyhlášení trasy C
15:45 – vyhlášení trasy B
16:00 – vyhlášení trasy A
16:15 – tombola
Trasa Classic: čas startu a vyhlášení doplníme.

Vypsané kategorie
Trasa A
Ženy i muži: Hobby 19–34 let, Master 35–44 a 45–54 let, Elite 19+.
Ženy Master 55+; muži Master 55–64 let a 65+.
Trasa B
Kadetky a kadeti 15–16 let; juniorky a junioři 17–18 let.
Ženy i muži: 19–34, 35–44 a 45–54 let.
Ženy 55+; muži 55–64 let a 65+.
Electro Woman a Electro Man od 16 let.
Trasa Classic
Ženy i muži: 15–44 a 45–54 let.
Ženy 55+; muži 55–64 let a 65+.
Gravel ženy i muži: 15–44 let a 45+.
Electro Woman a Electro Man od 16 let.
Trasa C
Mladší žákyně a žáci: 11–12 let, ročníky 2015–2016.
Starší žákyně a žáci: 13–14 let, ročníky 2013–2014.
Ženy 15+, muži 15+ a Electro Bike mix 15+.
Dětské závody
D1: holky a kluci do 4 let, ročníky 2023–2027, kolo i odrážedlo.
D2: holky a kluci 5–6 let, ročníky 2021–2022.
D3: holky a kluci 7–8 let, ročníky 2019–2020.
D4: holky a kluci 9–10 let, ročníky 2017–2018.

Vyhlášení
Vyhlášení probíhá v areálu U Slona.
`;

describe("iprimacup.cz round URLs", () => {
  it("matches round detail pages and rejects calendar/static pages", () => {
    expect(isPrimaCupRoundUrl("https://www.iprimacup.cz/26-hk/")).toBe(true);
    expect(isPrimaCupRoundUrl("https://www.iprimacup.cz/27-hk/")).toBe(true);
    expect(isPrimaCupRoundUrl("https://www.iprimacup.cz/28-va/")).toBe(true);
    expect(isPrimaCupRoundUrl("http://iprimacup.cz/27-gs")).toBe(true);
    expect(isPrimaCupRoundUrl("https://www.iprimacup.cz/zavody-2027/")).toBe(false);
    expect(isPrimaCupRoundUrl("https://www.iprimacup.cz/o-serialu/pravidla/")).toBe(false);
    expect(isPrimaCupRoundUrl("https://example.com/27-hk/")).toBe(false);
  });
});

describe("primaCupFacts + verifyPracticalExtraction", () => {
  it("extracts and verifies all practical fields on 27-hk with zero rejections", () => {
    const raw = primaCupFacts(
      { url: hkUrl, text: hkText, links: hkLinks },
      { startDate: "2027-04-10", municipality: "Hradec Králové" },
    );
    const feeRows = (raw.facts.fees as { value: { label: string; amount: number; validUntil?: string }[] }).value;
    expect(feeRows.slice(0, 4).map(r => [r.label, r.amount, r.validUntil])).toEqual([
      ["Trasa A (Do 15. 3.)", 1000, "2027-03-15"],
      ["Trasa A (16. 3.–2. 4.)", 1200, "2027-04-02"],
      ["Trasa A (3.–8. 4.)", 1300, "2027-04-08"],
      ["Trasa A (Od 9. 4. / na místě)", 1500, undefined],
    ]);

    const checked = verifyPracticalExtraction(raw, {
      name: "Prima CUP — Hradec Králové",
      startDate: "2027-04-10",
      municipality: "Hradec Králové",
      ownUrls: [hkUrl],
      documents: [{ url: hkUrl, text: hkText, links: hkLinks }],
    });

    expect(checked.reasons).toEqual({});
    expect(checked.rejected).toEqual([]);
    expect(checked.details.venue?.value).toMatchObject({
      name: "Rekreační areál Stříbrný rybník",
      precision: "start",
      locality: "Hradec Králové",
    });
    expect(checked.details.parking?.value).toEqual({ note: "Parkoviště Stříbrný rybník" });
    expect(checked.details.routes?.value).toHaveLength(3);
    expect(checked.details.routes?.value[0]).toMatchObject({
      name: "Trasa A",
      distanceKm: 65,
      elevationM: 430,
      mapUrl: "https://mapy.cz/s/homehezaho",
    });
    expect(checked.details.fees?.value).toHaveLength(28);
    expect(checked.details.schedule?.value).toHaveLength(10);
    expect(checked.details.schedule?.value[0]).toMatchObject({
      date: "2027-04-10",
      time: "07:00",
      endTime: "12:00",
      label: "registrace a výdej čísel",
    });
    expect(checked.details.schedule?.value[1]).toMatchObject({
      date: "2027-04-10",
      time: "09:00",
      label: "start trasy A (65 km), Stříbrný rybník",
    });
    expect(checked.details.categories?.value).toHaveLength(15);
    expect(checked.details.categories?.value).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ birthYears: "2015–2016" }),
        expect.objectContaining({ birthYears: "2013–2014" }),
        expect.objectContaining({ birthYears: "2023–2027" }),
        expect.objectContaining({ birthYears: "2017–2018" }),
      ]),
    );
  });

  it("extracts and verifies 27-dm including male/female Trasa A split and shared map link", () => {
    const raw = primaCupFacts(
      { url: dmUrl, text: dmText, links: dmLinks },
      { startDate: "2027-06-05", municipality: "Dolní Morava" },
    );
    const checked = verifyPracticalExtraction(raw, {
      name: "Prima CUP — Dolní Morava",
      startDate: "2027-06-05",
      municipality: "Dolní Morava",
      ownUrls: [dmUrl],
      documents: [{ url: dmUrl, text: dmText, links: dmLinks }],
    });

    expect(checked.reasons).toEqual({});
    expect(checked.rejected).toEqual([]);
    expect(checked.details.venue?.value).toMatchObject({
      name: "areál U Slona",
      precision: "venue",
      locality: "Dolní Morava",
    });
    expect(checked.details.parking?.value.note).toContain("Parkování týmového obytného vozu");
    expect(checked.details.routes?.value).toHaveLength(4);
    expect(checked.details.routes?.value[0]).toMatchObject({
      name: "Trasa A – Muži",
      distanceKm: 91,
      elevationM: 3000,
      mapUrl: "https://mapy.com/s/fubekufono",
    });
    expect(checked.details.routes?.value[1]).toMatchObject({
      name: "Trasa A – Ženy",
      distanceKm: 81,
      elevationM: 2500,
    });
    expect(checked.details.routes?.value[1]?.mapUrl).toBeUndefined();
    expect(checked.details.fees?.value).toHaveLength(28);
    expect(checked.details.schedule?.value).toHaveLength(12);
    expect(checked.details.categories?.value).toHaveLength(15);
  });

  it("handles exhibition lap routes, Úterý timetable, and placeholder rounds cleanly", () => {
    const gsUrl = "https://www.iprimacup.cz/27-gs/";
    const gsText = `Gočárovy schody 2027
28. září 2027 Hradec Králové · historické centrum
Trasy závodu
Trasa A – Elite
14 kol + 1 zaváděcí (14,5 km) · start 15:30.
Místo a zázemí
Závod se koná v historickém centru Hradce Králové. Start závodů Hobby a Expert je v ulici ČSA.
Parkování
Prosíme, neparkujte na Velkém náměstí. Využijte [parkoviště u Všesportovního stadionu](https://www.google.com/maps?ll=50.207221,15.843389) nebo povolená parkovací místa v okolních ulicích.
Startovné
Trasa / kategorie | Do 5. 9. | 6.–23. 9. | Od 24. 9. / na místě
Trasy A, B a CElite, Expert 19+ a Hobby 15+ | 400 Kč | 500 Kč | 600 Kč
Časový harmonogram
Úterý 28. září 2027
15:30–16:00 – Elite (A), 14 kol + 1 zaváděcí.
Vypsané kategorie
Trasa A – Elite
Ženy a muži od 19 let (2008 a starší).`;
    const gsRaw = primaCupFacts(
      { url: gsUrl, text: gsText, links: [] },
      { startDate: "2027-09-28", municipality: "Hradec Králové" },
    );
    const gsChecked = verifyPracticalExtraction(gsRaw, {
      name: "Gočárovy schody",
      startDate: "2027-09-28",
      municipality: "Hradec Králové",
      ownUrls: [gsUrl],
      documents: [{ url: gsUrl, text: gsText, links: [] }],
    });
    expect(gsChecked.reasons).toEqual({});
    expect(gsChecked.details.routes?.value).toEqual([
      expect.objectContaining({ name: "Trasa A – Elite", distanceKm: 14.5 }),
    ]);
    expect(gsChecked.details.fees?.value.map(f => f.label)).toEqual([
      "Trasy A, B a C (Do 5. 9.)",
      "Trasy A, B a C (6.–23. 9.)",
      "Trasy A, B a C (Od 24. 9. / na místě)",
    ]);
    expect(gsChecked.details.schedule?.value).toEqual([
      expect.objectContaining({ date: "2027-09-28", time: "15:30", endTime: "16:00" }),
    ]);
    expect(gsChecked.details.categories?.value).toEqual([
      expect.objectContaining({ birthYears: "2008 a starší" }),
    ]);
  });
});
