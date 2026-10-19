# Posouzení importu z 7. října 2026

Import umí získat velké množství zdrojů a jeho kontrola původu zachytává záměny závodů a ročníků. Slabinou je převod nalezených podkladů do užitečných údajů: samotné navýšení rozpočtu nepřineslo nové kategorie. Další investici má smysl zaměřit na společné propozice a přesnější reprezentaci kategorií.

## Co dokládají včerejší soubory

Poslední uložený snapshot obsahuje 1 119 závodů, z nichž 726 má uvedené kategorie (64,9 %), 578 registraci (51,7 %) a 317 propozice (28,3 %). Pole `complete` má hodnotu 247 (22,1 %). Jde o včerejší snapshot, nikoli nový výpis současné databáze. Odlišný přehled s 694 závody používá jiný výběr, a nelze jej přímo porovnávat.

Běh s vyšším rozpočtem od 10:26 do 10:42:

| Krok | Doložený výsledek | Reportované náklady USD |
|---|---|---:|
| Společné dokumenty seriálů | 0 kategorií, 0 propozic, 11 chyb | 0,1810 |
| Vyhledání webů pořadatelů | 1 web | 0,116 |
| Čtení stránek závodů | 0 kategorií, 3 propozice | 0,682 |
| Kategorie ze všech zdrojů závodu | 0 zapsaných sad | 0,4102 |
| Přiřazení seriálů | 1 závod | 0,007 |
| Kontrola duplicit | 1 sloučení | 0,369 |

Tyto částky jsou tehdejší reporty jednotlivých kroků; nejsou nezávislým fakturačním výpisem. Sdílený lokální ledger uvádí za 7. října celkem 2,237 USD za modely, bez samostatných nákladů Brave. Předchozí pokračovací běh doplnil kategorie třem kolům Afeno.

Archiv obsahuje 920 závodních dossierů a 7 133 dokumentů, s opakováním dokumentů mezi závody. 793 dossierů má příznak dokončeného sběru. Dokončený sběr sám nepotvrzuje správnost ani úplnost závodních údajů.

Podklady: [poslední běh](/Users/radektobolka/letsrace/tmp/refresh-budget-5x-2026-10-07.log), [pokračovací běh](/Users/radektobolka/letsrace/tmp/refresh-continue-2026-10-07.log), [snapshot](/Users/radektobolka/letsrace/tmp/coverage-after-budget-5x-2026-10-07.json), [ledger](/Users/radektobolka/letsrace/tmp/llm-budget.json).

## Opravy provedené lokálně

- Výchozí levný model je `claude-haiku-5-5`. Přepočet nákladů odpovídá novým cenám, včetně dražšího pásma nad 100 000 vstupních tokenů. Reporty čtení používají skutečně započtenou útratu místo pevných cen starého modelu.
- Krátká extrakce JSON má explicitně vypnuté přemýšlení a `medium` effort. Limity výstupu počítají s novým tokenizerem. Vyhledávání má adaptive thinking a `low` effort. Sonnet zůstává pro samostatnou kontrolu a rozhodování o duplicitách.
- Seriálový reader žádá odpověď podle pevného JSON schématu a čte celé dokumenty do 90 000 UTF-8 bajtů. Starý limit 14 000 znaků přeskakoval například JANEV a ProTour. Delší dokument se nekrátí, protože z výřezu nelze dokázat úplnost kategorií ani absenci výjimek.
- Seriálové dokumenty používají společnou lokální cache zdrojů s platností 24 hodin. Verdikty jsou verzované podle modelu a obsahu. Změna modelu nezaměňuje staré a nové verdikty.
- Ověřené společné propozice lze přijmout samostatně, i když je převod kategorií nebezpečný. Nejisté kategorie tím nezískají příznak `explicit`.
- Kontrola duplicit po vyčerpání rozpočtu skončí a uvede počet odložených dvojic. Původní kontrola názvu chyby nedokázala rozpoznat `LlmUnavailable` a pokračovací běh vykazoval 97 neúspěšných dvojic.
- Každý denní krok má vlastní záznam dokončení, zvlášť pro kontrolu a zápis. Selhání nebo vypršení časového limitu neoznačí krok za dokončený. Chyby seriálového readeru se nyní projeví také návratovým stavem procesu.

## Haiku 5.5: ověření na skutečných dokumentech

Oficiální cena je 0,10 USD za milion vstupních tokenů a 0,50 USD za milion výstupních tokenů do 100 000 vstupních tokenů. Nad tímto limitem je to 0,50 / 2,50 USD. [Anthropic: uvedení a ceny](https://www.anthropic.com/claude-haiku-5-5), [migrační pravidla](https://platform.claude.com/docs/en/models/haiku-5-5/migration-guide).

Čtyři archivované dokumenty dostaly oba modely ve stejném plném znění. Nový reader navíc využívá JSON schéma. Jde o malý praktický test konfigurací, nikoli obecný benchmark kvality modelů.

| Metrika | Haiku 5.5 | Haiku 4.5 |
|---|---:|---:|
| Náklady čtyř volání | 0,00526 USD | 0,04383 USD |
| Průměrná odezva | 2,16 s | 4,36 s |
| Platný JSON | 4/4 | 3/4 |

Celý placený test stál 0,04909 USD. Nová konfigurace byla 8,33× levnější. Ze vzorku nelze vyvozovat vyšší přesnost kategorií: žádné bezpečně přijatelné kategorie nevznikly.

Po opětovném ověření uložených odpovědí opraveným kódem:

- JANEV Cup: nový reader doloží společné propozice, nepovýší neúplné kategorie.
- ProTour Cyclocross Cup: společné propozice jsou ověřené; ročníky narození v sezóně 2026/27 se nepřevádějí automaticky na věkové pásmo podle roku 2026.
- Polish Bike Tour 2026: propozice pro rok 2027 jsou odmítnuty.
- Hardy Gravel: chybí doložená sezóna; návrh je odmítnut. Starý model navíc v tomto případě nevrátil platný JSON.

Výsledky jsou návrhy z archivovaných dokumentů, nikoli seznam současných chybějících polí v databázi. [Původní odpovědi a náklady](/Users/radektobolka/letsrace/tmp/import-model-benchmark.json), [ověření bez dalších placených volání](/Users/radektobolka/letsrace/tmp/import-model-replay.json).

## Doporučený další přístup

1. **Zpracování podle chybějícího pole a změny obsahu.** Z archivu vytvořit frontu konkrétních nedostatků, řazenou podle blízkosti závodu, kvality zdroje a počtu kol, která dokument doplní. Stejný nezměněný dokument číst jednou a výsledek ověřit pro každé příslušné kolo. Část této cache už existuje; chybí jednotná fronta napříč kroky.
2. **Uchovávat původní kategorii.** Vedle normalizovaných filtrů ukládat přesný název, ročníky narození či věkové intervaly, případný referenční rok, pohlaví, rozsah platnosti a citaci. Například polská kategorie „młodzik … 2013–2014“ nemusí mít bezpečný převod na jednu dnešní značku U13/U15. Její původní údaj je přesto užitečný. Navazující implementace z 8. října níže využívá existující tabulku kategorií a samostatný záznam důkazů; věkové filtry zůstávají založené na původních normalizovaných hodnotách.
3. **Oddělit nalezení, extrakci a kontrolu.** Levný Haiku čte podklady, deterministická pravidla ověřují citace, datum a rozsah. Sonnet dostává jen sporné návrhy. Nemá doplňovat chybějící důkaz z vlastní znalosti. U některých odmítnutí je nutné ověřit i příliš přísné požadavky auditora na už doložené federální názvy kategorií.
4. **Prohlížeč používat cíleně.** Nový browser use má smysl pro několik obtížných federálních portálů, rozbalovací kategorie a dokumenty dostupné až po interakci. Běžné HTML a PDF ponechat přímému čtení a cache. Nejdřív porovnat úspěšnost a cenu na konkrétních blokovaných zdrojích.
5. **Měřit přijatá fakta místo počtu volání.** Přehled má ukazovat cenu za ověřenou kategorii/propozici, důvod odmítnutí a počet odložených položek. Pro další kalibraci vybrat alespoň 30 ručně zkontrolovaných případů napříč zeměmi, zimními sezónami, dětskými kategoriemi a chybnými ročníky.

Kontrola: 46 cílených testů v 9 souborech, kontrola typů, cílený lint a kontrola shell skriptu prošly. Změny jsou pouze lokální, bez commitu a nasazení. Při této revizi nebyl proveden zápis do produkčního katalogu ani spuštěn nový hromadný import.


## Navazující implementace a ověření 8. října

Porovnání používá stejných **1 164 veřejných nadcházejících závodů** od 8. 10. 2026 do 8. 10. 2027. Jde o nově přečtenou databázi, nikoli srovnání s jinak filtrovaným včerejším snapshotem.

| Metrika | Před | Po | Přínos |
|---|---:|---:|---:|
| Závody s původními kategoriemi | 387 | 397 | +10 |
| Jednotlivé původní kategorie | 915 | 984 | +69 |
| Závody s propozicemi | 316 | 326 | +10 |
| Závody s normalizovanými kategoriemi | 733 | 733 | 0 |
| Závody s registrací | 576 | 576 | 0 |
| Počet závodů ve srovnávané skupině | 1 164 | 1 164 | 0 |

**Co se skutečně zapsalo:** 69 kategorií u 10 závodů a 10 odkazů na společné propozice. Každý z deseti zápisů kategorií prošel zpětným přečtením jmen, věků a pohlaví. Databáze obsahuje 10 aktivních důkazů `source_categories/original-categories-v2` a 10 důkazů `series_document/series-document-v3`. Kategorie mají citované zdrojové řádky, URL, explicitní ročníky narození a případné skutečně uvedené věkové intervaly. ProTour například zachovává „młodzik i młodziczka, rocznik 2013-2014“ bez automatického odvození U13/U15. Pilot zahrnoval CZ, PL, AT a jeden IT závod.

**Jak se přijímaly návrhy:** fronta z již nasbíraného archivu prioritizuje blízké závody s podklady a chybějícími údaji. Haiku hledá doslovné názvy, pravidla ověřují existenci citací a další model kontroluje rozsah a ročník. Z 30 položek ve zpřísněné dávce vzniklo 15 návrhů. Dva návrhy byly při následné kontrole vyřazeny (smíšená hlavička programu a nedostatečný důkaz ročníku). U tří dalších se při novém stažení změnil obsah, takže nebyly zapsány. Výsledek je 10 přijatých závodů, nikoli 15 automaticky úspěšných extrakcí. Všechny sady jsou vedené konzervativně jako neúplné a nemění normalizované věkové filtry.

Kontrola našla i chybu auditora: dokázal vrátit `keep=true` a současně v odůvodnění odmítnout jednu položku. Nový audit proto vyžaduje výslovné schválení každého jednotlivého názvu; samotný souhlas nestačí. Test pokrývá tuto chybu a nový kontrolní běh ji ověřil na ProTour za 0,02833 USD. Rollback původních kategorií pracuje se zaznamenanými ID a porovnává všechny původní hodnoty, aby nepřepsal pozdější opravy.

**Cena a rozhodnutí o dalším běhu:** nové modelové pokusy v této navazující části stály celkem přibližně **0,410 USD**, včetně první vyřazené extrakce, nezávislého auditu, negativních pokusů a přísnějšího opakovaného auditu. Samotné čtení společných propozic stálo 0,02028 USD a přineslo 10 odkazů; zápis z cache nepoužil model. Zpřísněné čtení 30 závodů stálo 0,07233 USD, nezávislý audit 0,22081 USD. Kontrola je nyní hlavní náklad.

Další dávka šesti závodů za 0,01783 USD přinesla **0 nových údajů**; na těchto zdrojích chyběl důkaz totožnosti/ročníku nebo přijímacích kategorií. Tento výsledek je důvodem, proč nový denní krok zůstává volitelný (`ORIGINAL_CATEGORY_IMPORT=1`), s výchozí dávkou 20 a celkovým stropem 0,40 USD. Nebyl zapnut nový pravidelný placený job. Výsledky čtení včetně odmítnutí jsou nyní uložené podle obsahu, konkrétního závodu, modelu a verze readeru. Opakování tří nezměněných odmítnutých podkladů prokazatelně stálo **0 USD**.

Nový postup má oddělené soubory návrhů, auditů a výsledků zápisu. Každý zapisovaný dokument se znovu stáhne a musí odpovídat uloženému otisku. Ruční uzamčení polí se ověřuje před zápisem, již existující kategorie se nepřepisují. Následný denní běh respektuje společný finanční ledger a nesmí označit nedokončený audit za úspěšný.

### Kontrola zdrojů a nové přístupy

Audit 28 aktivních federálních/kalendářových zdrojů porovnal 507 nadcházejících nabízených položek: 491 přesných kombinací externího ID a termínu má protějšek, 16 výskytů chybí. Po odstranění opakování mezi kalendáři jde o 13 kandidátů. To **není 13 prokázaných chybějících závodů**: například Ústecký kraj, Veselí nad Lužnicí a Achensee už v katalogu existují pod jiným zdrojem/názvem. Ternitz má listopadové zdrojové ID připojené k dříve sloučenému záznamu s jiným termínem; oprava sloučení vyžaduje samostatný review. Zanzenbergrennen, Kamptal Trophy a polský cyklokros 25. 10. zůstávají konkrétní kandidáti pro další kontrolu. Šest kandidátů je z IT kalendáře. Dvě URL Sumatoru pro 2027 vracejí 404.

Zdrojový audit byl upraven: celkové historické počty už nemaskují chybějící nové termíny. Výstup obsahuje konkrétní ID, datum, název a URL, takže lze projít kandidáty před vložením a zabránit duplicitám. V této části nebyly přidány další závody ani změněna sloučení.

Nasazení nového Anthropic browser/computer-use SDK zatím nemá změřený přínos: pro běžné podklady už funguje přímé stažení a PDF reader, dvě zjištěné chyby jsou 404. Smysluplný další experiment je omezená kontrola jednoho portálu s rozbalovacími kategoriemi a srovnání s přímým readerem; žádný plošný placený browser import nebyl spuštěn.

### Zobrazení a stav dodání

Původní kategorie se v lokálním webu zobrazují jako rozbalovací seznam „Kategorie podle pořadatele“, s upozorněním na úplný program v propozicích. Seznam, deep link a veřejný detail načítají stejné údaje. Ověřen skutečný mapový detail VELO Kladno při 1280 px i 390 px, včetně rozbalení; mobilní dokument nepřetéká do šířky. Při kontrole byl opraven i problém sestavení: Tailwind původně zahrnoval archivované HTML z `tmp/` a generoval neplatné cesty k cizím obrázkům. Nyní prohledává zdrojový adresář aplikace.

Data výše jsou již v produkční databázi. Změny readerů, denního postupu a zobrazení jsou zatím lokální, bez commitu, pushnutí a nasazení webu.

Podklady: [první skutečný zápis a srovnání](/Users/radektobolka/letsrace/tmp/import-validation/categories-applied.log), [propozice](/Users/radektobolka/letsrace/tmp/import-validation/series-applied.log), [audit zdrojů](/Users/radektobolka/letsrace/tmp/import-validation/source-yield.json), [nulový přínos druhé dávky](/Users/radektobolka/letsrace/tmp/import-validation/pipeline.log), [opakování bez placeného čtení](/Users/radektobolka/letsrace/tmp/import-validation/cache-replay.json), [desktop](/Users/radektobolka/letsrace/tmp/import-validation/categories-desktop.png), [mobil](/Users/radektobolka/letsrace/tmp/import-validation/categories-mobile.png).

Finální ověření: **808 testů ve 121 souborech**, kontrola typů, cílený lint, kontrola shellu a produkční sestavení prošly. Po poslední úpravě fronty prošlo dalších 7 cílených testů a kontrola typů. Nezapisující rollback preview našel všech 10 původních sad beze změny a jako vratné; nic neodstranil. Fronta už přeskakuje nezměněné odmítnuté dokumenty (390 → 387 položek po uložení tří odmítnutí), takže další dávku neblokují stejné neplodné zdroje.

Vizuální úprava podle následné zpětné vazby: mapová karta má nyní vedle věkových štítků pouze malé tlačítko s ikonou seznamu a počtem kategorií. Kliknutí/klepnutí otevře samostatný popover; Escape jej zavře a na desktopu vrací fokus na tlačítko. Na samostatné stránce závodu je seznam přímo viditelný. Ověřeno na skutečném desktopu i při šířce 390 px; mobilní popover má hranice 86–374 px a obsahuje všech 9 kategorií Kladna. Náhledy: `tmp/import-validation/categories-popover-desktop.png`, `tmp/import-validation/categories-popover-mobile.png`. Změna je lokální.

## Navazující ověření registrací a kalendářů

Následná kontrola 40 závodů doplnila po ruční kontrole citací a nezávislém auditu další dvě propozice (Wasgau, Thaur), žádnou registraci. Kamptal, Zanzenberg a polský závod 25. 10. jsou již zastoupené dvoudenními záznamy; nové položky nebyly potřeba. Ternitz má dva veřejné záznamy pro stejný víkend, návrh sloučení zůstává neprovedený. Nové měření, náklady a omezení automatického čtení jsou v [navazujícím reportu](entry-data-validation-2026-10-08.md).
