# LetsRace · zkouška Crawl4AI a Scrapling

4. listopadu 2026. Izolovaná zkouška 11 veřejných adres. Sada zahrnuje zdroje dříve označené jako nečitelné a kontroly přístupu, starého ročníku a propozic. Použity Crawl4AI 0.9.5 a Scrapling 0.5. Obě prohlížečové varianty používaly lokální Chrome. Výstupy HTML prošly stejným existujícím parserem LetsRace bez AI. U ČSC byl použit parser vykreslené tabulky. V Eventivu se kontrolovala veřejná stránka mapy. Zkouška neprovedla zápisy do katalogu ani placená volání. Časy jsou skutečné časy jednotlivých čtení bez instalace a bez navazujícího parsování. Počet kandidátů není počet nových závodů v katalogu.

| Zdroj | LetsRace HTTP | LetsRace Chrome | Crawl4AI Chrome | Scrapling HTTP | Scrapling Chrome |
| --- | ---: | ---: | ---: | ---: | ---: |
| [csc](https://portal.czechcyclingfederation.com/Races/Race/Pub) | 0 · 0.14 s | 423 · 14.17 s | 7 · 18.76 s | 0 · 0.19 s | 7 · 9.70 s |
| [400ultra](https://www.400ultra.cz/) | 0 · 1.67 s | 0 · 4.93 s | 0 · 3.80 s | 0 · 1.43 s | 0 · 4.85 s |
| [dzkol-map](https://dzkol.pl/wyscigi-dzkol/gpdb-memorial-grundmanna-i-wizowskiego/mapy-barycz-2026/) | 0 · 0.67 s | 0 · 4.67 s | 0 · 2.24 s | 0 · 0.46 s | 0 · 4.34 s |
| [zlmtb](https://zlmtb.com/aktualnosci/pzu-zachodnia-liga-mtb-wielen-06092026) | 0 · 0.44 s | 0 · 12.64 s | 0 · 1.86 s | 0 · 0.38 s | 0 · 2.45 s |
| [horni-halze](https://www.kolokolemkomina.cz/zavody/casovka-horni-halze) | 0 · 1.52 s | 0 · 4.45 s | 0 · 4.01 s | 0 · 0.97 s | 0 · 2.13 s |
| [bahenni-kral](http://bikeri.cz/serial/bahenni-kral) | 0 · 0.85 s | 0 · 4.51 s | 0 · 3.06 s | 0 · 0.81 s | 0 · 2.00 s |
| [junior-spac](https://spac-os.cz/junior-spac-2024/) | 0 · 0.08 s | — | 0 · 1.76 s | 0 · 0.07 s | 0 · 1.50 s |
| [rohalovska](https://www.vesani.cz/propozice/) | 0 · 0.48 s | — | 0 · 3.65 s | 0 · 0.28 s | 0 · 2.51 s |
| [jbc](https://www.jbc4xrevelations.com/) | 0 · 0.29 s | — | 0 · 1.81 s | 0 · 0.33 s | 0 · 2.55 s |
| [chotebuz](https://www.tjsokolchotebuz.cz/index.php?Itemid=36&id=17&option=com_content&view=article) | 1 · 0.86 s | — | 1 · 1.89 s | chyba TLS | 1 · 1.78 s |
| [eventiv](https://eventivsport.com/map) | 0 · 0.26 s | — | 0 · 1.83 s | 0 · 0.20 s | 0 · 1.82 s |

## Co rozhodlo

- ČSC bez ovládání kalendáře vrátil u obou knihoven 25 řádků a z nich 7 cyklistických kandidátů. Stávající čtečka získala 423 kandidátů za 14,17 s. Po obsloužení existující volby velikosti stránky oba nástroje získaly 479 řádků tabulky a **stejných 423 kandidátů** podle názvu, dat, místa, disciplíny a zdrojové adresy. Crawl4AI 9,27 s a 16,47 s při opakování. Scrapling 10,77 s a 10,95 s při opakování. Malý počet běhů a proměnlivý server nedokládají trvalé zrychlení.
- Na dalších adresách společný parser nezískal žádné nové kandidáty oproti LetsRace. Rohálovská 50ka poskytla stejná dvě pole (pořadatele a hlavní start ve 12:30). Zkouška Markdownu Crawl4AI na stejném HTML zachovala pořadatele, čas i odkaz na dětské propozice. Přínos pro placenou extrakci se v tomto běhu neměřil.
- Chotěbuz prošla současným HTTP čtením a oběma prohlížeči se shodným kandidátem. Scrapling HTTP odmítl certifikát vydavatele. Ověřování certifikátů zůstalo zapnuté.
- Vykreslení mapy Eventiv zpřístupnilo ovládací prvky, v HTML se neobjevily odkazy na jednotlivé závody. Zkouška nepoužila přihlášení ani řešení ochranné výzvy.
- Některé dříve označené problémy jsou v obsahu už v obyčejném HTML. Horní Halže obsahuje v nadpisu stav zrušení pro rok 2026. JBC na webu pořád uvádí ročník 2026. Další prohlížeč z těchto stránek nezískal potvrzený termín 2027.

## Rozhodnutí

Zkouška nedává důvod měnit produkční čtečky. Crawl4AI i Scrapling jsou použitelné jako základ pro samostatný prohlížeč mimo Mac. U ČSC by takový přesun pořád potřeboval ovládání tabulky a kontrolu úplnosti. Při dalším výběru zdrojů má smysl oddělit chybějící obsah, problém s přístupem a nerozpoznaný údaj v běžném HTML.

[Strojové výsledky](results.json) · [Crawl4AI](https://docs.crawl4ai.com/) · [Scrapling](https://github.com/D4Vinci/Scrapling)
