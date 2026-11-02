# Stránky závodů: co na ně přidat a jak pustit lidi k úpravám

Research k bodu High z SEO auditu (2. 11. 2026). Čísla jsou z produkční databáze a kódu ke stejnému dni.

## Shrnutí

1. **Problém není jen „málo slov“, ale málo věcí, které jsou jen na téhle stránce.** Stránka závodu dnes ukazuje kartu faktů (kdo, formát, úroveň, seriál, odkazy) a vygenerovaný odstavec. Totéž, jen jinými slovy, je na 1 769 stránkách × 5 jazyků.
2. **Nejrychlejší zisk je v datech, která už máme a nezobrazujeme:** trasy a délky (`event_categories`, 20 % závodů), závody v okolí (95 % budoucích závodů má jiný závod do 50 km, průměrně 11), minulý ročník, odkud informace pochází (`event_facts` s citací zdroje, 58 % závodů).
3. **81 % budoucích závodů nemá seriál, a tak jejich stránka nemá žádné odkazy na jiné závody.** Komentář v kódu slibuje „závody ve stejný víkend v okolí“, ale stránka je neukazuje.
4. **Pro příspěvky od lidí máme půlku základů hotovou:** `event_facts` už ukládá každé tvrzení se zdrojem a citací, `event_overrides` umí zamknout pole proti automatice, `race_submissions` přijímá návrhy. Chybí role, schvalování a historie.
5. **Začít u pořadatelů, ne u davu.** Při pěti účtech se komunitní opravy nerozjedou; pořadatel má důvod svůj závod vyplnit a sám ho rozšíří. Model „převzít závod/seriál“ používají FindARace, MarathonGuide nebo Endure Strong.

---

## 1. Co stránka závodu ukazuje dnes

| Blok | Odkud | Poznámka |
|---|---|---|
| Název, datum, místo, disciplína, seriál | `events`, `locations` | Nadpis teď bez „křičení“. |
| Pro koho (věkové kategorie) | `age_categories` + `age_confidence` | Rozlišuje potvrzené / „jako loni“ / odhad. |
| Formát, úroveň, UCI třída | `formats`, `level`, `uci_class` | UCI jen u 1,7 %. |
| Odkazy: přihláška, web, propozice, výsledky | `*_url` | Výsledky jen 0,2 %. |
| Důvěra a „naposledy ověřeno“ | `last_seen_at` | |
| „O závodu“ | `description` (0,7 % závodů) nebo `raceSummary` | U 99 % je to věta poskládaná z polí. |
| Mapa | `locations.lat/lng` | |
| Další kola seriálu | `series` | Jen u ~19 % budoucích závodů. |
| Odkaz na hub (země × disciplína) | `listQualifyingHubs` | |

Strukturovaná data: `SportsEvent` + `BreadcrumbList`, bez pořadatele, ceny a adresy místa.

## 2. Jaká data máme a jak jsou plná

Veřejné závody celkem 6 362, z toho 1 355 budoucích (sitemap: 1 769 včetně nedávno proběhlých).

| Údaj | Pokrytí | Zobrazujeme? |
|---|---|---|
| Web pořadatele | 81,9 % | ano |
| Věkové kategorie (jakékoli / potvrzené) | 78,1 % / 50,3 % | ano |
| `event_facts` (tvrzení se zdrojem, citací, metodou) | 58,2 % | **ne** |
| Odkaz na přihlášku | 46,5 % | ano |
| Seriál | 25,4 % | ano |
| **Kategorie/trasy (`event_categories`)** | 20,7 % | **ne** (rozpracováno ve stashi „Kategorie podle pořadatele“, odloženo 10. 10.) |
| Délka trasy v km | 19,2 % | **ne** |
| Propozice | 19,2 % | ano |
| Vícedenní závod | 13,2 % | ano |
| Otevření / uzávěrka přihlášek | 4,6 % / 5,7 % | uzávěrka jen ve strukturovaných datech |
| UCI třída | 1,7 % | ano |
| Region (kraj/Land) | 1,2 % | ne |
| Popis od pořadatele | 0,7 % | ano |
| Areál (venue) | 0,4 % | ne |
| Výsledky | 0,2 % | ano |
| Převýšení | 0,1 % | ne |

Další zdroje, ze kterých jde stavět:

- **Zdroje záznamů:** agregátory 5 567, seriály 2 932, národní svazy 2 883, oficiální weby 445. Většina dat je z druhé ruky; vlastní web pořadatele je přímý zdroj jen u menšiny.
- **Ruční zámky:** 282 závodů má v `event_overrides` uzamčená pole. To je hotový mechanismus „člověk má přednost před automatikou“.
- **Seriály:** 400 veřejných, 226 s popisem, 319 s webem. Seriálové stránky jsou na tom s obsahem lépe než závody.
- **Minulé ročníky:** přesná shoda názvu s loňským ročníkem jen u 207 budoucích závodů. Spojení ročníků je dnes slabé (pravidlo v AGENTS.md o ročnících s tím počítá, ale v datech chybí explicitní vazba „toto je další ročník téhož“).
- **Uživatelé:** 5 profilů, 13 uložených závodů, 22 účastí, 3 hlídací alerty, 7 jezdců v rodinách, 1 návrh závodu. Admin je jedno sdílené heslo (`ADMIN_PASSWORD`), tabulka `admin_users` je prázdná.

## 3. Co přidat na stránku závodu

Seřazeno podle poměru užitek/práce. Každý bod by měl být užitečný pro jezdce nebo rodiče i bez SEO; když není, Google to pozná taky.

### A. Z dat, která už máme (bez nového sběru)

| # | Blok | Pokrytí | Proč |
|---|---|---|---|
| A1 | **Závody v okolí** – stejný víkend do ~75 km, pak „další v okolí“ do 50 km | 95 % (jiný závod do 50 km), 39 % (stejný víkend do 75 km) | Odpovídá na otázku „co dalšího se dá jet“. Dává každé stránce jedinečnou sadu odkazů a propojuje 81 % závodů, které dnes nemají žádný. Jednoduchý dotaz nad `locations.geog`. |
| A2 | **Trasy a kategorie** – tabulka: název, délka, věk, pohlaví | 20 % (délky 19 %) | Pro jezdce nejdůležitější informace po datu. Stash z 10. 10. už je rozdělaný. Jen u závodů, kde data jsou; jinde blok chybí, žádné „neznámo“. |
| A3 | **Minulý a příští ročník** – odkaz a změny („loni 14. 6., letos 13. 6.“, „nově trasa 120 km“) | dnes 207 jistých párů; s vazbou přes seriál+místo víc | Jedinečný obsah, důvod vrátit se. Potřebuje explicitní vazbu ročníků (viz C1). |
| A4 | **Odkud to víme** – u data, místa, kategorií, přihlášky zdroj a datum ověření, rozbalitelně krátká citace | 58 % | Důvěra (E-E-A-T), odlišení od agregátorů, které opisujeme. Citace jen krátké a s odkazem. |
| A5 | **Časová osa přihlášek** – otevírá / uzávěrka / zbývá N dní | 5–6 % | Malé pokrytí, ale vysoká hodnota; roste s pořadateli (D). |
| A6 | **Kontext seriálu i bez dalších kol** – „N. kolo z M“, bodování, odkaz | 25 % | U seriálových závodů už půlka je; doplnit pořadí kola. |
| A7 | **Kontext regionu** – „X závodů v [kraji] tuto sezónu“, odkaz na hub regionu | region jen 1,2 % → doplnit reverzním geokódováním | Region je potřeba i pro budoucí regionální huby. |

### B. Spočítané z veřejných dat (unikátní pro každou stránku, bez psaní textu)

| # | Blok | Zdroj | Poznámka |
|---|---|---|---|
| B1 | **Jak se tam dostat** – nejbližší vlakové nádraží, vzdálenost z nejbližšího velkého města | OpenStreetMap (Overpass), vlastní výpočet | Pro rodiče s dětmi velmi praktické. Počítat jednou, uložit. |
| B2 | **Typické počasí v ten termín** – průměrná teplota a srážky za posledních 10 let | Open-Meteo historical API | Užitečné pro cyklokros a začátek sezóny; žádná předpověď, jen klima. |
| B3 | **Převýšení a profil trasy** | GPX od pořadatele, jinak výškový model podél trasy | Jen kde je GPX; dnes 0,1 %. Až s pořadateli. |
| B4 | **Kalendář okolo** – „ve stejný den jinde v [zemi]“ | vlastní data | Doplněk A1 pro ty, kdo jsou ochotní cestovat. |

### C. Úpravy dat a automatiky

- **C1 Vazba ročníků.** Přidat `edition_of` / „identita závodu“ (stejný závod napříč roky), plněnou z AGENTS.md pravidel. Bez ní nejde A3, „převzetí závodu“ pořadatelem přes roky ani historie.
- **C2 Region a areál.** Doplnit `locations.region` a `venue` (dnes 1 % / 0,4 %) – potřebné pro A7, adresu ve strukturovaných datech i regionální stránky.
- **C3 Pořadatel jako entita.** Tabulka `organizers` (název, web, kontakt). Plní se z webu závodu a hlavně z převzetí (D). Pak jde do `SportsEvent.organizer`, který Google doporučuje.

### D. Od lidí (kapitola 4)

Fotky, popis trati, parkování, tipy pro rodiče, opravy chyb, nové závody a seriály.

### Co nedělat

- **Nepsat výplňový text** (AI odstavce „Závod X je skvělá příležitost…“). Google v zásadách o scaled content abuse výslovně míří na mnoho stránek generovaných hlavně kvůli pozicím, včetně přeformulovaného nebo přeloženého obsahu z feedů.
- **Neopisovat celé texty od pořadatelů nebo agregátorů.** Krátká citace se zdrojem ano, celé propozice ne.
- **Nevymýšlet fakta** (cena, dostupnost míst, pořadatel), dokud nejsou ověřená. Současný kód to dělá správně.

### Rozhodnutí na zvážení: kolik jazykových verzí indexovat

Každý závod existuje v 5 jazycích se stejnými daty. Pro Google je to 5× tenká stránka. Varianta: indexovat stránku závodu jen v jazyce země závodu + cs + en a ostatní jazyky nechat dostupné, ale s `noindex`. Sníží to počet stránek z 8 845 na ~5 300 bez ztráty pro uživatele. Proti: méně vstupních bodů pro polské/slovenské/německé hledání. Doporučuji rozhodnout až podle dat z Search Console za 4–6 týdnů po rozdělení sitemap.

## 4. Příspěvky od lidí: oprávnění a workflow

### Co dělají ostatní

- **Adresáře závodů (FindARace, MarathonGuide, Endure Strong, RaceLookup):** pořadatel si založí účet, vyhledá svůj závod a „převezme“ ho; pak ho edituje sám. Ověření bývá ruční nebo přes doménu/e-mail; ověřené závody dostávají odznak. Motivace je zviditelnění, ne komunita.
- **OpenStreetMap:** kdokoli edituje a změna je hned vidět; kvalitu drží zpětná kontrola, hlášení a vracení změn. Funguje díky velké komunitě, kterou my nemáme.
- **Wikipedie (pending changes):** schvalování předem u rizikových stránek; zkušenost je, že fronty ke schválení rostou a recenzenti nestíhají.

Poučení: **schvalování předem jen tam, kde je chyba drahá, a jen dokud je fronta malá.** Jinak důvěra podle role a historie.

### Návrh rolí

| Role | Jak ji získá | Co může |
|---|---|---|
| Návštěvník | – | Nahlásit chybu (formulář u pole: „datum je špatně“ + odkaz). Jde do fronty. |
| Přihlášený jezdec | Google účet | Navrhnout úpravu kteréhokoli pole, navrhnout nový závod. Vše jde do fronty. Přidat tip/fotku (moderováno). |
| Důvěryhodný přispěvatel | automaticky po N schválených návrzích bez zamítnutí, nebo ručně | Úpravy nízkorizikových polí jdou rovnou ven; vysokorizikové dál do fronty. |
| Pořadatel závodu / seriálu | převzetí + ověření (níže) | Svůj závod / seriál upravuje přímo; zakládá nová kola a ročníky; úpravy jsou označené „od pořadatele“ a zamknou pole proti automatice. |
| Admin | dnes sdílené heslo → přesunout na roli v `profiles` | Vše, schvalování fronty, slučování duplicit, odebrání rolí. |

**Ověření pořadatele**, od nejjednoduššího:
1. E-mail na doméně webu závodu (`info@mujzavod.cz` pro `mujzavod.cz`) – automaticky.
2. Kód vložený na web závodu nebo do propozic – automaticky při dalším stažení stránky (watcher ho najde).
3. Ruční ověření adminem (telefon, e-mail z propozic).

Převzetí se váže na **identitu závodu napříč ročníky** (C1) nebo na seriál, aby pořadatel nemusel žádat každý rok znovu.

### Rizikovost polí

| Riziko | Pole | Kdo smí rovnou |
|---|---|---|
| Nízké | odkazy (web, výsledky), popis trati, parkování, tipy, fotky | důvěryhodný přispěvatel, pořadatel |
| Střední | kategorie, trasy, délky, otevření/uzávěrka přihlášek, seriál | pořadatel |
| Vysoké | datum, místo, název, zrušení/přesunutí, sloučení duplicit, smazání | pořadatel (s logem), jinak vždy fronta |

### Jak to sedí na současnou databázi

- **Každá úprava = nový `event_facts` záznam** s `method = 'user' | 'organizer'`, `user_id`, `status = 'pending' | 'active' | 'rejected'`. Tabulka už má `previous`, `quote`, `source_url`, `version` – tím je zadarmo historie i vrácení změny.
- **Pořadí přednosti pro každé pole:** zámek pořadatele/admina (`event_overrides.locked_fields`) > schválený lidský fakt > automatika. Watcher dál navrhuje, ale zamčené pole nepřepíše; nesoulad se zdrojem by měl jen poslat do fronty („zdroj říká něco jiného“). Zámky už dnes automatiku blokují; to hlášení nesouladu je potřeba ověřit nebo doplnit.
- **Nový závod od uživatele** vzniká skrytý (dnes existuje `visibility = 'hidden'`, případně nový stav „ke kontrole“); od pořadatele rovnou `public`. Před uložením povinná kontrola duplicit (stejný den ±1, do 20 km, podobný název) – stávající `duplicate_reviews`.
- **Nový seriál:** pořadatel založí seriál, přidá kola (výběrem existujících závodů nebo novými). Kola se navazují přes `event_series`.
- **Nový ročník:** tlačítko „přidat ročník 2027“ u převzatého závodu, které použije pravidla z AGENTS.md (přenese stabilní fakta, ne data/ceny/výsledky).
- **RLS:** zápisy jen přes server (API route s kontrolou role), ne přímo z prohlížeče. Stejně jako dnes `race_submissions`.

### Ochrana a právní minimum

- Limit návrhů na účet/den, zablokování účtu, hromadné vrácení změn uživatele.
- Fotky a texty: v podmínkách licence k příspěvku (např. CC BY nebo výslovné svolení k zobrazení), moderování před zveřejněním.
- Jako hostitel obsahu od uživatelů spadá web pod evropský Digital Services Act: mechanismus pro nahlášení nezákonného obsahu a zdůvodnění při odstranění. Pro malou službu stačí jednoduchý formulář a e-mail, ale je dobré to mít od začátku.
- GDPR: u příspěvků ukládat jen uživatele a čas; jméno přispěvatele veřejně jen s jeho souhlasem.

## 5. Návrh pořadí

| Fáze | Obsah | Co měřit |
|---|---|---|
| 1 (1–2 týdny) | A1 závody v okolí, A2 trasy a kategorie (dokončit stash), A4 „odkud to víme“, A6 pořadí kola | indexace závodů v Search Console (sitemapy races-cs/en), proklik mezi závody |
| 2 (2–4 týdny) | C1 vazba ročníků → A3, C2 region a areál → A7, B1 jak se tam dostat, B2 typické počasí | podíl „Crawled – not indexed“ u závodů |
| 3 (1–2 měsíce) | Hlášení chyb pro všechny, návrhy úprav pro přihlášené, fronta v adminu, role admina v DB | počet a kvalita návrhů, doba vyřízení |
| 4 | Převzetí závodu/seriálu pořadatelem, ověření, přímé úpravy, nové ročníky, C3 pořadatel do strukturovaných dat | převzaté závody, podíl závodů s přihláškou/trasami |
| 5 | Důvěryhodní přispěvatelé, fotky a tipy | – |

## 6. Otázky k rozhodnutí

1. Chceš, aby si pořadatel mohl závod převzít hned od fáze 3, nebo nejdřív vyzkoušet hlášení chyb od jezdců?
2. Fotky od lidí ano/ne? (moderace a licence jsou největší práce)
3. Indexovat stránky závodů ve všech 5 jazycích, nebo jen jazyk země + cs + en?
4. Má mít pořadatel po převzetí i něco navíc (odznak „ověřeno pořadatelem“, statistiky zobrazení), aby měl důvod se přihlásit?

## 7. Rozhodnutí (2. 11. 2026)

| Bod | Rozhodnutí |
|---|---|
| A1 závody v okolí | Ano, **přednostně stejná disciplína a podobné kategorie** (děti/mládež/dospělí). |
| B1 jak se tam dostat | **Jen autem**: vzdálenost a doba jízdy z velkých měst, parkování. Vlak ne. |
| B2 počasí | **Daleko: historie (klima termínu). Blízko: i předpověď.** Také v malém detailu závodu na mapě; může se donačítat v prohlížeči. |
| 6.1 převzetí pořadatelem | **Hned**, ne až po hlášení od jezdců. |
| 6.2 fotky | Zatím ne. |
| 6.3 jazykové verze | Otevřené (počkat na data ze Search Console). |
| 6.4 odznak „ověřeno pořadatelem“ | Ano. |

**Hotovo 2. 11. (zatím necommitnuto):**
- **A1** – sekce „Podobné závody v okolí“ (do 75 km, max. 6): nejdřív stejná rodina disciplín a stejné věkové skupiny, pak stejná disciplína; jiné disciplíny jen když podobných je méně než 3. Ukazuje i u proběhlých závodů (odkazuje na nadcházející). S vzdáleností v km.
- **B2** – řádek „Počasí“ na stránce závodu i v malém detailu na mapě, donačítá se v prohlížeči přes `/api/weather` (Open-Meteo, cache: předpověď 3 h, historie 30 dní). Do 14 dnů předpověď + „obvykle“, dál jen „obvykle“ (průměr ±3 dny za 10 let, déšť = podíl dnů se srážkami ≥ 1 mm).
- **B1** – malý detail na mapě už má tlačítko „Trasa“ (navigace Google Maps z místa, kde jezdec je). Vzdálenost a doba jízdy autem z měst potřebuje routovací službu (např. Mapy.cz API s klíčem) – otevřené.

## 8. Sumator.cz – hlavní český konkurent

Stav 2. 11. 2026, stránka závodu `sumator.cz/race/hurecky-krpal-7-11-2026`.

**Co mají dobře**
- Velká fotka nahoře (karusel), web působí „živě“.
- **Další ročníky** jako odkazy (2024, 2025) – mají vazbu ročníků, kterou my nemáme.
- **Kontakt na pořadatele** (telefon).
- **Komentáře** a **fotogalerie od lidí** („+ Přidat fotogalerii“), účast / přidat do kalendáře.
- **Dvě cesty k přidání závodu:** „Upozornit na závod“ (jen URL, bez přihlášení) a „Vytvořit nový závod“ (přihlášený pořadatel si závod sám spravuje). Přesně model „pořadatel hned“.
- Jednoduchý filtr disciplín (XC, DH, silnice, XCM, MTBO, 4X, cyklokros, akce), měsíční seznam.

**Kde jsou slabí (a kde je můžeme předběhnout)**
- **SEO skoro chybí:** `<title>` je jen název závodu, žádná strukturovaná data, žádný canonical, žádné jazykové verze; obsah stránky 84 slov. Popis „Sledujte aktuality závodu X“ je šablona.
- **Jen Česko a jen čeština.** My máme střední Evropu v 5 jazycích – pro jezdce z pohraničí a pro cestování za závody.
- **Žádné kategorie a věky** na stránce závodu. My je máme u 78 % (potvrzené u 50 %) – rodiče s dětmi jsou naše silná skupina.
- **Žádná mapa okolí, počasí, dojezd**, žádné „podobné závody v okolí“.
- **Data neznámého původu** – my můžeme ukazovat zdroj a datum ověření (A4).

**Co z toho převzít**
1. Vazba ročníků + „Další ročníky“ (náš C1/A3) – přesunout výš v pořadí.
2. Formulář „Upozornit na závod“ bez přihlášení vedle přihlášeného „Vytvořit/převzít závod“.
3. Kontakt na pořadatele (jen ten, který pořadatel sám zveřejnil, nebo zadal při převzetí).

**Čím být lepší:** kategorie a věky, závody v okolí podle disciplíny, počasí, dojezd autem, ověřené zdroje, odznak pořadatele, mezinárodní záběr – a to vše v podobě, kterou Google umí přečíst (strukturovaná data, jazykové verze).

## Zdroje

- [Sumator.cz](https://www.sumator.cz/) – stránka závodu a „Vložit závod“, prohlédnuto 2. 11. 2026

- Google: [Event structured data](https://developers.google.com/search/docs/appearance/structured-data/event) (povinné: `name`, `startDate`, `location` s adresou; doporučené: `organizer`, `offers`, `performer`, `previousStartDate` …)
- Google: [Spam policies – scaled content abuse](https://developers.google.com/search/docs/essentials/spam-policies)
- [John Mueller o ztrátě důvěry u programatických webů](https://www.techwyse.com/news/search-seo/google-john-mueller-programmatic-seo-site-trust-recovery) (sekundární zdroj)
- Převzetí závodu pořadatelem: [FindARace pro pořadatele](https://www.findarace.com/us/race-directors), [MarathonGuide – úprava údajů](https://www.marathonguide.com/racedirectors/updateinfo.cfm), [Endure Strong](https://www.cyclizing.com/blog/endure-strong-celebrates-new-race-directory-with-free-featured-listings/), [RaceLookup](https://docs.racelookup.com/race-director.html)
- OpenStreetMap: [moderační fronta](https://www.openstreetmap.org/user/mavl/diary/392348), [diskuse o důvěře a schvalování](https://lists.openstreetmap.org/pipermail/talk/2007-July/016318.html) (komunitní diskuse, ne oficiální pravidla)
