# Předání rozpracovaného čištění LetsRace

Aktualizováno 18. 11. 2026 přibližně ve 22.30 CET. Tento soubor vznikl na výslovnou žádost majitele pro pokračující AI. Stav níže je skutečně ověřený při předání. Celé čištění dosud dokončené není.

## Cíl majitele

Najít závody, ověřit je a zveřejnit je co nejrychleji. Přidat přihlášky, propozice a jejich skutečné kategorie. Projít všechny fronty a pořadatele. Závody se nemají ztrácet mezi průzkumem a zveřejněním. Majitel chce minimum placeného čtení a srozumitelný aktuální přehled. Výslovně dovolil převzít celé dokončení od druhé AI a požádal resetovat cache.

Kategorie mají vycházet z propozic správného ročníku. Aktuální oficiální detail UCI je další platný podklad. Potvrzené letošní kategorie mají nahradit loňský odhad. Zvlášť ověřit identitu závodu, protože jedna stránka pořadatele může obsluhovat hobby závod, ženský profesionální závod i juniorské závody.

## Pracovní prostředí

- Skutečný zdrojový checkout je `/Users/radektobolka/Documents/GitHub/letsrace`.
- CWD chatu `/Users/radektobolka/Desktop/letsrace` není zdrojový checkout. U příkazů vždy nastavit pracovní adresář.
- Přečíst `AGENTS.md`. Platí pravidla ročníků, ověřování propozic a šetření hostingem.
- Checkout obsahuje mnoho předchozích změn majitele a jiné AI. Žádný reset, checkout přes soubory ani hromadné přepsání. Moje změny nejsou commitnuté. Žádný nový frontend deployment jsem nedělal.
- Nainstalovaná čtečka na Macu používá `~/Library/Application Support/LetsRace/runtime`. Samotná úprava checkoutu se tam okamžitě nepromítne.
- Pracovní důkazy a pomocné skripty jsou v `tmp/queue-cleanup-2026-11-18/`. Tento adresář je lokální a ignorovaný Gitem. Při předání ho zachovat.
- Bezpečný pomocník pro aktuální serverovou databázi je `tmp/queue-cleanup-2026-11-18/db-query.cjs`. Načítá existující serverové prostředí a nepíše přístupové údaje do výstupu. SQL čte ze stdin. Lokální kopie databáze může být pozadu.

Příklady spuštění z hlavního checkoutu

```sh
node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/review-discovery-candidates.ts
node tmp/queue-cleanup-2026-11-18/db-query.cjs <<'SQL'
select status,count(*) from pipeline_candidates group by status;
SQL
```

## Co je už zapsané

### Nové záznamy v tomto obnoveném běhu

1. Celkem 36 švýcarských závodů přes opravenou čtečku Swiss Cycling a běžné publikační kontroly. Podrobnosti jsou ve třech řádkových protokolech `/tmp/lr-swiss-apply-2.log`, `/tmp/lr-swiss-apply-3.log`, `/tmp/lr-swiss-apply-4.log`. Sečíst jen řádky `created:true`. Výsledek 10 + 1 + 25.
2. Gravel Blinduro 2027, 4.–5. září, Albeř. ID `e3418c78-bdd6-42d8-912f-ead4e61abaf8`, slug `gravel-blinduro-2027`. Majitel poslal nově otevřenou registraci. Je uložen čistý odkaz `https://registrace.sportsoft.cz/registration.aspx?e=3680`. Veřejná stránka byla otevřena a potvrzena v prohlížeči.
3. Osm dalších samostatných závodů z UCI po opravě chybných shod
   - Women’s Cycling Grand Prix Region Stuttgart, `f0529760-c255-454c-b7d6-c2986449f129`, slug `women-s-cycling-grand-prix-region-stuttgart-2027`.
   - Eschborn-Frankfurt, `6ea844ea-4f46-47c7-aa4d-35c9e4fd2bc8`, slug `eschborn-frankfurt-2027`.
   - Gran Premio Della Liberazione Donne, `92653788-17b2-478e-abbb-737cd5014bb7`, slug `gran-premio-della-liberazione-donne-2027`.
   - Tre Valli Varesine, `73eff04e-d233-46ef-94b5-68e92e80b578`, slug `tre-valli-varesine-2027`.
   - German National Championships – BMX Racing, `b4159c0f-6ade-4b12-980a-853a1bf591e0`, slug `german-national-championships-bmx-racing-2027`.
   - Piccolo Trofeo Alfredo Binda – Valli del Verbano, `bf117b31-82fa-497b-8efa-b0763516686a`, slug `piccolo-trofeo-alfredo-binda-valli-del-verbano-2027`.
   - Strade Bianche, `a99c7955-958e-43dd-850e-5c7742c75914`, slug `strade-bianche-2027`.
   - Giro Della Romagna, `0b88c8ed-86ed-4971-a45e-f5aa9b0c6711`, slug `giro-della-romagna-2027`.

To je 45 nových závodů v obnoveném běhu. Dřívější import 106 UCI závodů udělala jiná AI. Dřívějších 13 ručně dokončených závodů z předchozí části tohoto chatu je samostatná práce a do těchto 45 nepatří.

U nových osmi UCI závodů následně proběhl cílený harvester na doplnění kategorií, třídy, zdroje a kontaktu. Výsledek `tmp/queue-cleanup-2026-11-18/new-uci-details.json`, protokol `/tmp/lr-new-uci-details.log`. Projít ještě propozice na odkazovaných webech. Zápis do databáze všech osmi je ověřený. Jednotlivé veřejné stránky těchto osmi zatím všechny navštívené nebyly.

### Důležité opravy existujících závodů

- Grand Prix West Bohemia 2027, ID `a4ddb826-4b48-43c2-8603-429fa80a6d3c`, nyní pouze `junior`, `age_confidence=explicit`. UCI skutečně uvádí Men Junior. Zdrojem je soutěž `4fa9f103-5886-47e0-9ccd-a43ecebb4f5e`. Původně zůstávalo `junior,youth` a `previous`.
- U stejného závodu byla špatně zvolená obec Kyšice u Kladna. Opravena poloha jediného používaného location záznamu na Kyšice u Plzně podle přesné adresy a souřadnic v ověřených loňských propozicích. Souřadnice `49.7551944444,13.4849444444`. Zapsaná provenance `location_coordinates`, metoda `reviewed_previous_venue`. Stabilní místo zůstává převzaté z minulého ročníku.
- Brezel Race Stuttgart & Region byl chybně obohacen z ženského profesionálního závodu. Vráceny jeho hobby kategorie `amateur`, předchozí jistota `previous`, úroveň `local`, odstraněna chybná třída ProSeries, vrácen web `https://www.brezelrace.de/`. Chybné praktické kategorie a kontakt byly odvolány. Chybná vazba na UCI byla odstraněna po úplné záloze. Správný ženský závod je nyní samostatně zveřejněný.
- Záloha Brezel před opravou je `tmp/queue-cleanup-2026-11-18/brezel-before-repair.json`. Pole byla vracena přes `pipeline_rollback_fact`, praktická pole přes porovnání původní hodnoty a auditní stav `rolled_back`. Rollback pole audience měl v původních faktech chybně `previous=null`. Celá první transakce se proto vrátila a opravená transakce ponechala správné `adults`. Žádná částečná změna z neúspěšné transakce nezůstala.
- Nové Město má nyní správnou třídu `cdm`, oba zdroje UCI pro světový pohár a Junior Series a praktické řádky kategorií z obou soutěží. Hlavní pole zůstává `junior,u23,elite` s jistotou `previous`, protože starší ruční zámek blokuje kategorie a jistotu. Toto je přesná zbývající práce. Ověřené současné podklady potvrzují celou trojici, ale běžná automatika ruční zámky respektuje. Nesmí se nahradit celá akce pouze juniory podle prvního připojeného odkazu. ID `38af09e7-a920-47b5-8b75-e2d17f64d02a`.
- Připojeny a uzavřeny správné existující identity pro JANEV CUP Veselí a NoLimited Selce. Zachovány širší kategorie z jejich skutečných propozic.
- Strade Bianche Women Elite má správně `elite` a WorldTour. Visegrád 4 GP Czech Republic byl porovnán s aktuálními kategoriemi UCI.
- Radcross Illnau 2026 má doplněnou třídu C2, juniory a elite, názvy mužských i ženských kategorií a kontakt. UCI řadí závod z 27. 9. 2026 do sezony 2027. Datum ročníku určuje `startDate`, nikoliv samotný filtr sezony. Pro rok 2027 pořadatel potvrzuje 26. 9. 2027, propozice na webu zatím nebyly doložené.

## Zásadní chyba čtení propozic, kterou už jsem opravil

Při vlastním spuštění `fill-regulation-ages.ts CZ,SK --max=60 --apply` stará logika přijímala kategorie z jiného ročníku a někdy i z obecného kalendáře. Vzniklo 44 chybných faktů u 22 závodů. Všech 44 jsem v jedné transakci vrátil přes existující `pipeline_rollback_fact` a ověřil stav `rolled_back`. Navíc jsem vrátil čtyři starší stejné chyby u Mouflon Tracks a CKW Hergiswil.

Oprava v `src/lib/catalog/regulation-ages.ts` zavádí `currentRegulationText` a před čtením kategorií kontroluje vlastní dokument, správný ročník a příslušnost závodu nebo série. Odfiltruje navigaci, postranní obsah a obecné kalendáře. Zachová větší limit PDF 16 MB zavedený jinou AI. Testy obsahují staré propozice s vedlejším odkazem na rok 2027. Kontrola skutečné Pražské 50 2027 po opravě nic z roku 2026 nepřevzala.

V konečném shrnutí majiteli tuto chybu i její úplné vrácení uvést. V žádném případě neoznačit staré propozice za aktuální.

## Změny čteček v checkoutu

Navazují na rozpracované soubory jiné AI. Neodstraňovat její UCI čtečku, kategorie ani další úpravy.

- `src/lib/watcher/extractors/swisscycling.ts` opravuje disciplíny Bahn, Strasse, Radquer, vyřazuje běžecký Stadtlauf, čte sloupec kategorií a ukládá doslovný řádek `swiss_cycling_table`.
- `src/lib/discovery/review-source.ts` znovu porovnává celý Swiss Cycling nebo Sportsoft záznam při změně okolního HTML. Zachovává UCI opětovné čtení. Používá `ReviewSourceChangedError`. Obecná chybová zpráva obsahuje původní kompatibilní text `changed or unavailable`.
- `src/lib/catalog/quoted-date.ts` rozumí rozsahům `DD.MM.YYYY – DD.MM.YYYY`.
- `src/lib/watcher/extractors/sportsoft.ts` čte veřejný registrační header podle `ctl00_LNazev`, `ctl00_LDatum`, `ctl00_LMisto`. Bere web z `ctl00_HLPoradatel`, odstraňuje sledovací parametry a nepovažuje formulářové volby pohlaví za skutečné kategorie závodu.
- `src/lib/watcher/extractors/adapters.ts` obsahuje Sportsoft registrační adaptér.
- `src/lib/catalog/uci-directory.ts` má `uciDirectoryCategoryState`. Loňské nebo odhadnuté kategorie může nahradit aktuálními kategoriemi UCI pouze při shodné identitě názvu. Zachovává kategorie z aktuálních propozic, ručně potvrzené údaje a širší hromadné akce. Záměna části víkendu nebo cizí akce nesmí zúžit všechny kategorie.
- Tentýž UCI parser přidává do obecného názvu soutěže disciplíny BMX přívlastek `BMX Racing`, pokud ho název vynechal. Kód BMX v UCI rozlišuje racing od BFR freestyle.
- `scripts/harvest-uci-directory.ts` má novou volbu `--ids=id1,id2`. Umožňuje cílené opětovné čtení i minulého závodu a správně rozšíří období katalogu. Čte i audience do auditních předchozích hodnot. Kontroluje skutečný výsledek souběžné aktualizace a chybu zápisu faktů. Brezel Race rozlišuje jako hobby podnik.
- `src/lib/dedup.ts` rozlišuje divácký zájezd a závod, BMX Racing a Park & Flatland.
- `src/lib/catalog/merge-duplicates.ts` rozlišuje Piccolo Trofeo a elitní závod. To uvolnilo juniorský Alfredo Binda.
- `src/lib/watcher/source-identity.ts` pro aktuální UCI a Swiss Cycling datované řádky neabsorbuje jiný závod na sousední den. To uvolnilo Strade Bianche, které mylně naráželo na Gran Fondo dalšího dne.
- `src/lib/watcher/run.ts` ukazuje v chybném rozhodnutí i ID konkrétního nesprávně spárovaného závodu. Veřejné chování mimo rozlišené případy se má zachovat.
- `src/lib/discovery/assessment.ts` odlišuje `website=TBC` ve strukturovaném UCI záznamu od neurčitého termínu. Giro Della Romagna má pevné datum a místo Lugo, nehotový web byl falešně chápán jako předběžný termín.

Konečné ověření prošlo. Všech 2038 testů ve 274 souborech je úspěšných a kontrola TypeScriptu prošla. Všech 13 změněných souborů čteček bylo atomicky zkopírováno do runtime a porovnáno kontrolním součtem. Přesný seznam a výsledky jsou v `tmp/queue-cleanup-2026-11-18/verification-final.json`. Dřívější jediný neúspěšný test kvůli textu výjimky je opravený.

## Cache a skutečné veřejné zobrazení

Majitel výslovně požádal reset cache. Běžný serverový cron byl spuštěn a odpověděl HTTP 200. Fronta ale omezuje dávky a drahé HTML kontroly. Pouhé uložení do DB se tedy může na webu objevit později.

Proběhl následný explicitně vyžádaný reset přes stávající privátní publikační rozhraní. Pracovní skript `tmp/queue-cleanup-2026-11-18/reset-public-cache.ts` použije krátkodobou rezervaci běžné publikační úlohy, po každé skutečné odpovědi zapíše potvrzení a po obnovení přehledu porovná veřejná data s databází.

Konečný reset při předání je v `tmp/queue-cleanup-2026-11-18/cache-reset.json`. Nejprve bylo obnoveno 251 detailů, při konečném průchodu dalších 10. Celý veřejný přehled se po posledních opravách shodoval s databází pro 1293 závodů. V prohlížeči byl znovu otevřen běžný veřejný detail West Bohemia. Ukazuje pouze potvrzené juniory a navigaci na správné Kyšice u Plzně. Po dalších změnách bude nutný nový reset. Nespouštět plošné stovky drahých HTML kontrol. Skript záměrně nezahřívá stovky detailů.

Veřejný endpoint `https://letsrace.cz/api/events?catalogue=1` nyní funguje i obyčejným serverovým požadavkem. Z něj lze ověřit přehled bez procházení stovek stránek. Přístupové údaje nikam nekopírovat.

Odkazy pro vzorek veřejného ověření

- `https://letsrace.cz/cs/zavod/grand-prix-west-bohemia-2027`
- `https://letsrace.cz/cs/zavod/gravel-blinduro-2027`
- `https://letsrace.cz/cs/zavod/brezel-race-stuttgart-region-2027`
- `https://letsrace.cz/cs/zavod/women-s-cycling-grand-prix-region-stuttgart-2027`
- `https://letsrace.cz/cs/zavod/uci-mtb-world-cup-nove-mesto-na-morave-2027`

## Aktuální fronty při předání

Ověřeno serverovým SQL přibližně ve 22.27 CET

- 70 `pending` kandidátů.
- 17 `waiting` kandidátů.
- 342 `published` kandidátních snímků. Toto číslo není počet nových závodů.
- 187 `rejected` kandidátních snímků.
- 0 `publishing`, rozpracované vlastní neúspěšné publikace byly uzavřené nebo vrácené.
- 37 `pending` objevených odkazů v `discovered_links`.
- `pipeline_proposals` neměly čekající změny, 32 bylo aplikováno a 3 odmítnuty.
- Race Finder desk vracel 0 otevřených případů a 109 odpovědí dnes. Odpovězeno není totéž jako zveřejněno. Prověřit příslušné příjmy ověření a aplikace.

Reconciliace kandidátních snímků byly provedené podle ověřené totožnosti nebo přesného zdrojového ID, ročníku a rozsahu data. Původní důkazy zůstaly. Když je závod už na webu, uzavřít i starší snímky téhož nálezu.

Bylo odmítnuto deset L’Etape z mimo sedm současných zemí mapy a švýcarský běžecký Stadtlauf. Majitelovy nálezy zůstávají v historii. L’Etape Czech Republic je třeba porovnat s existující Hilly Stage přes datum 19. 6. 2027 a oficiální zdroj, nejde o další nový závod.

## Co dělat dál

1. Dokončit aktuální ověření testů a zkontrolovat nainstalovanou čtečku podle `verification-final.json`.
2. Dočíst `new-uci-details.json`. U osmi nových UCI závodů následovat skutečné weby na propozice a provést `read-race.ts` / `verifyPracticalExtraction`. Sportsoft a nové švýcarské odkazy byly hledané bez placených modelů. U všech 45 ještě nejsou dohledané aktuální propozice.
3. Dokončit Nové Město. Všimnout si ručního zámku jistoty a kategorií. Ověřená současná kombinace světového poháru a juniorské série zahrnuje junior, u23 a elite. Detail UCI pro samotné juniory nesmí přepsat celý víkend.
4. Otevřít aktuální kandidáty přes `scripts/review-discovery-candidates.ts` a znovu načíst jejich stav. Export je `tmp/discovery-review.json`. Starší seznam 153 nebo 188 je zastaralý.
5. Projít zbývající Swiss Cycling snímky. Přehled čerstvě parsovaných řádků je `/tmp/lr-remaining-review.log`, vlastní skript `tmp/queue-cleanup-2026-11-18/review-remaining.ts`. Vynechané nové řádky nejsou automaticky duplicity. Například národní Gippingen 12. 6. má jiné kategorie než další závody 11. a 13. 6. Märwil 8. 5. může být mládežnický den vedle UCI 9. 5. Nezapsat ale novou duplicitu celého víkendu.
6. Konkrétní švýcarské nejasnosti
   - Tour du Léman, Carouge, 27.–29. 8., Swiss ID 9629, U19 F/M a U23 F. V katalogu při kontrole nebyl podobný název.
   - 3 jours de Genève, Les Acacias, 22.–24. 1., Swiss ID 9626. V katalogu nebyl podobný název.
   - 4 jours de Genève už existuje přesně 25.–28. 11., slug `4-jours-de-geneve-2027`. Připojit zdroj a uzavřít staré snímky.
   - Giro del Nord Ticino už existuje 9.–11. 7., aktuální federace uvádí 10.–11. 7. Ověřit program, rozsah může zahrnovat příjezd. Nezdvojit.
   - GP Berra Immobilier už existuje v Saillonu 18. 4., aktuální federace navíc uvádí Mémorial Jean Luisier a více kategorií.
   - Tamaro Rivera má v katalogu 21. 3., federace 20.–21. 3. Kategorie jsou v doslovném řádku. Gränichen má v katalogu 17.–18. 9., federace 18.–19. 9. Vyřešit rozpor aktuálního ročníku.
   - Bienne Crit má ve federaci místo Bern. To vyžaduje ověření skutečného místa na pořadatelském webu.
   - Serravalle má disciplínu Trial, kterou katalog nyní nepodporuje. Mauren FL je v Lichtenštejnsku, nikoliv ve Švýcarsku. Nevytvářet špatné piny.
   - Swiss kódy `E M`, `E F`, `F E` nejsou dosud správně mapované na elite. Sdílená funkce `ageCategoriesFromList` z nich elite nepoznala. Doplnit malou normalizaci pouze švýcarského sloupce a test. Původní názvy řádků zachovat. To je zbývající oprava, nebyla ještě implementovaná.
7. UCI nevyřešené detaily jsou uložené v `tmp/queue-cleanup-2026-11-18/uci-unresolved-current.json` a stručně v `/tmp/lr-uci-unresolved-current.log`. UCI rozcestník majitele je `https://uci-competition.tech.uci.ch/competitions?season=2027&country=CZE,SVK,GER,POL,AUT,ITA,SUI`.
8. Českým dráhovým UCI položkám často chybí město, protože mají skutečnou ulici velodromu. `Nad Kapličkou` je Praha, `Křížkovského 416/22` Brno, `Kostelecká 4468/49` Prostějov. Město doložit na pořadatelském webu se stejnou adresou. UCI datum je použitelný podklad. Pro spojení se suplementárním místem zatím `validateReviewSource` podporuje `fieldEvidence` u starého UCI komponentu, ale ne u `uci_directory`. Neobcházet kontrolu upraveným citátem. Doplnit ověření skutečného druhého zdroje s testem, potom normálně publikovat.
9. Další UCI případy potřebují skutečné místo, ne adresu sídla nebo region. TBC, hotel pořadatele nebo firemní adresa nesmějí být piny. Národní společná mistrovství CZ/SK v Nové Bani mohou mít zemi závodu odlišnou od označení federace. Ověřit skutečné místo.
10. Due Giorni del Mare má v UCI názvu 2026, ale termín 10.–11. 4. 2027 a seasonYear 2027. Vyžaduje nezávislé potvrzení pořadatele. Neměnit rok jen podle přání publikovat.
11. Tour de Suisse 2027 je v UCI 16.–20. 6. s místem Vaduz. Starý katalogový záznam Stage 1 obsahuje nesmyslné Sondrio a více agregátorových odkazů včetně ženy/muži. Čerstvé Swiss Cycling řádky mají zvlášť E M a E F, oba pod stejným názvem Tour de Suisse. Tyto dvě soutěže správně rozlišit a ověřit aktuální trasu.
12. Po dalších změnách znovu resetovat cache, porovnat katalog a zkontrolovat pár veřejných stránek. Při tomto předání už konečný reset i veřejná kontrola West Bohemia proběhly. Jeho odkaz na organizační pokyny stále vede na dokument 2026, praktická pole mají správně označení převzetí. Při další úpravě zkontrolovat i srozumitelné označení samotného odkazu starého dokumentu.

## Audit údajně nečitelných webů

Nově jsem znovu načetl všech 219 aktuálně aktivních zdrojů s `needs_review` nebo `error`. Celý audit je `tmp/queue-cleanup-2026-11-18/unreadable-audit-current.json`.

- 97 stránek obsahuje několik plných dat.
- 71 obsahuje jedno nebo dvě plná data.
- 25 nemá datum v načteném textu.
- 10 uvádí více dat bez roku.
- 9 jsou pomocné stránky, například výsledky, galerie nebo kontakty.
- 4 jsou prázdné nebo potřebují prohlížeč.
- Jeden zdroj odpověděl 401, jeden 403 a jeden se nepodařilo načíst.

Tyto počty neznamenají 97 nových závodů. Data mohou být minulá a nesouvisející. Většina oranžových případů je dostupná stránka bez odpovídající čtečky nebo s prázdným výtahem, nikoli neotevíratelný web. Původní souhrnný popisek „Nešlo přečíst“ toto nerozlišuje. Nezahladit problém přejmenováním všech webů na hotové.

Osm starých chyb je selhání zápisu nebo souběžná změna, která vyžaduje řízené opakování. Jsou v poli `error` v auditu. Velké kalendáře mezi dostupnými zdroji zahrnují RoadCycling RoadCup 2027, VICC race-days, amatérskou ligu a další. Před čtením modely ověřit, co už mají v katalogu a zda lze opravit doslovnou čtečku.

## Další užitečné pracovní soubory

- `tmp/queue-cleanup-2026-11-18/before.json` je starší výchozí snapshot. Nikdy ho nepoužít místo aktuálního stavu.
- `review-swiss.ts`, `enrich-swiss-links.ts`, `review-sportsoft.ts`, `publish-uci-reviewed.ts` jsou pomocné skripty s konkrétními podklady. Prohlédnout před opětovným spuštěním. Respektují běžný gate a u vlastní chyby vracejí rezervaci přes `pipeline_retry_candidate`.
- `repair-uci-existing.ts` obsahuje ručně ověřené mapování pěti existujících závodů, zapisuje zálohu a respektuje ruční zámky.
- `swiss-links.json` obsahuje navštívené federální detaily a skutečné odkazy pořadatelů.
- `swiss-practical.json` potvrzuje strukturované dočtení 35 závodů, 26 stažených a 8 znovupoužitých dokumentů, 0 chyb, 0 USD za modely. Bylo doplněno málo detailů, protože většina webů zatím uvádí starší ročník. Nehlásit všechny jako dokončené propozice.
- `uci-category-audit.json` byl jen kontrolní nástřel čtyř případů a nikdy se hromadně neaplikoval. Právě odhalil Brezel a Nové Město. Skript vybírá první UCI odkaz a sám o sobě není bezpečný seznam k hromadné opravě.
- Veřejné ověření proběhlo přes in-app prohlížeč, když běžný curl dostával ochrannou odpověď. Neobcházet CAPTCHA nebo sign-in.

## Co ještě není hotové

70 čekajících kandidátů, 17 odložených kandidátů a 37 odkazů zbývá skutečně projít. Nejsou dokončené všechny propozice ani všechny čtečky 219 zdrojů. Neexistuje důkaz, že jsou vyčištění všichni pořadatelé. V souhrnu majiteli uvést tato skutečná omezení a konkrétní pokračování. Žádné další závody neoznačovat jako zveřejněné bez příjmu zápisu.

## Aktualizace po převzetí (18. 11. 2026 večer, druhá AI)

Hotovo od předchozího stavu. Typy a všech 2039 testů prochází. Nic z toho není commitnuté ani nasazené. Rozpracované soubory první AI jsou stále v checkoutu.

- **Švýcarské kódy kategorií.** `swisscycling.ts` čte `E M`, `E F` a `F E` jako elite, původní názvy řádků zůstávají. Test v `swiss-cycling-next-season.test.ts`. Do Mac runtime se změna zatím nepromítla, zkopírovat stejně jako ostatních 13 souborů.
- **Nové Město.** Zámek kategorií pocházel z automatické kontroly z 31. 10., ne od člověka. Kategorie `junior,u23,elite` jsou nyní `explicit` (potvrzuje UCI pro světový pohár i Junior Series), změna je zapsaná i v `event_overrides.fields` a v `event_facts`.
- **Fronta kandidátů.** Uzavřeno 13 snímků jako už pokrytých veřejným závodem (Neusiedlersee Radmarathon, ARBÖ Bad Kleinkirchheim, L'Étape Czech Republic, GP Berra Immobilier, 4 jours de Genève, Giro del Nord Ticino, Dornach-Gempen, Trofeo Tessile & Moda, VIVI Zuricrit). Nové čtení fronty: `node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/review-discovery-candidates.ts`, export `tmp/discovery-review.json`.
- **Místo z webu pořadatele u UCI.** Brána `validateReviewSource` nyní u `uci_directory` ověřuje i `fieldEvidence` (město z webu soutěže, citát, hash dokumentu). Skript `scripts/publish-uci-placed.ts places.json [--apply]`. Zveřejněno pět dráhových závodů: GP Junek Velodromes, GP Framar, GP Praha 10 (Praha podle praguetrack.cz) a 500+1 KOLO, Grand Prix Přilba Moravy (Brno podle favoritbrno.cz). Podklady `tmp/queue-cleanup-2026-11-18/czech-velodromes.json`. Obec Praha byla sjednocena z „Prague".
- **Čtečka UCI.** `harvest-uci-directory.ts` už nepřepisuje web, který se liší jen lomítkem nebo `www`. Předchozí verze to dělala při každém běhu a nasypala do `event_facts` 1022 zbytečných řádků metody `search_verified`. Smazány (jen shodné stránky, jen z dneška), data závodů se nezměnila. Silniční závody UCI nahrazují odhad i loňský údaj kategoriemi z UCI, u maratonů a závodů s přečtenými propozicemi ne.
- **Cache** po všech těchto změnách smazána pro 178 závodů a přehledy; ověřeno na produkci (West Bohemia, Nové Město, dráhové závody).

### Co zůstává

- Fronta po úklidu: asi 74 kandidátů. Většina jsou záměrně nezveřejněné UCI případy bez skutečného města (Hotel Perk, TBC, regiony, Fundacja, adresy v Itálii, Kostelecká 4468/49 u Prostějova, protože weby SKC Prostějov a Otmar Malečka se bez prohlížeče nenačetly). Brno `GP Brno track cycling` a `Gran Premio Ezio Del Rosso` nemají web pořadatele.
- Nezměněno: Märwil 8. 5., Gippingen 12. 6., Tamaro/Rivera 20.–21. 3., Gränichen 18.–19. 9., Tour de Suisse (muži a ženy), Tour du Léman, 3 jours de Genève, Bienne Crit, Serravalle, Mauren FL, Due Giorni del Mare, NoLimited Šamorín. Potřebují ověření na webech pořadatelů, ne odhad. Duplicity v katalogu u NoLimited Šamorín (dva záznamy téhož 7. kola) opravit slučovačem.
- Osm nových UCI závodů: propozice na jejich webech a 219 „nečitelných" zdrojů zůstávají jak v původním předání.
- Mac runtime: zkopírovat změněné soubory čteček, jinak se denní cyklus nezmění.

### Doplnění 19. 11. 2026

- Švýcarská čtečka odřezává kód kantonu z místa (`Carouge (GE) GE` je teď `Carouge, Switzerland`). Kódy GE, BE, LU, FR a GR se dřív četly jako stát a ingest závod odmítl jako mimoevropský. Díky tomu se zveřejnily 3 jours de Genève a Tour du Léman Juniors. Test je v `swiss-cycling-next-season.test.ts`.
- Tour de Suisse mužů je zveřejněný z UCI (`tour-de-suisse-2027`), agregátorový záznam `tour-de-suisse-stage-1-2027` je do něj sloučený.
- `harvest-uci-directory.ts`: skrytý dvojník neblokuje shodu s veřejným závodem, ženské a mužské závody se nespojují, UCI třída rozhoduje při shodě. `publish-uci-placed.ts` umí publikovat i bez doloženého místa.
- Zbývá: Bienne Crit (federace uvádí Bern), Tamaro/Rivera, Gränichen, Märwil, Gippingen, Serravalle, Mauren FL, Prostějov, Due Giorni del Mare, UCI případy bez skutečného města a propozice u nových závodů. Mac runtime stále potřebuje nové soubory čteček.

