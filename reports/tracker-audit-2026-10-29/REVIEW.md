# Revize původních 112 podkladů

Dokončeno 29. 10. 2026 16:29 (Europe/Prague). Navazuje na původní [opravu trackeru](REPORT.md).

Za provedenou revizi a doložené zápisy odpovídá Codex. Všech **112 původních podkladů bylo posouzeno**: **99 je uzavřeno**, **13 čeká na konkrétní chybějící důkaz**. To není tvrzení, že 112 závodů bylo věcně potvrzeno. Fronta obsahovala i historické opakování, nesportovní kurzy a modelové výstupy.

## Co se skutečně změnilo

- **9 nových ověřených závodů pro rok 2027** bylo zapsáno do produkce. Jedna již existující, skrytá časovka Banské byla opravena a obnovena. Každý z deseti výsledků má zdrojový snímek, explicitní rozhodnutí a záznam o identitě v `pipeline_candidates`.
- Opraveny byly dvě další identity: essenská RTF vrácena z chybného roku 2027 na pořadatelem doložený 23. srpen 2026; Gajary obnoveny na 19. září 2026 po přepsání jiným kolem stejného seriálu. Dvě nesprávně připojené zdrojové vazby byly vráceny ke správným závodům.
- U tří nových záznamů byly zvlášť uvedeny obec a místo startu: Humenné / Námestie Slobody, Stropkov / Námestie SNP, Rajecké Teplice / Kúpalisko Laura. Opravy místa zachovaly původní záznam pro dohledání.
- Změny ve třech existujících závodech a úpravy míst mají **18 položek historie `event_facts`**; další běžné zápisy mají svou standardní historii. Data nebyla hromadně mazána ani nejasné identity násilně slučovány.
- Rozhodnutí o stejných faktech zůstává platné i po změně obalu stránky či skóre modelu. Změna termínu, země, místa, disciplíny nebo jiného tvrzeného údaje může otevřít novou kontrolu. Ochrana je nasazená na serveru i v soukromém runtime Macu.
- Monitor počítá i stavy `waiting`, `conflict` a `publishing`. Vyřešení nové fronty tak neskrývá čekající případy.

## Rozdělení původní fronty

| Výsledek | Podklady | Význam |
|---|---:|---|
| Historické opakování | 65 | Minulé ročníky nejsou nový nález. Odmítnuto opětovné publikování; původní katalogová historie zachována. Nejde o nové ověření všech historických údajů. |
| Již existující závod | 15 | Doloženo, že stejné tvrzení nesmí vytvořit další kopii závodu. |
| Nahrazeno čerstvě ověřeným zápisem | 10 | Devět nových ročníků, jedna obnovená existující akce. |
| Doložená oprava původních údajů | 2 | Essen a Gajary. |
| Rozbitý výtah spojující dva závody | 1 | Mikołajki/Olsztyn; původní nejednoznačný záznam zůstává skrytý. |
| Stránka výsledků nebo kurz | 2 | Nejde o samostatný závod. |
| Duatlon mimo cyklistický rozsah | 3 | Odmítnuty opakované návrhy; historické údaje nesmazány. |
| Překrývající se souhrnný záznam | 1 | Jednodenní souhrn Oslany není doložen jako další samostatný cyklistický závod vedle ověřeného víkendu. |
| Čeká na konkrétní důkaz | 13 | Níže jsou jednotlivě popsány. |
| **Celkem** | **112** | **99 uzavřených + 13 čekajících.** |

Uzavřené původní návrhy zůstávají jako `rejected` s důvodem: u uskutečněného zápisu jde o nahrazení čerstvým podkladem, nikoliv o popření existence závodu. Jeden starší snímek Ondavského maratónu byl bezpečně nahrazen existujícím triggerem, ostatní rozhodnutí byla zapsána nástrojem pro revizi. Rozhodnutí jsou v [review-decisions.json](review-decisions.json).

## Ověřené veřejné závody

| Akce | Datum 2027 | Výsledek | Primární zdroj |
|---|---|---|---|
| [Humenský MTB maratón Singletracky Hubková 2027](https://letsrace.cz/cs/e/humensky-mtb-maraton-singletracky-hubkova-2027) | 2027-06-19 | Nový | [Zdroj](https://racetime.sk/terminovka) |
| [12. ročník Ondavský cyklomaratón](https://letsrace.cz/cs/e/12-rocnik-ondavsky-cyklomaraton-2027) | 2027-07-18 | Nový | [Zdroj](https://racetime.sk/terminovka) |
| [4. ročník Novoveský pojazd](https://letsrace.cz/cs/e/4-rocnik-novovesky-pojazd-2027) | 2027-07-31 | Nový | [Zdroj](https://racetime.sk/terminovka) |
| [19. ročník časovky do vrchu Jantex Banské - Mláčky](https://letsrace.cz/cs/e/19-rocnik-casovky-do-vrchu-jantex-banske-mlacky-2027) | 2027-08-15 | Obnoven existující | [Zdroj](https://racetime.sk/terminovka) |
| [ŠKODA MTB MARATÓN Rajecké Teplice 2027](https://letsrace.cz/cs/e/skoda-mtb-maraton-rajecke-teplice-2027) | 2027-05-22 | Nový | [Zdroj](https://www.bikepoint.sk/maraton/zakladne-informacie/) |
| [ISTROFINAL Snežnický MTB maratón 2027](https://letsrace.cz/cs/e/istrofinal-sneznicky-mtb-maraton-2027) | 2027-09-04 | Nový | [Zdroj](https://www.sneznickymaraton.sk/) |
| [Slovak National Championships - XCO/XCC](https://letsrace.cz/cs/e/slovak-national-championships-xco-xcc-2027) | 2027-07-17 – 2027-07-18 | Nový | [Zdroj](https://www.uci.org/competition-details/2027/MTB/80358) |
| [Sp XCO Zlatnicka Dolina](https://letsrace.cz/cs/e/sp-xco-zlatnicka-dolina-2027) | 2027-05-15 – 2027-05-16 | Nový | [Zdroj](https://www.uci.org/competition-details/2027/MTB/80679) |
| [Sp XCO Bystricany](https://letsrace.cz/cs/e/sp-xco-bystricany-2027) | 2027-06-05 – 2027-06-06 | Nový | [Zdroj](https://www.uci.org/competition-details/2027/MTB/80408) |
| [Sp XCO Oslany](https://letsrace.cz/cs/e/sp-xco-oslany-2027) | 2027-07-31 – 2027-08-01 | Nový | [Zdroj](https://www.uci.org/competition-details/2027/MTB/80410) |

UCI stránky nejprve nedodaly seznam kalendáře v samotném HTML. Ověření pokračovalo přes veřejné rozhraní, které používá vlastní web UCI; získaly se konkrétní detaily soutěží. Díky tomu byly dořešeny Zlatnícka dolina, Bystričany a Oslany včetně koncových dnů. Nebyly publikovány původní modelové výtahy s chybějícím druhým dnem.

## Zbývajících 13 podkladů

Jde o **12 věcných případů**: ČSC pumptrack má dvě zdrojová tvrzení. Každý podklad má v databázi stav `waiting`, vlastníka `Codex`, datum kontroly a konkrétní `neededEvidence`. Kontrola se může opakovat po získání uvedeného důkazu; v tomto chatu nebyla nastavena nová časovaná automatizace ani odeslána zpráva pořadateli.

| Podklad | Co chybí nebo je rozporné |
|---|---|
| [Zeitfahren Hintersee 2026](https://my.raceresult.com/382600/) (`cb504b8d`) | Časomíra má rok 2026 v názvu a datum 2027. Je potřeba aktuální vyjádření pořadatele k ročníku a termínu; záznam zůstává skrytý. |
| [SEVEROČESKÝ PUMPTRACKOVÝ POHÁR](https://portal.czechcyclingfederation.com/RaceDetail/Race/1695) (`0354f550`) | ČSC má začátek 26. 4. 2026 a konec 26. 4. 2025. Potřeba opraveného údaje svazu nebo jednoznačného programu pořadatele; záznam zůstává skrytý. |
| [Detská VRL — Šarišské Bohdanovce](https://www.soof.sk/podujatia-a-akcie) (`206f42f6`) | Stejný den a místo mají dětskou soutěž i dospělý gravel. Existující dětský záznam má smíšenou disciplínu a nesouvisející odkaz na propozice. Je třeba samostatných dětských pravidel/výsledků. |
| [BREZNIANSKY MTB MARATÓN 2027](https://www.bikepoint.sk/kalendar/september/18-09-2027/brezniansky-mtb-maraton-2027/) (`4ad37087`) | Pořadatel má zatím ročník 2026 nebo pouze obecný příslib roku 2027. Úplný termín 2027 uvádí jen agregátor; potřebujeme pořadatele, oficiální seriál nebo jeho registraci. |
| [MTB maratón Bike4you Hlohovec - Poniklec](https://www.bikepoint.sk/kalendar/august/21-08-2027/mtb-maraton-bike4you-hlohovec-poniklec/) (`074faf63`) | Pořadatel má zatím ročník 2026 nebo pouze obecný příslib roku 2027. Úplný termín 2027 uvádí jen agregátor; potřebujeme pořadatele, oficiální seriál nebo jeho registraci. |
| [POVAŽSKÝ MTB ŠPECIALIK](https://www.bikepoint.sk/kalendar/jul/04-07-2027/povazsky-mtb-specialik/) (`415144cf`) | Pořadatel má zatím ročník 2026 nebo pouze obecný příslib roku 2027. Úplný termín 2027 uvádí jen agregátor; potřebujeme pořadatele, oficiální seriál nebo jeho registraci. |
| [ŠKODA MARATÓN SLOVENSKÝ RAJ](https://www.bikepoint.sk/kalendar/jun/05-06-2027/skoda-maraton-slovensky-raj/) (`19815d62`) | Pořadatel má zatím ročník 2026 nebo pouze obecný příslib roku 2027. Úplný termín 2027 uvádí jen agregátor; potřebujeme pořadatele, oficiální seriál nebo jeho registraci. |
| [ŠKODA CYKLOMARATÓN TOPOLČIANKY](https://www.bikepoint.sk/kalendar/jun/19-06-2027/skoda-cyklomaraton-topolcianky/) (`0e13ed64`) | Pořadatel má zatím ročník 2026 nebo pouze obecný příslib roku 2027. Úplný termín 2027 uvádí jen agregátor; potřebujeme pořadatele, oficiální seriál nebo jeho registraci. |
| [Majstrovstvá Slovenska E-XC EBIKE CUP 2026](https://www.bikepoint.sk/kalendar/maj/06-05-2027/majstrovstva-slovenska-e-xc-ebike-cup-2026/) (`a5fe9884`) | Název uvádí EBIKE CUP 2026, datum 6. 5. 2027 a Skalicu. Bez konkrétního primárního dokladu jej nelze ztotožnit s jiným mistrovstvím 2027. |
| [Považský MTB ŠPECIÁL MARATÓN Považská Bystrica](https://www.bikepoint.sk/kalendar/jul/03-07-2027/povazsky-mtb-special-maraton-povazska-bystrica/) (`42d4cf90`) | Pořadatel má zatím ročník 2026 nebo pouze obecný příslib roku 2027. Úplný termín 2027 uvádí jen agregátor; potřebujeme pořadatele, oficiální seriál nebo jeho registraci. |
| [QUICK SPORT JARNÝ ŠPRINT](https://www.bikepoint.sk/kalendar/april/25-04-2027/quick-sport-jarny-sprint/) (`5629a8fe`) | Pořadatel má zatím ročník 2026 nebo pouze obecný příslib roku 2027. Úplný termín 2027 uvádí jen agregátor; potřebujeme pořadatele, oficiální seriál nebo jeho registraci. |
| [BikeFest maratón 2027](https://www.bikepoint.sk/kalendar/maj/30-05-2027/bikefest-maraton-2027/) (`506455da`) | Pořadatel má zatím ročník 2026 nebo pouze obecný příslib roku 2027. Úplný termín 2027 uvádí jen agregátor; potřebujeme pořadatele, oficiální seriál nebo jeho registraci. |
| [SEVEROČESKÝ PUMPTRACKOVÝ POHÁR](https://portal.czechcyclingfederation.com/RaceDetail/Race/1695) (`3bbea97f`) | ČSC má začátek 26. 4. 2026 a konec 26. 4. 2025. Potřeba opraveného údaje svazu nebo jednoznačného programu pořadatele; záznam zůstává skrytý. |

Celá databázová fronta nyní obsahuje **20 čekajících podkladů**: těchto 13 plus 7 dříve čekajících českých případů z jiné revize. Tyto starší případy nebyly součástí původních 112 a jejich dřívější rozhodnutí nebyla přepsána. Není otevřený žádný neroztříděný `pending`, `conflict` ani nedokončený `publishing` zápis.

## Ověření a nasazení

- **1 196 testů ve 175 souborech prošlo**, dále TypeScript a cílený lint. Nové testy odlišují změnu faktů od změny vzhledu zdrojového dokumentu, kontrolují zachování rozhodnutí a neztrácení evidence při chybě databáze.
- Živé ověření rozhodnutí proti produkční databázi proběhlo s technicky zablokovanými zápisy. Změna dekorace zdroje neotevřela znovu již posouzené standardní kandidátní identity.
- Všech **10 veřejných stránek vrací HTTP 200**, země je SK a celá vícedenní období jsou zachována.
- Autorizovaný provozní endpoint vrací **20 čekajících podkladů**, shodně s databází. Čekání nezmizelo z monitoru přesunem do stavu `waiting`.
- V celém veřejném katalogu nadále **0 konců před začátkem**, **0 budoucích akcí označených dokončeno**. To nepředstavuje novou věcnou certifikaci všech katalogových údajů.
- Finální nasazení **dpl_7qZBhknTtoT8TUruZ1wUFuGwu8XH**, READY, alias https://letsrace.cz. Nasazena byla izolovaná kopie předchozího ověřeného vydání s doplněnou ochranou rozhodnutí a opravou počítadla, nikoliv celý rozpracovaný checkout.
- Runtime Macu obsahuje shodnou ochranu rozhodnutí. Správce ani běžící skeny nebyly kvůli této změně zbytečně restartovány.
- Placené modely ani vyhledávací API nebyly spuštěny.

## Dohledatelné podklady

- [Výchozích 112 snímků](pending-before-review.json), [rozhodnutí pro každý podklad](review-decisions.json), [publikované výsledky](review-published-results.json).
- [Závěrečná databázová kontrola](review-final-verification.json), [veřejné HTTP a provozní ověření](review-public-verification.json).
- [Snímek před explicitními opravami](review-repairs-before.json), [transakční opravy](review-repairs.sql), [oddělení obce a místa startu](review-place-repairs.sql).
- [Testy](review-tests.log), [finální nasazení](review-deployment-final.log).
