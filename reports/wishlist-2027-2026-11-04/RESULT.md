# Doporučené závody 2027: doplnění a opravy

4\. listopadu 2026. Zapsáno přímo do produkční databáze, po závodech atomicky, s kontrolou verze a duplicity. Hlavní sběr se nespouštěl. Kód a poznámky k vydání **nejsou zatím commitnuté ani nasazené**.

## Výsledek

Z pěti „nových“ závodů v katalogu už tři byly. Ostalb a Good Times byly veřejné, ale měly typ `ride`, který seznamy závodů nezobrazují. Proto se zdály chybět. Nové záznamy vznikly jen tři, všechny ve Stupavě.

| Závod | Výsledek | ID | Veřejná adresa |
|---|---|---|---|
| Ostalb Gravel, 11. 4. | Opraven, registrace otevřená | `0c5b3456-b536-4fe8-a834-c72d898303af` | https://letsrace.cz/cs/zavod/ostalb-gravel-2027 |
| Dirndltal Race, 18. 9. | Opraven, registrace neověřená | `d57834f6-a747-4237-9507-c7e3a41c63bc` | https://letsrace.cz/cs/zavod/dirndltal-race-gravel-mtb-2027 |
| Good Times Gravel, 25. 9. | Opraven, registrace neověřená | `8439de52-4a9f-4bb7-a55b-92032d905a6a` | https://letsrace.cz/cs/zavod/good-times-gravel-2027 |
| BAJKSERVIS Stupava maratón MTB, 19. 6. | **Nový**, registrace neověřená | `3e2b7f10-6a54-4d1e-9c11-7f0b1a2c3d01` | https://letsrace.cz/cs/zavod/bajkservis-stupava-maraton-mtb-2027 |
| Detský MTB cyklomaratónik Stupava, 20. 6. | **Nový**, registrace neověřená | `3e2b7f10-6a54-4d1e-9c11-7f0b1a2c3d02` | https://letsrace.cz/cs/zavod/detsky-mtb-cyklomaratonik-stupava-2027 |
| BAJKSERVIS Stupava MTB sprint Biely kríž, 29. 8. | **Nový**, registrace neověřená | `3e2b7f10-6a54-4d1e-9c11-7f0b1a2c3d03` | https://letsrace.cz/cs/zavod/bajkservis-stupava-mtb-sprint-biely-kriz-2027 |
| Wiosenne Szutry Premium, 17. 4. | Opraven, registrace otevřená | `c9bd52a6-5c75-4b18-a747-87cb7595e874` | https://letsrace.cz/cs/zavod/wiosenne-szutry-premium-2027 |
| Letnie Szutry Premium, 31. 7. | Opraven, registrace otevřená | `87b2f415-1481-43d7-91b3-03d959d0ca6a` | https://letsrace.cz/cs/zavod/letnie-szutry-premium-2027 |
| Jesienne Szutry Premium, 25. 9. | Opraven, registrace otevřená | `0eadbfa6-38ce-46f5-bec9-820da406dba3` | https://letsrace.cz/cs/zavod/jesienne-szutry-premium-2027 |
| Decathlon Cyklomaraton Hradec Králové, 30. 5. | Opraven, registrace otevřená | `f1d40430-b0ae-4dcf-9b94-0288fd48e3b4` | https://letsrace.cz/cs/zavod/cyklomaraton-hradec-kralove-2027 |
| NN Kids Race, 30. 5. | Opraven, samostatný dětský závod zachován | `00862df3-deff-45d8-816b-13a72191e6b9` | https://letsrace.cz/cs/zavod/nn-kids-race-2027 |

Ke všem záznamům jsou doplněné zdroje a historie změn se zdrojovými citacemi. Předchozí stav je v [before.json](before.json), výsledný v [after.json](after.json), zápisy v [apply.sql](apply.sql) a [manifest.json](manifest.json).

## Změny a rozhodnutí

- **Ostalb Gravel:** typ změněn na závod, protože pořadatel uvádí transpondéry a pořadí. Nesprávnou trasu 60 km nahradily 55 km/800 m a 83 km/1 400 m. Doplněno 69 €, do 18 let 39 €, přímá přihláška Datasport, starty, areál a věkové limity 12 a 16 let.
- **Dirndltal:** web změněn na web závodu, doplněny trasy a dětské kategorie U7 až U15, opraveno publikum „jen mládež“, připojen seriál TOPSIX podle propozic 2027. Adventure má orientačně 100 km/1 800 m. Dětské kategorie jsou ve filtrech U11 a U15.
- **Good Times:** typ změněn na závod. Odstraněn chybný odkaz na registraci do fóra Bikeboard.
- **Stupava:** běh a kombinace MTB a běhu nejsou importované. Hlavní závod a dětský závod jsou samostatně, se startovným, kategoriemi a programem. Časovka je MTB, časovka a závod do vrchu.
- **Szutry:** odkaz vede na `https://szutrypremium.pl/zapisy-szutry/`. Přímější není, přihláška na konkrétní edici se odesílá až tlačítkem na této stránce. Pořadatel také zveřejnil startovní listinu a regulamin 2027. Doplněny trasy, ceny a omezení na plnoleté.
- **Cyklomaraton:** registrace a web vedou na `https://cyklomaratontour.cz/`. EventReg sám vede na přihlášení a přímá adresa závodu nebyla ověřitelná, proto nebyla vymyšlena. Trasy jsou MTB 60 km, MTB 30 km a gravel 30 km, uzávěrka 27. 5. 2027 v 18:00, místo Malšovická aréna. Dětský řádek z hlavního závodu je odstraněný, aby se nezdvojoval s NN Kids Race.
- **Společné místo:** u bodu Malšovická aréna je opravená obec na Hradec Králové. Jediný další dotčený záznam byl NN Kids Race.

## Ochrana proti návratu chyby

- Dřívější ruční zámek u Cyklomaratonu držel prázdnou registraci. Zámek teď drží nový odkaz, uzávěrku, web, stav, disciplíny, kategorie a místo.
- Zkouška se skutečnou zápisovou funkcí importu se pokusila vrátit EventReg, starý web a disciplínu `xcm` u Cyklomaratonu i NN Kids Race. Všechny hodnoty zůstaly a zkouška byla vrácena zpět.
- Import nově nepřijme adresu `/forum/register/` (`src/lib/watcher/registration-url.ts`). Platí to až po nasazení.
- Filtr Gravel nově zahrne i závod, který má vedle gravelu MTB (`src/lib/taxonomy.ts`). Bez toho by Dirndltal a Cyklomaraton pod gravelem chyběly. Platí to až po nasazení.

## Ověření

- [verification.json](verification.json) s poslední kontrolou: všech 11 záznamů odpovídá kontrolnímu seznamu.
- Detaily česky i anglicky vracejí 200. Stránka Cyklomaratonu je přečtená i v prohlížeči a registrační odkazy jsou v HTML všech pěti závodů s otevřenou registrací a NN Kids Race.
- Společný seznam pro stránky seznamu, mapy a kalendáře obsahuje všech 11 záznamů se souřadnicemi, celkem 1 035 závodů.
- Filtry fungují: Gravel DE, PL a Good Times v AT, MTB a kategorie Děti ve Slovensku, časovka a závod do vrchu, U11 a U15 v Rakousku, Děti v Česku.
- Vitest: 1 517 testů prošlo. Kontrola typů neohlásila chybu.

## Co ještě čeká

1. **Nasadit kód.** Filtr Gravel, blokace odkazu na fórum a poznámky k vydání nejsou na webu. Dokud se to nestane, Dirndltal a Cyklomaraton pod filtrem Gravel chybět můžou.
2. **Společný seznam.** Poslední úprava disciplín Cyklomaratonu (`mtb`, `xcm`, `gravel`) je na detailu, seznam ale má obnovení ve stavu „čeká“. Cyklomaraton se v něm do té doby zobrazuje jen jako gravel a pod filtrem MTB chybí.
3. **Automatická kontrola zveřejnění.** Vyžádal jsem jednu dávku 200 obnovení, která zahrnula i tyto závody. Výsledek je ověřený přímo na stránkách, automatické potvrzení v obvyklé frontě může ještě čekat.

## Co se nepodařilo ověřit, a proto chybí

- **Dirndltal:** RaceTimePro ukazuje rok 2026 a přihláška Adventure je „geschlossen“. Registrace je prázdná. Startovné Trophy je vynechané, pořadatel uvádí 50 € i 55 €. U Adventure se liší i konec nižší ceny (10. nebo 11. 9.), proto je bez data. Stránka Adventure zmiňuje ještě seriál 2026, propozice Fun a Trophy ale uvádějí 2027.
- **Good Times:** Ticket Tailor nemá žádnou událost, registrace je prázdná. Program a ceny na webu jsou z roku 2026, proto nejsou převzaté. Délka dlouhé trasy se liší: web uvádí 92 i 85 km, Bikeboard pro rok 2027 uvádí 85 km/1 600 m. Řádek je označený 85–92 km a popis říká, že trasy pořadatel pro rok 2027 výslovně nepotvrdil. Pro filtry je použita hodnota z Bikeboardu.
- **Stupava:** formuláře SportSoft 3457 a 3458 jsou pro rok 2026, odkaz není uvedený. U časovky a dětského závodu je uzávěrka 2027 zapsaná bez formuláře. U maratonu je jen cena 35 € do 31. 3. 2027. Další řádky mají chybná data (17. 9. 2027, 18. 9. 2026, 10. 9. 2026) a jsou vynechané. Závod je v propozicích uveden v Župném a Slovenském poháru, ty jsou však v katalogu vedené jako seriály 2026, proto není připojený.
- **Szutry:** předběžné trasy ani přesné místo startu zatím nejsou zveřejněné.
- **Cyklomaraton:** přímý formulář EventReg nebyl ověřitelný bez přihlášení. Otevřený stav dokládá text pořadatele a počet 76 přihlášených. Pořadatel uvádí kategorii „Gravel - muži“ dvakrát a u dětí rozdílné roky narození. Ty proto nejsou převzaté a NN Kids Race má jen rozsah 2–14 let.
- **Přesný bod na mapě:** Ostalb, Dirndltal a Stupava mají bod obce. Přesná adresa je v údajích o areálu.

## Kontrolní sada

Soubor `docs/quality/reference-2026-11-04.json` se neměnil, otisk je stále `52d90d3c…`. Kontrolní případ `sk-stupava-summer` je stejný závod a termín 19. 6. 2027 jako nový maraton. Před zápisem v katalogu nebyl, protože v případu nejsou schválená ID, ani teď s ním není spojený: čtení hlásí 1 shodu a 13 případů bez schválené vazby ([reference-read.json](reference-read.json)). Případ `sk-stupava-winter` odpovídá existujícímu `stupava-winter-mtb-marathon-2027` ze dne 16. 1. 2027. Ten jsem neměnil. Má jen disciplínu `xcm`, zatímco sada čeká `mtb`, takže při pozdějším porovnání vyjde jako rozdíl.

Nový maraton je od této chvíle ručně opravený případ, takže v P1.4b má patřit mezi regrese, ne mezi nedotčené ukázky.

## Další zjištění mimo zadání

- Dalších devět závodů 2027 má stejný chybný odkaz na fórum Bikeboard, navržený samostatný úkol.
- Stav `registration_open` se po uzávěrce sám nezmění na uzavřený a web ho na detailu zatím nezobrazuje jako text. U Cyklomaratonu je stav zamčený už z dřívějška, takže se po závodě nedokončí automaticky.
- V roce 2026 zůstávají Stupavě duplicitní záznamy sprintu a maratonu, Dirndltal má také několik záznamů. Historii jsem neměnil.
- Pořadatel ve Stupavě vypisuje i silniční sprint 9. 5. 2027. Nebyl součástí zadání a v katalogu jsem ho nekontroloval.
