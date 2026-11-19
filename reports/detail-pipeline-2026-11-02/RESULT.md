# Detail, sběr a počasí — 2. listopadu 2026

## Rozsah

Navazuje na dnešní změny až po `9d265e75`. Nejde o dokončení všech etap celkové přestavby pipeline. Převzetí závodu pořadatelem znamená správu údajů, nikoliv potvrzení pravdivosti všech údajů. Nový obecný systém ověřovacích statusů se nezavádí.

## Provedené opravy

- Doložené názvy kategorií z AI kalendáře se předávají do podrobných kategorií. Výslovně napsané vzdálenosti a věkové intervaly se zachovávají; číslo třídy ani ročník narození se za ně nevydávají. Samostatný úryvek musí patřit stejnému závodu a ročníku.
- Čtečka strukturovaných dat a AI kalendář mohou doplnit doslovný popis. Automatický zápis vyplní pouze prázdný popis mimo agregátory, respektuje ruční zámky a ukládá původní podklad. Nejde o automatické doplnění všech chybějících popisů ani o kopírování starých propozic.
- Úprava pořadatele zapisuje změny, podrobné kategorie, ochrany, historii a požadavek na zveřejnění v jedné transakci. Existující kategorie se stejným názvem zachovávají identifikátory a další atributy. Kontroluje se i výsledný rozsah termínu a aktuální oprávnění.
- Znovupodání zamítnuté nebo odebrané žádosti neobnoví přístup podle domény. Změnit rozhodnutí může správce.
- Veřejný odznak zní „Spravuje pořadatel“. Zobrazení neprohlašuje všechny informace za ověřené.
- Změny podrobných kategorií a veřejných odkazů na zdroje vytvářejí novou veřejnou revizi, i když se hlavní záznam závodu nezměnil.
- Sitemap odmítne neúplné čtení databáze. Selhání obnovy nepřepíše poslední platný soubor prázdným nebo částečným výsledkem.
- Doplňování z minulého ročníku a odkazy v detailu používají společné párování ročníků. Samostatné ročníky se neslučují. Nejednoznačnost nevytváří odkaz ani převzatá fakta. Stávající geografická pravidla se podle upřesnění uživatele nemění.

## Počasí

- Návštěvník nestahuje deset let historie. Čte uložené souhrny v databázi.
- Serverový běh `/api/cron/weather-history` je naplánovaný denně na 04:10 UTC. Doplňuje chybějící místa a období, další uzavřený rok obnovuje postupně. Není závislý na Macu ani Chromu.
- Stejné zaokrouhlené souřadnice sdílejí historii mezi závody a ročníky. Jednotlivá období mají vlastní referenční rok. Neúspěch ani částečná obnova nesmažou jiné poslední dobré období.
- Výchozí zdroj je Open-Meteo; při nedostupnosti může odpovědět bezplatný anonymní přístup Visual Crossing. Nepoužívá se účet, platební karta ani placený klíč. Požadavky `429` se neobcházejí.
- Předpověď má nejvýše 30 minut platnosti. Další uložení již staré odpovědi tuto dobu neprodlouží. Zobrazuje se čas **načtení**, nikoliv vymyšlený čas aktualizace modelu nebo záruka správnosti předpovědi.
- Zdroj je uveden u zobrazených dat. Při nedostupnosti blízké předpovědi se ukáže srozumitelná zpráva a odkaz na Windy. Neúspěšné načtení nezůstává navždy v paměti prohlížeče.
- Z historie se nepočítá chybějící déšť jako nula. Týden na začátku ledna zahrnuje i konec prosince. Do úplného souhrnu se přijímají pouze celé historické týdny.

### Skutečná zkouška poskytovatelů

Open-Meteo vracelo HTTP 503 s důvodem „The service is overloaded“. První doplňovací běh měl 12 neúspěšných rezervací a žádnou uloženou historii. To nebylo vydáváno za úspěšné doplnění.

Následná skutečná zkouška Visual Crossing pro bod 50.08, 14.44 a datum 7. 11. 2026 vrátila osm bodů předpovědi a deset úplných historických let do roku 2025. Zkouška nezapsala žádný závod. Na skutečném detailu Brněnského cyklokrosového poháru byla v prohlížeči ověřena předpověď, čas načtení, zdroj a tabulka hodin.

### Omezení úvodního naplnění

Historie ještě není uložená pro celý katalog. Počet rezervací je společně omezený na 12 míst za den včetně neúspěchů a pádů. Záložní čtení používá deset sedmidenních oken, nikoliv deset celých let, a v jednom pokusu doplňuje jedno chybějící období místa. Nevyřešená práce je vykázaná, neoznačuje se jako hotová. Dnešní první neúspěšné rezervace se nemažou kvůli obcházení limitu.

## Výchozí vyplněnost

Při úvodním čtení všech budoucích veřejných nesloučených závodů v databázi: 1 336 závodů, 574 s podrobnými kategoriemi, 562 se vzdáleností, 2 s číselnými věkovými hranicemi, 47 s popisem, 79 s uzávěrkou přihlášek. Jde o vyplněnost celého katalogu v okamžiku čtení, nikoliv nezávislé měření správnosti či pokrytí podporovaných zemí.

## Ověření

- Jednotkové testy, kontrola typů, kontrola kódu a produkční sestavení.
- Izolovaný PostgreSQL test pádu uprostřed úpravy, zachování identifikátorů kategorií, odebraného přístupu, soukromých oprávnění, výhradních rezervací, společného limitu a uchování starších souhrnů.
- Po databázových změnách nepřibyly proti výchozímu stavu nové bezpečnostní nálezy úrovně WARN/ERROR. Soukromé tabulky počasí a zapisovací funkce nejsou přístupné anonymním ani běžně přihlášeným účtům.
- Celá sada: 1 367 testů ve 204 souborech prošlo, produkční sestavení a kontrola kódu prošly. Samostatné databázové a integrační testy spravované čtečky prošly.
- Produkce `54ecbc42752374dd391ed45ff9043b89f56868e9`, nasazení `dpl_Ci4WmiVcYBhLkZ64PwdTbfQDn95k`, stav READY. Čtečka na Macu aktualizovaná 2. 11. 2026 v 15:47 českého času; stav `waiting`, automatika zapnutá. Odložení se uznává pouze s úplným závěrečným hlášením nula chyb, ne jen podle návratového čísla procesu.
- Na veřejném detailu Brněnského cyklokrosového poháru je zdroj Visual Crossing Weather, čas načtení a osm časových bodů. Opakovaný stejný požadavek vrací HIT; ukládání nepřidává další půlhodinu již staré odpovědi. Při přechodu na jiný závod se nepoužije počasí předchozího závodu.
- Rožmitál 2027 obsahuje skutečný odkaz na ročník 2026. Obě adresy vracejí 200 a každá má vlastní kanonickou adresu. Česká sitemap při veřejné kontrole obsahuje 1 769 adres.
- Zjištěná další chyba: skrytá adresa `litvinovice-2026` dříve vracela 308 na podobný veřejný závod bez potvrzeného sloučení. Známé záznamy nově nepřepisuje odhad podle adresy; skrytá adresa po opravě vrací 404. Cesta potvrzených sloučení zůstává samostatná.
- Dořešená poslední kontrola zveřejnění po opravě skryté adresy: jeden záznam zkontrolovaný, nula odložených, žádný zápis do závodů. Kontrola shody s uloženým záznamem není nezávislým důkazem správnosti zdrojových údajů.

## Dokumentace zdrojů počasí

- https://open-meteo.com/en/docs/historical-weather-api
- https://www.visualcrossing.com/resources/documentation/weather-api/free-weather-api-no-key/
- https://www.visualcrossing.com/resources/documentation/weather-api/timeline-weather-api/
