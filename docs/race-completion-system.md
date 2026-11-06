# Systém doplňování závodů: návrh pro tisíce závodů

Stav k 6. 11. 2026: návrh. Hotové jsou jen první kousky, viz „Kde jsme“. Zásada: náklady a práce rostou s počtem webů, ne s počtem závodů. Oprava jednoho závodu nebo série není výsledek, výsledek je pravidlo, které takovou chybu odstraní všude.

## Co se měří
Hlavní číslo je **odkaz na propozice tohoto ročníku**. Propozice jsou zdroj skoro všeho ostatního, proto se počítají první a zvlášť. Každý závod je v jednom ze stavů:

- **přečtené:** dokument je nalezený, ověřený a vytěžený,
- **pořadatel zatím nevydal:** web je známý a ověřený, dokument tam není, závod se vrací podle blízkosti,
- **nenašli jsme:** není známý web nebo dokument, tady je naše práce.

Bez tohoto rozlišení se „chybí“ plete s „neexistuje“. U položky, kterou přečtené propozice vůbec neuvádějí, se to počítá jako „pořadatel neuvádí“, ne jako naše mezera.

Karta závodu: odkaz na propozice, organizační pokyny, pravidla série, kategorie s ročníky, pořadatel a kontakt, startovné, tratě, harmonogram, parkování, registrace, výsledky.

Co rodič a jezdec potřebují navíc a na kartu to patří taky: uzávěrka přihlášek a jestli jde přihlásit na místě, kdy a kde je prezentace a kdy končí, kdo smí startovat (licence, příchozí), délka a čas startu pro danou kategorii, ne jen obecný program, a adresa nebo GPS místa startu. Pokrytí počítá `scripts/race-completeness-report.cjs`.

Výchozí stav ze serveru, závody v příštích 60 dnech:

| Položka | Vše (340) | CZ + SK (44) |
| --- | --- | --- |
| Odkaz na propozice | 103 | 12 |
| Kategorie z propozic | 0 | 0 |
| Pořadatel | 14 | 4 |
| Kontakt | 0 | 0 |
| Startovné | 11 | 1 |
| Tratě | 5 | 1 |
| Harmonogram | 11 | 3 |
| Parkování | 0 | 0 |
| Registrace | 110 | 15 |
| Výsledky, aspoň server | 18 | 5 |

## Z čeho návrh vychází
Na 1 495 budoucích závodů připadá 732 webů. Jen 14 z nich má aspoň 20 závodů a deset největších se dotýká 1 285 závodů. Jsou to ale hlavně kalendáře: řeknou, že závod existuje, a nanejvýš vedou k pořadateli. Propozice leží v dlouhém ocasu klubových webů. Proto dvě různé cesty.

## Jak se chybám předchází
Každá nalezená chyba končí pravidlem a testem, ne opravou záznamu:
- Závod se opravuje jednorázově jen výjimečně a jako nouzové řešení. Hlavní výstup je pravidlo, které chybu odstraní u všech závodů.
- Ručně ověřená sada běží při každé změně čtečky a změna nesmí přidat chyby.
- Každý údaj prochází automatickými kontrolami: důkaz v dokumentu, identita závodu, smysluplnost hodnoty.
- Běh hlásí pokrytí karet a důvody odmítnutí, takže propad je vidět dřív, než ho najde člověk.

Výběr hotových knihoven je zadán v [průzkumu](../reports/pdf-extraction-2026-11-05/morning-2026-11-06/LIBRARY-RESEARCH-PROMPT.md).

## Co ukázalo ruční čtení a měření (6. 11.)
Závody v příštích 70 dnech bez propozic, 197: u 115 neznáme vlastní web, u 29 web PDF nezveřejňuje, u 18 žádné PDF nevypadá jako propozice, u 32 patří PDF jinému závodu nebo ročníku, 3 přijaté. **Největší díra je nalezení webu pořadatele.**

Postupy podle výtěžnosti:
- Stránky závodů na webu série a soubory v kalendáři disciplíny (cyklokros.cz, slovenský svaz): vysoká přesnost, ale jen pro pár webů. Celý katalog: 14 změn.
- Seznam PDF přes WordPress a odkazy v kódu stránky: u 110 z 222 webů vrátil dokumenty, přijato 7 ze 422 závodů, hlavně protože propozice 2027 ještě nejsou.
- Brave `site:… filetype:pdf`: funguje, index ale chybí a zpožďuje se.
- Vzor adresy z jednoho dokumentu (`race-guide-<město>-2026.pdf`): 3 ze 3 v rámci série.
- Portál českého svazu a `data.ceskysvazcyklistiky.cz`: slepá ulička, starý server nefunguje a detail závodu propozice neměl.

Systémové chyby nalezené čtením a opravené pravidlem: „Statut závodu“ čtený jako stanovy, „ročník 2011“ čtený jako ročník závodu, stránka jiného roku přijatá kvůli postrannímu panelu.

Co se ještě nedá vyjádřit: délka okruhu u cyklokrosu, kontakt bez uvedeného pořadatele, startovné „dle pravidel série“, které má dědit kolo ze série. Poslední uvádějí TBC, Janev i slovenský pohár, takže jde o další systémovou úlohu.

## Pět částí
1. **Fronta podle chybějících položek.** Závod se vrací podle toho, co mu chybí a jak blízko je. Hotovo: pořadí a intervaly v `race-completeness.ts`.
2. **Naučené postupy po webech.** Pro každý web se uloží postup bez kódu: jak z kalendáře nebo série najít stránku závodu, kde leží propozice a pod jakými nadpisy jsou údaje. AI ho navrhne jednou z několika ukázek. Systém ho ověří na stránkách, a pokud uspěje, další čtení jsou zdarma. Když úspěšnost spadne, postup se pozastaví a web se naučí znovu. Přidání webu tak znamená jednu cenu, ne cenu za každý závod.
3. **Paměť pořadatele.** Web, vzor adres propozic a kontakt patří pořadateli, ne jednomu ročníku. Co se jednou najde, platí pro všechny jeho závody a příští ročníky. Datum z toho nikdy nevzniká, platí [pravidla ročníků](annual-editions.md).
4. **Slučování po polích.** Každé pole má pořadí zdrojů: propozice pořadatele, web pořadatele, série, svaz, časomíra, kalendář. Slabší zdroj silnější hodnotu nepřepíše a rozpor stejně silných zdrojů se zaznamená, nepřepisuje se. U odkazu na web hotové, zbytek ne.
5. **Kvalita bez ruční kontroly.** Každý údaj má doslovný důkaz. Běží kontrola rozsahů, například startovné nebo čas mimo obvyklé hodnoty. Náhodný vzorek ověřuje druhý model. Zdroj s vysokou chybovostí automaticky ztrácí důvěru. Ručně ověřená sada je test pro změny čtečky, ne způsob provozu.

## Náklady na 5 000 závodů
- **Hledání:** dva dotazy na závod ročně je 10 000 dotazů. To se vejde do bezplatného kreditu Brave, který je 1 000 dotazů měsíčně, tedy 12 000 ročně.
- **AI:** cena za závod zatím není změřená. Rozhodující je podíl závodů vyřízených bez AI přes naučené postupy a čtení podle nadpisů. Limit 5 USD měsíčně se bez souhlasu vlastníka nezvyšuje.
- **Čtení webů:** běží na Macu, rozestupy po webech zůstávají. Propustnost pro 5 000 závodů je potřeba změřit.

## Pořadí stavby
Po každém kroku se změří pokrytí a chyby. Krok bez přínosu se zahodí.
1. Čtení podle nadpisů bez AI (Startovné, Harmonogram, Kategorie, Parkování, Pořadatel, Výsledky) pro všechny weby.
2. Naučené postupy: nejdřív 14 největších webů, jak vedou ke stránce pořadatele a závodu.
3. Paměť pořadatele.
4. Pořadí zdrojů pro datum, místo a registraci, pak srovnání duplicit se Splinkem.
5. Automatický dohled nad kvalitou a pokrytí v panelu na Macu.

Dotažení dlouhého ocasu pak dělá hlavně krok 1 a hledání. Co ani tak nepůjde: závody, jejichž pořadatel propozice ještě nevydal, nebo weby, které ověřují návštěvníky.

## Kde jsme
Hotové: opravené odkazy na web, zapnutý Brave s limitem, hledání se dvěma dotazy a kontrolou totožnosti, nové položky karty a jejich zobrazení, měření pokrytí. Výzkum knihoven je [zde](../reports/pdf-extraction-2026-11-05/morning-2026-11-06/RESEARCH.md). Jednorázové skripty v `reports/pdf-extraction-2026-11-05/tbc-links/` byly nouzové řešení pro zítřejší závod.

## What reading the regulations by hand taught the reader (2026-11-06)

All documents linked from races in the next 60 days were read in a session; what they showed is now in the system:

- **rad-net.de** gives every published German race on one template (`src/lib/catalog/radnet.ts`, `scripts/harvest-radnet.ts`, daily in the Mac cycle): organiser, contact, class, fee, start time, lap. No AI. Its later calendar pages also list next year's provisional dates ("Vorläufiger Termin"), which are not imported yet.
- Regulations can come as a **zip**, and timetables as a **picture inside a PDF**; both are opened now.
- Times may read `6,45` or `10 Uhr`; a time may be a range; free entry is a fee of 0.
- A row of a table answers to the table's heading however far above it stands. A lap of up to 8 km is a route if it is called a lap.
- A club's statutes are not regulations.
- **One list, one document.** Each new reading of a document replaces its last one, and timetables, fees and categories from two documents are never mixed; the fullest stands.
- Belgium is not a listed country, so its races have no public page, whatever they hold.
