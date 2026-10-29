> Historický audit: tehdejší počty a intervaly nejsou aktuální provozní nastavení. Aktuální přehled je v [keep-fresh.md](keep-fresh.md).

# Audit dat: co je neúplné nebo špatně

*Stav k 1. 10. 2026, veřejné závody v příštích 12 měsících: 1 209.*

| Problém | Počet |
|---|---|
| Bez kategorií | 279 |
| Kategorie jen odhadem | 360 |
| Bez webu i registrace | 222 |
| Bez odkazu na registraci | 875 |
| Bez uzávěrky přihlášek | 1 119 |
| Bez souřadnic | 64 |
| Bez místa vůbec | 53 |
| Poloha jen ve středu regionu | 51 |
| Skutečné duplicity (stejný den, do 3 km, stejná disciplína) | asi 20 |
| Nekvalitní název | 27 |
| Bez disciplíny | 24 |
| Bez zdroje, který by je hlídal | 39 |

## A. Poloha (rozbíjí hledání „do X km ode mě“)

1. **Bez místa: 53 závodů.** Z toho 39 přidaných ručně podle seriálu (GUNSHA Cross Challenge, CX-Cup NDS, Středeční pohár, Cyklománek, 3Lions…). Místo je v názvu za pomlčkou („GUNSHA Cross Challenge — Borna“), ale nikdy se nepřevedlo na lokaci.
   *Řešení:* vzít město z názvu za „—“ a geokódovat ho se zemí seriálu.
2. **Poloha jen ve středu regionu: 51 závodů.**
   - 39 rakouských z cyclingaustria.at má místo „Nieder“, „Ober“ nebo „Kärnten“ (kalendář uvádí jen spolkovou zemi).
   - 12 virtuálních jízd „German Cycling vRTF #13–24“ leží ve Frankfurtu.

   *Řešení:* pro Rakousko číst místo z detailu závodu na cyclingaustria. Virtuální jízdy označit jako virtuální a nedávat je na mapu ani do hledání podle vzdálenosti.
3. **Geokódování blokované limitem.** Nominatim vrací HTTP 429 a v noční frontě zůstalo 801 míst, převážně u starších závodů.
   *Řešení:* geokódovat pomalu v noční dávce s pauzou mezi dotazy. Jako druhý zdroj použít Photon (free, bez klíče) nebo Mapy.cz API. Výsledky ukládat do cache podle dotazu a země.
4. **Areál místo města:** „Freizeitpark“, „ADAC Übungsplatz“, „Sportplatz am Waldessaum“. U STEVENS Cupu je to opravené.
   *Řešení obecně:* když místo vypadá jako areál a geokódování spadne mimo město z názvu, vzít město z názvu.

## B. Duplicity (asi 20 skutečných v příštím roce)

Typy, které dnešní slučování nepozná:

- **Jiný jazyk:** „Velká cena města Plzně“ a „Grand Prix Pilsen“, „UCI Cyclo-cross World Cup — Antwerpen“ a „4. závod SP — Antverpy“.
- **Kolo seriálu a celý název:** „#13 – Elmshorn“ a „CycloCross im Stevens-Cup … Elmshorn“, „Stevens Cyclo-Cross-Cup #7“ a „… Kaltenkirchen“.
- **Dva zápisy téže akce:** „L'Eroica Gaiole“ a „L'EROICA DI GAIOLE IN CHIANTI“, „Gran Fondo Loutraki“ a „UCI Gran Fondo Greece“, „JANEV CUP NZ (6. ČP Cyklo-X)“ a „Janev Cup 2026 – Prachatice národní závod“, „Chirk“ a „Chirkish Delight“.

Co duplicita **není**:
- italské dny s více závody pro různé kategorie na jednom místě (Buscoldo, Dairago, Salvirola),
- Pumptrack a Bikros v Litoměřicích,
- trasy jedné akce (Mała a Wielka Sowa). Ty by časem zasloužily spojit do jedné akce s více trasami.

*Řešení:*
- Automaticky slučovat, když je stejný den, vzdálenost do 2 km, stejná disciplína a navíc platí aspoň jedno:
  - sdílí slovo z názvu (5 a více písmen, včetně překladů měst: Pilsen/Plzeň, Antwerpen/Antverpy),
  - jeden z názvů je jen „#N – Město“,
  - oba záznamy jsou ze stejného seriálu.
- Ostatní kandidáty posílat do fronty `duplicate_reviews` (tabulka existuje) k rozhodnutí jedním klikem v adminu.

## C. Názvy (27)

- „#03 – Bad Harzburg“: číslo kola bez názvu seriálu.
- „8. kolo Slovenský pohár BMX Racing“: číslo kola bez místa.
- „#10 Strava Edition“, „Chirk“.

*Řešení:* když známe seriál a město, skládat název „Seriál — Město“. U řádků STEVENS Cupu doplnit seriál a disciplínu cyklokros (11 z 24 závodů bez disciplíny jsou právě tyhle).

## D. Kategorie (279 bez, 360 jen odhadem)

Podle zdroje (bez kategorií):

| Zdroj | Bez kategorií |
|---|---|
| radsport-events.de | 75 |
| odjazd.pl | 28 |
| FCI | 28 |
| eventivsport | 22 |
| cyclingaustria | 18 |
| pzkol.pl | 16 |
| ČSC | 13 |
| STEVENS | 13 |

*Řešení podle přínosu:*
1. radsport-events.de má v detailu pole „Klassen“.
2. Registrace odjazd.pl a dostartu.pl vypisují kategorie.
3. Detail závodu na cyclingaustria.
4. Na zbytek čtení propozic jazykovým modelem s doslovnou citací.
5. Potvrzení od uživatelů.

U 360 odhadů má smysl pustit stejné čtečky. Odhad se nikdy nepřepíše jiným odhadem, jen uvedeným údajem.

## E. Odkazy a přihlášky (nejvíc chybí uživatelům)

- **Bez webu i registrace: 222.** FCI 128, ČSC 35, radsport 25, STEVENS 10.
- **Bez odkazu na registraci: 875. Bez uzávěrky: 1 119.** „Do kdy se musím přihlásit“ je přitom nejpraktičtější informace.

*Řešení:*
- Na webu závodu najít odkaz na registrační platformu (`registration-url.ts` platformy pozná).
- Z platforem s pevnou strukturou (sportsoft, RaceResult, dostartu, odjazd, endu.net, my.raceresult) číst uzávěrku a startovné.
- Na portálu ČSC je pole „Entries close date“. Už ho čteme, ale je jen tam, kde se liší od dne závodu.

## F. Bez zdroje (39)

Ručně přidané řádky (seriály GUNSHA, Oderský pohár, Pražský MTB pohár, Czech Downhill…) nikdo nehlídá: změnu termínu ani zrušení nepoznáme.

*Řešení:* ke každému seriálu přidat oficiální kalendář jako zdroj (`watched_urls`). Do té doby u nich ukazovat datum poslední kontroly a jednou měsíčně je zařadit do kontroly.

## G. Typ akce

Virtuální jízdy (vRTF, Strava Edition), RTF, brevety a festivaly se míchají se závody.

*Řešení:*
- Virtuální akce skrýt z mapy.
- Ostatní označit typem a ve výchozím filtru ukazovat jen závody, s přepínačem „i vyjížďky a brevety“.

## Navržené pořadí

1. Rychlé opravy (hodina):
   - místo z názvu u 39 ručně přidaných řádků,
   - STEVENS Cup (seriál a disciplína),
   - virtuální jízdy,
   - zjevné duplicity.
2. Lepší slučování duplicit a fronta k ručnímu rozhodnutí.
3. Rakousko: místo a kategorie z detailu cyclingaustria.
4. Geokódování: pomalá noční dávka a druhý poskytovatel.
5. Registrace a uzávěrky z webů a platforem.
6. Kategorie z radsport-events.de, odjazd.pl a dostartu.pl.
7. Zdroje pro ručně přidané seriály.

## Stav po opravách (1. 10. 2026)

Hotovo:
- **A. Poloha**
  - 19 ručně přidaných kol dostalo místo.
  - 50 rakouských závodů má místo z detailu cyclingaustria.at.
  - Oprava „Niederösterreich“ → „Nieder“.
  - 26 polských závodů z kalendarzrowerowy.pl má místo z detailu.
  - Pomalé geokódování (`scripts/geocode-slowly.ts`) čeká, dokud neskončí limit Nominatimu.
  - 15 virtuálních jízd skryto.
- **B. Duplicity:** nové pravidlo pro stejný závod pod dvěma jmény. 9 sloučeno, zbytek je ve frontě `/admin/duplicates`.
- **D. Kategorie**
  - Čtečka v2 čte web závodu, propozice, Google Drive a stránky „Kategorie“, a vykresluje JavaScriptové aplikace.
  - Kategorie z cyclingaustria.at.
  - Věková pole registračních platforem.
  - `/admin/series` pro rozhodnutí o kategoriích celého seriálu.
- **E. Registrace:** 226 závodů má odkaz na registraci z webu závodu.

Zbývá:
- **F.** Zdroje pro ručně přidané seriály. U každého je potřeba ověřit, že watcher jeho stránku přečte.
- **E.** Uzávěrky přihlášek z registračních platforem (RaceResult, sportsoft, dostartu).
- **D.** Polsko (odjazd.pl kategorie nemá ani po vykreslení) a Švýcarsko. Na zbytek čtení propozic jazykovým modelem.

Data aktuální drží `scripts/keep-fresh.sh`: plný běh každé 3 hodiny, Mac zůstává vzhůru.
