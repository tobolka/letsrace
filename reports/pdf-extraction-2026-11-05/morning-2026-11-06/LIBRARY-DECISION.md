# Rozhodnutí o knihovnách pro čtení závodů

Podklad k 6. 11. 2026. Předat dalšímu modelu tak, jak je. Nic z toho znovu neověřovat, pokud se repozitář mezitím viditelně nezměnil. Kde je napsáno „tvrzení autora“, není to důkaz správnosti.

Nejvíc správných údajů přidá dohledání dokumentu a zákaz přepisu už ověřené hodnoty. Nová čtečka PDF ani další knihovna na výstup z modelu to neudělají. Text z propozic už máme a model ho umí číst, když dokument vůbec najdeme.

## Jak číst verdikty

- **nasadit** — malá, ověřená náhrada kusu vlastního kódu.
- **vyzkoušet** — jeden den, měřitelné kritérium, bez zápisu do katalogu. Když kritérium nesplní, knihovnu nepřidávat.
- **nepoužít** — do aplikace ani do běhu na Macu nepatří.

Hvězdy, licence a data poslední aktivity jsou z GitHub API k 6. 11. 2026. Marker, MinerU, PaddleOCR a Surya nikdo nespouštěl. Jsou to velké modely a u stejné třídy úlohy už dopadl Docling hůř než současná cesta.

## Pět věcí, které udělat

1. **Vlastní pořadí zdrojů po polích.** Kalendář pak nepřepíše odkaz, datum ani registraci údajem z pozdějšího čtení. Žádná živá open-source knihovna to pro tenhle typ záznamů nedělá.
2. **Jednou projít známý web a sebrat z něj PDF a stránky závodů, pak je párovat datem a jménem.** Z 44 nejbližších závodů v Česku a na Slovensku má odkaz na propozice 12. Hledání po závodech na to nestačí a 1 000 dotazů měsíčně by při dvou dotazech na závod nestačilo ani na katalog.
3. **Platit model jen za nový nebo změněný text.** Jeden průchod 5 000 závodů při dnešních 0,2–0,5 centu stojí 10–25 USD. Měsíční strop je 5 USD. Opakované čtení stejného PDF se do stropu nevejde.
4. **Kontroly smyslu nad doslovnou citací.** Vstupenky nejsou startovné, „Statut závodu“ nejsou stanovy spolku, ředitel série není pořadatel kola. Knihovny hlídají tvar odpovědi, ne tento význam.
5. **Přezdívky z kalendáře série.** „TBC — Hůrka“ a „Hůrecký krpál“ jsou stejné kolo. Zapsat je ze stránky série dřív, než se pustí pravděpodobnostní slučování.

## Co se dnes změřilo

### Hůrecký krpál

`https://spsvd.cz/wp-content/uploads/2026/10/2026_Hurecky_krpal_cyklokros_propozice.pdf`

Textové PDF, 2 strany, Word pro Microsoft 365. pdfplumber 0.11.10 přečetl češtinu včetně „Hůrecký“, „žáci“, „Kč“. Startovné, harmonogram, tratě, parkování a kontakt v dokumentu jsou. Startovné vypadlo jako jedna buňka („registrovaní TBC 350 Kč / příchozí 500 Kč / …“). Harmonogram taky jako jeden odstavec („8:30 Otevření prezentace / 8:30 – 9:55 …“). Kategorie dětí se rozpadly do prázdných tabulek. Pro model, který cituje řádky, to není víc, než už dává textová vrstva.

### Janev Cup

`https://www.cyklokros.cz/files/rozpis-janev-cup-2026-cyklokros-v22.pdf`

8 stran, celá série, Word 2007. Jediná skutečná tabulka je seznam kol (datum, místo, název, kategorie). Strany s programem mají 0 tabulek: časy jsou odstavce („09:15 MLADŠÍ ŽÁKYNĚ“). Camelot ani pdfplumber z toho řádky harmonogramu neudělají. Metadata PDF říkají autora dokumentu, ne údaje závodu. Z dokumentu se smí vzít jen řádek daného data.

### Čtyři HTML stránky

JSON-LD typu Event není na žádné.

| Stránka | Co v ní skutečně je |
| --- | --- |
| `https://tbcserie.cz/kalendar-2026` | Kalendář je v HTML rovnou, 11 odkazů na kola, bez JavaScriptu. JSON-LD není. |
| `https://tbcserie.cz/kalendar-2026/zavod-203/` | Nadpis „Hůrecký krpál“, GPS, pořadatel SPSVD, věta „Statut závodu“. Open Graph ano, Event ne. |
| `https://mtbteam.cyklokyjovsky.cz/akce/cyklokros-slavkov-u-brna-2026/` | Yoast graf typu WebPage, doplněk The Events Calendar, odkaz na iCal. `datePublished` je 5. 10. 2026, tedy datum článku, ne závodu. |
| `https://www.ucicyclocrossworldcup.com/en/calendar/2026-2027/tabor-5` | 15 výskytů slova ticket a odkaz na vstupenky. Startovné tam není. |

iCal může potvrdit den. Startovné, kategorie a licenci z něj nebrat. The Events Calendar na zkoušené stránce Event do JSON-LD nedal.

### Datum, cena, telefon

Řetězce jsou z těchto dokumentů.

| Nástroj | Verze | Výsledek |
| --- | --- | --- |
| chrono-node | 2.10.3 | „7.11.2026“ přečetl jako 11. července, „3.10.2026“ jako 10. března. „Sobota 7. 11. 2026“, „7. listopadu 2026“ a „14.–15. 11. 2026“ nepřečetl. |
| dateparser | aktuální z PyPI k 6. 11. 2026 | Jen s češtinou dá „7.11.2026“ správně 7. listopadu. Se seznamem jazyků včetně angličtiny z toho byl 11. červenec. „14.–15. 11. 2026“ vrací jen 14. listopad, hledání rozmezí nenašlo nic. „10:00“ doplní dnešní datum. |
| price-parser | aktuální z PyPI | „350 Kč“ a „Startgeld 10,00 €“ co do částky sedí. Měna zůstává „Kč“, ne CZK. „zdarma“ je prázdné, anglické „free“ je částka 0. |
| phonenumbers | aktuální z PyPI, metadata Google | „731 402 943“ je platné české číslo +420 731 402 943. Stejně „+420 731 402 943“ a „00420 724 891 109“. |

Rozmezí „14.–15. 11.“ a „8:30 – 9:55“ má dál skládat vlastní kód. Časové rozmezí se nesmí uložit jako čas startu.

### Common Crawl

Nejnovější index je `CC-MAIN-2026-43` (`https://index.commoncrawl.org/CC-MAIN-2026-43-index`). Seznam indexů má 129 položek, nejstarší je CC-MAIN-2008-2009.

- `spsvd.cz/*propozice*` vrátilo HTTP 404.
- `cyklokros.cz/files/*janev*`, `tbcserie.cz/*` a `mtbteam.cyklokyjovsky.cz/*` skončily HTTP 504 zhruba po 10 sekundách.
- Přesnější dotaz `url=tbcserie.cz/` s `matchType=domain` vrátil `{"message": "No Captures found for: tbcserie.cz/"}`.
- Přesná adresa PDF Hůrky skončila HTTP 504.

Aktuální index tyto weby buď nemá, nebo na ně teď neodpoví. Na dnešní propozice malých sérií se spolehnout nedá.

### Docling, už změřený

5. 11. 2026, 13 dokumentů. Po opravě vykreslení nepřidal žádný správný údaj navíc a na plakátech byl horší než unpdf a macOS Vision. Podrobnosti v `reports/pdf-extraction-2026-11-05/docling-comparison/RESULT.md`. Znovu ho neinstalovat.

## A. Procházení a hledání dokumentů

Cena knihovny na vlastním Macu je 0. „Mac bez GPU“ je podle jazyka a dokumentace, ne podle instalace každé knihovny.

| Projekt | Odkaz | Aktivita | Licence | Jazyk | Mac bez GPU | Co řeší | Důkaz | Riziko | Verdikt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Crawlee | https://github.com/apify/crawlee | push 6. 11. 2026, vydání 3.18.2 z 29. 9. 2026, 26 354 hvězd | Apache-2.0 | TypeScript | ano | fronta, rozestup po doméně, pokračování po pádu | dokumentace autora, u nás neměřeno | překope funkční stahování | vyzkoušet na jednom webu série |
| Katana | https://github.com/projectdiscovery/katana | push 5. 11. 2026, 17 807 hvězd | MIT | Go | ano | seznam adres a PDF na známé doméně | dokumentace autora | bez prohlížeče mine čistě javascriptové kalendáře; pole nečte | vyzkoušet jako sběrač odkazů |
| Crawl4AI | https://github.com/unclecode/crawl4ai | push 4. 11. 2026, vydání 0.9.5 z 14. 10. 2026, 86 971 hvězd | Apache-2.0 | Python | ano, těžký prohlížeč | schéma stránky vyrobené jednou | README autora, přesnost neměřena | druhý Playwright vedle našeho; PDF nečte | vyzkoušet jen generování schématu |
| Scrapy | https://github.com/scrapy/scrapy | push 5. 11. 2026, 65 239 hvězd | BSD-3-Clause | Python | ano | totéž co vlastní stahování | dlouhá praxe, ne naše data | druhé prostředí, výměna něčeho, co už běží | nepoužít |
| Scrapling | https://github.com/D4Vinci/Scrapling | push 5. 11. 2026, vydání 0.5.1 z 4. 11. 2026, 98 461 hvězd | BSD-3-Clause | Python | ano | oprava selektoru bez modelu | dokumentace autora: podobnost prvků, bez AI | README prodává obcházení Cloudflare a dalších ochran. To je zakázané | nepoužít jako stahovač |
| Browsertrix | https://github.com/webrecorder/browsertrix-crawler | push 6. 11. 2026, 1 188 hvězd | AGPL-3.0 | TypeScript | ano | archiv celého webu | pro archivy, ne pro pole závodu | AGPL a jiný účel | nepoužít |

## B. Naučený postup na jeden web

Jediná cesta, jak neplatit model za každé kolo stejné série. Platí pro šablonu jako TBC, kde je 11 stejných stránek. Pro jednorázové PDF klubu se nenaučí nic: tam stačí text a jeden průchod modelem.

Vlastní adaptéry v `src/lib/watcher/extractors/` jsou přesně ten naučený postup. U webu s desítkami kol ve stejné šabloně se vyplatí. U stovek klubových PDF ne.

| Projekt | Odkaz | Aktivita | Licence | Jazyk | Mac bez GPU | Co řeší | Důkaz | Riziko | Verdikt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Crawl4AI `generate_schema` | stejný repozitář jako výše | viz výše | Apache-2.0 | Python | ano | z popisu polí vyrobí CSS schéma k opakování | věta v README, bez měření správnosti | schéma se rozbije při změně šablony a nepozná to | vyzkoušet na kalendáři TBC |
| llm-scraper | https://github.com/mishushakov/llm-scraper | push 26. 10. 2026, 6 951 hvězd | MIT | TypeScript | ano | vygenerovaný kód čtečky | README autora | samo o sobě neukládá citaci; bez uloženého kódu platí model pořád | vyzkoušet jen s uloženým kódem |
| AutoScraper | https://github.com/alirezamika/autoscraper | push 29. 7. 2026 je úprava README; poslední kód 8. 6. 2025, 8 074 hvězd | MIT | Python | ano | naučí se vzor z příkladu, bez modelu | starší praxe, dnes neměřeno | vývoj stojí; na PDF nic neumí | vyzkoušet na jednom HTML kalendáři, při prvním rozbití skončit |
| Stagehand | https://github.com/browserbase/stagehand | push 6. 11. 2026, 25 963 hvězd | MIT | TypeScript | ano | ovládání stránky modelem | README autora | každý krok může stát volání modelu; cloudový prohlížeč je placený | nepoužít |
| ScrapeGraphAI | https://github.com/ScrapeGraphAI/Scrapegraph-ai | push 6. 10. 2026, 32 556 hvězd | MIT | Python | ano | graf z modelu na každé čtení | README autora | cenu zvyšuje, nesnižuje | nepoužít |
| Skyvern | https://github.com/Skyvern-AI/skyvern | push 6. 11. 2026, 23 347 hvězd | AGPL-3.0 | Python | ano | obecný webový agent | marketing | AGPL, model na každý krok, cizí účel | nepoužít |

## C. PDF, tabulky, skeny

Současná cesta zůstává: `unpdf` pro textovou vrstvu, macOS Vision pro skeny.

| Projekt | Odkaz | Aktivita | Licence | Jazyk | Mac bez GPU | Co řeší | Důkaz | Riziko | Verdikt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pdfplumber | https://github.com/jsvine/pdfplumber | vydání 0.11.10 z 15. 6. 2026, push 15. 10. 2026, 10 879 hvězd | MIT | Python | ano | buňky tabulek | dnešní běh na obou PDF | startovné ani časy nerozdělil po řádcích | nepoužít jako náhradu textu |
| LiteParse | https://github.com/run-llama/liteparse | push 6. 11. 2026, npm vydání 2.18.0 z 4. 11. 2026, 12 990 hvězd | Apache-2.0 | Rust, je i Node | autor píše, že ano | text a souřadnice přes PDFium, volitelně Tesseract | README autora, nespouštělo se | Tesseract místo Vision na plakátech; README odvádí na placený LlamaParse | vyzkoušet jen souřadnice na textovém PDF |
| Marker | https://github.com/datalab-to/marker | vydání 2.1.0 z 29. 10. 2026, 40 790 hvězd | Apache-2.0 u otevřeného souboru LICENSE. Podmínky vah modelů se neověřovaly | Python | CPU jde, je pomalé; rozumně chce GPU | sazba a tabulky | tvrzení autora | stejná třída jako Docling, který na plakátech údaje ztratil | nepoužít |
| MinerU | https://github.com/opendatalab/MinerU | vydání 4.1.7 z 4. 11. 2026, 83 220 hvězd | Apache-2.0 plus práh 100 milionů uživatelů nebo 20 milionů USD měsíčního obratu. Nás se netýká | Python | prakticky chce GPU | skeny a tabulky | tvrzení autora, čeština neověřena | velké modely, druhá čtečka | nepoužít |
| Surya | https://github.com/datalab-to/surya | push 29. 10. 2026, 21 580 hvězd | Apache-2.0 | Python | chce GPU | detekce sazby a OCR | tvrzení autora | totéž co Marker | nepoužít |
| PaddleOCR | https://github.com/PaddlePaddle/PaddleOCR | push 16. 9. 2026, 92 353 hvězd | Apache-2.0 | Python | kola pro Apple Silicon se neověřovala | OCR | cizojazyčné žebříčky | druhý OCR vedle Vision, který češtinu už čte | nepoužít |
| Camelot | https://github.com/camelot-dev/camelot | vydání 2.0.0 z 4. 6. 2026, push 30. 10. 2026, 3 840 hvězd | MIT | Python | ano, chce Ghostscript | tabulky s čarami | program Janevu není tabulka | starší fork `atlanhq/camelot` stojí od 5. 1. 2023 | nepoužít |
| OCRmyPDF | https://github.com/ocrmypdf/OCRmyPDF | push 25. 10. 2026, 35 249 hvězd | MPL-2.0 | Python | ano | prohledatelné PDF přes Tesseract | pro archivy | nahrazuje Vision horším druhým OCR | nepoužít |
| Unstructured | https://github.com/Unstructured-IO/unstructured | push 6. 11. 2026, 15 685 hvězd | Apache-2.0 | Python; linguist ten den hlásil HTML | rychlá cesta ano, přesná chce model nebo jejich API | obecný rozklad dokumentů | README | přesná cesta je služba | nepoužít |
| PyMuPDF | https://github.com/pymupdf/PyMuPDF | push 6. 11. 2026, 11 077 hvězd | AGPL-3.0 | Python | ano | rychlý text | licence ověřená, kvalita ne | AGPL ve webové aplikaci | nepoužít |
| Docling | https://github.com/docling-project/docling | push 6. 11. 2026, 70 190 hvězd | MIT | Python | ano, CPU | totéž co současná cesta | naše měření z 5. 11. | těžká závislost | nepoužít |

## D. Vytěžení s důkazem

Kontrola v `src/lib/catalog/practical-extraction.ts` (verze `practical-v13`) už dělá to podstatné: číslo řádku se převede zpátky na text dokumentu a citace, která v něm není, se zahodí. Model smí pole vynechat. To žádná knihovna níže nenahradí. Významové záměny (vstupenka, statut, ředitel série) neřeší ani jedna.

| Projekt | Odkaz | Aktivita | Licence | Jazyk | Mac bez GPU | Co řeší | Důkaz | Riziko | Verdikt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LangExtract | https://github.com/google/langextract | vydání 1.7.1 z 8. 10. 2026, push 6. 11. 2026, 39 273 hvězd | Apache-2.0 | Python | ano, platí se model | rozsah znaků ve zdroji; co ve zdroji není, má prázdný interval | README autora | pořád se platí model; interval nepozná, že citace je vstupenka | nepoužít, důkaz už máme |
| Instructor | https://github.com/567-labs/instructor | push 5. 11. 2026, 14 098 hvězd | MIT | Python | ano | platný JSON | autor | důkaz ani význam nepřidá; Zod už je | nepoužít |
| BAML | https://github.com/BoundaryML/baml | push 6. 11. 2026, jazyk 0.25.1, 9 485 hvězd | Apache-2.0 | Rust, klient i pro TypeScript | ano | přísnější schéma a oprava tvaru | autor | nepozná špatný význam platné věty | nepoužít |
| Outlines | https://github.com/dottxt-ai/outlines | push 21. 9. 2026, 16 006 hvězd | Apache-2.0 | Python | jen pro lokální model | vynucený tvar u lokálního modelu | autor | Anthropic API to neumí použít | nepoužít |
| DSPy | https://github.com/stanfordnlp/dspy | push 6. 11. 2026, 38 957 hvězd | MIT | Python | ano | ladění promptu na sadě příkladů | autor | další runtime, dokud není zlatá sada | nepoužít teď |
| pydantic-ai | https://github.com/pydantic/pydantic-ai | push 6. 11. 2026, 21 052 hvězd | MIT | Python | ano | agenti | autor | neřeší citaci ani cenu | nepoužít |

## E. Normalizace

| Projekt | Odkaz | Aktivita | Licence | Jazyk | Mac bez GPU | Co řeší | Důkaz | Riziko | Verdikt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| libphonenumber-js | https://github.com/catamphetamine/libphonenumber-js | push 18. 6. 2026, 3 004 hvězd | MIT | TypeScript | ano | telefon pořadatele | Python obal stejných dat tři česká čísla z Hůrky přečetl. Samotný npm balíček těmi čísly neprošel | neřeší, komu číslo patří | nasadit na telefony, až stejné tři řetězce projdou v TypeScriptu |
| dateparser | https://github.com/scrapinghub/dateparser | push 5. 11. 2026, 2 863 hvězd | BSD-3-Clause | Python | ano | slovní názvy měsíců | dnešní běh | den a měsíc se prohodí, rozmezí ztratí konec, čas dostane dnešní datum | nepoužít jako autoritu data |
| chrono-node | https://github.com/wanasit/chrono | push 3. 11. 2026, 5 303 hvězd, npm 2.10.3 | MIT | TypeScript | ano | anglická data a časy | dnešní běh | prohodí 7. listopad na červenec | nepoužít |
| price-parser | https://github.com/scrapinghub/price-parser | push 2. 11. 2026, 348 hvězd | BSD-3-Clause | Python | ano | částka a měna | dnešní běh | „free“ se stane nulou, „Kč“ není CZK | nepoužít |
| libpostal | https://github.com/openvenues/libpostal | push 13. 5. 2026, 4 921 hvězd | MIT | C | ano, data mají přes 1 GB | poštovní adresa | na „areál lyžařského vleku, Hůrka u Jistebnice“ se nespouštěl | rozbije popis místa na falešnou ulici | nepoužít |

## F. Hotové struktury na webu

Na čtyřech zkušebních stránkách je pokrytí praktických údajů nula. Web Data Commons u vydání označeného 2023 uvádí 88 374 986 entit schema.org/Event na 402 077 hostitelích. To jsou světové weby, které Event samy zveřejnily, hlavně vstupenkové. Oznámení z 13. 1. 2025 popisuje výřez z Common Crawlu z října 2024. Že totéž číslo patří tomuto výřezu, se na stránce neověřilo. Pro klubové propozice z toho pokrytí neplyne.

Vlastní čtení JSON-LD je v `src/lib/watcher/extractors/jsonld.ts`. Bere jen typ Event, jméno a datum. To stačí. extruct by na zkoušených stránkách nenašel nic navíc.

| Projekt | Odkaz | Aktivita | Licence | Co řeší | Verdikt |
| --- | --- | --- | --- | --- | --- |
| extruct | https://github.com/scrapinghub/extruct | push 15. 10. 2026, 980 hvězd, BSD-3-Clause, Python | už čteme JSON-LD sami | nepoužít, dokud vlastní čtení něco míjí |
| metascraper | https://github.com/microlinkhq/metascraper | push 15. 10. 2026, 2 752 hvězd, MIT | titulek a obrázek | nepoužít |
| htmldate | https://github.com/adbar/htmldate | push 30. 10. 2026, 159 hvězd, Apache-2.0 | datum zveřejnění stránky | nepoužít |
| trafilatura | https://github.com/adbar/trafilatura | push 5. 11. 2026, 7 081 hvězd, Apache-2.0 | odřízne menu, zmenší text do modelu. Srovnání v dokumentaci je od autorů | vyzkoušet na 30 stránkách |

## G. Totožnost a slučování

Použitelná open-source knihovna, která vybírá hodnotu po polích a pamatuje si proč, není. Prošly Splink, dedupe, recordlinkage, Zingg, GoldenMatch (134 hvězd, MIT, push 6. 11. 2026, https://github.com/benseverndev-oss/goldenmatch) a `joesingo/truthdiscovery` (7 hvězd, GPL-3.0, poslední commit 29. 3. 2023). GoldenMatch slibuje zlaté záznamy. Srovnání, podle kterého poráží Splink, napsal jeho autor. Truth discovery je akademický kód, ne tabulka pořadí pro datum a odkaz.

Výběr hodnoty po polích zůstává vlastní kód. Na každé pole pořadí zdrojů. Kalendář nesmí přepsat údaj z propozic.

Rozlišení kola série od jiného kola je pravidlo, ne model: stejný seriál, stejný víkend a stejné místo je jedno kolo. Stejný seriál a jiný víkend je jiné kolo. Janev to v první tabulce říká sám.

| Projekt | Odkaz | Aktivita | Licence | Jazyk | Mac bez GPU | Co řeší | Důkaz | Riziko | Verdikt |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Splink | https://github.com/moj-analytical-services/splink | vydání 5.0.0 z 18. 9. 2026, push 5. 11. 2026, 2 563 hvězd | MIT | Python, umí Postgres | ano | návrhy dvojic | žebříčky autora; cizí srovnání je od autora GoldenMatch | sloučí dvě kola stejné série ve stejném městě | vyzkoušet proti 104 posouzeným dvojicím, nezapisovat |
| dedupe | https://github.com/dedupeio/dedupe | poslední commit 29. 7. 2025, 4 527 hvězd | MIT | Python | ano | učení z označkovaných dvojic | starší publikace | vývoj stojí, chce interaktivní značení | nepoužít |
| recordlinkage | https://github.com/J535D165/recordlinkage | poslední commit 20. 7. 2023; API hlásí push 21. 2. 2024, 1 067 hvězd | BSD-3-Clause | Python | ano | párování | — | opuštěné | nepoužít |
| Zingg | https://github.com/zinggAI/zingg | push 3. 11. 2026, 1 266 hvězd | AGPL-3.0 | Java | ano | párování ve Sparku | autor | AGPL, zbytečné na 5 000 řádků | nepoužít |
| GoldenMatch | https://github.com/benseverndev-oss/goldenmatch | push 6. 11. 2026, 134 hvězd | MIT | Python | ano | zlatý záznam | tvrzení autora o Splinku | žádné nezávislé měření | nepoužít |

## H. Hledání

| Zdroj | Odkaz | Stav k 6. 11. 2026 | Legálnost a stabilita | Verdikt |
| --- | --- | --- | --- | --- |
| Brave, už ho máme | https://brave.com/search/api/ | 1 000 dotazů v kreditu, pak 5 USD / 1 000. Číslo je z našeho nastavení a z ceníku; stránka se 6. 11. znovu neotevírala | smluvní API | nechat na závody, u kterých není známý web |
| Common Crawl index | https://index.commoncrawl.org/collinfo.json | viz měření výše | data jsou veřejná, index je pomalý a týdny až měsíce pozadu | vyzkoušet jen u známých domén, ne jako hledání závodu |
| SearXNG | https://github.com/searxng/searxng | push 6. 11. 2026, 39 276 hvězd, AGPL-3.0 | kód je volný. Automatické dotazy do Google a Bingu porušují jejich podmínky, i když mezi námi a nimi stojí SearXNG | nepoužít |
| Marginalia | https://github.com/MarginaliaSearch/MarginaliaSearch | push 30. 10. 2026, 2 221 hvězd, AGPL-3.0 | vlastní index malých webů, není to katalog PDF | nepoužít jako náhradu hledání propozic |
| Mojeek API | https://www.mojeek.com/services/search/web-search-api/ | Startup 2 GBP / 1 000 dotazů podle stránky zachycené vyhledáním 6. 11. Volný měsíční příděl se nenašel | placené, vlastní index. Pokrytí českých klubů neznáme | jen jako placená rezerva |
| Web Data Commons | http://webdatacommons.org/structureddata/schemaorg/ | hromadný výřez, ne vyhledávání jednoho závodu | legální výzkumná data | nepoužít pro dohledání propozic |

## I. Kvalita

Ruční kontrola se nedá zrušit. Dá se z ní udělat sada, proti které jede každá změna promptu. Platný JSON správný údaj nedokazuje. To už je v komentáři u schématu.

| Projekt | Odkaz | Aktivita | Licence | Co řeší | Verdikt |
| --- | --- | --- | --- | --- | --- |
| promptfoo | https://github.com/promptfoo/promptfoo | push 6. 11. 2026, 26 893 hvězd, MIT, TypeScript | stejný dokument, dvě verze promptu, vstupenka nesmí být startovné | vyzkoušet |
| Great Expectations | https://github.com/great-expectations/great_expectations | push 5. 11. 2026, 11 915 hvězd, Apache-2.0 | tabulkové kontroly ve skladu | nepoužít, na to stačí pár dotazů |
| Pandera | https://github.com/unionai-oss/pandera | push 4. 11. 2026, 4 518 hvězd, MIT | datové rámce | nepoužít |
| Soda Core | https://github.com/sodadata/soda-core | push 6. 11. 2026, 2 462 hvězd, Elastic License 2.0 | není otevřená licence v obvyklém smyslu | nepoužít |
| Langfuse | https://github.com/langfuse/langfuse | push 6. 11. 2026, 37 090 hvězd, jádro MIT, adresáře `ee/` zvlášť | chce ClickHouse | nepoužít, správný údaj nepřidá |

## J. Fronta na jednom Macu

Fronta je zbytečná, dokud jeden cyklus v launchd zpracuje dávku a chyba je v pravidle, ne v tom, že se úloha ztratila. Noční záznamy z 5. na 6. 11. ukazují sdílený čas stránky, falešný pokrok a neuzavřený stav. To pg-boss nespraví. Má smysl až ve chvíli, kdy se současně procházejí stovky domén a po pádu Macu musí každá doména pokračovat tam, kde skončila. Zápis je v `reports/pdf-extraction-2026-11-05/morning-2026-11-06/RESULT.md`.

| Projekt | Odkaz | Aktivita | Licence | Jazyk | Verdikt |
| --- | --- | --- | --- | --- | --- |
| pg-boss | https://github.com/timgit/pg-boss | vydání 12.38.1 z 5. 11. 2026, 4 125 hvězd, MIT | TypeScript, Postgres | nejdřív až po frontě domén. Teď ne |
| Graphile Worker | https://github.com/graphile/worker | push 5. 11. 2026, 2 436 hvězd, MIT | TypeScript | totéž, navíc cizí schéma. Nepoužít, pg-boss sedí blíž |
| DBOS | https://github.com/dbos-inc/dbos-transact-ts | push 4. 11. 2026, 1 433 hvězd, MIT | TypeScript | nepoužít |
| BullMQ | https://github.com/taskforcesh/bullmq | push 6. 11. 2026, 9 575 hvězd, MIT | TypeScript | nepoužít, chce Redis, který nemáme |
| Prefect | https://github.com/PrefectHQ/prefect | push 6. 11. 2026, 24 120 hvězd, Apache-2.0 | Python | nepoužít |
| Dagster | https://github.com/dagster-io/dagster | push 5. 11. 2026, 16 375 hvězd, Apache-2.0 | Python | nepoužít |

## K. Podobné projekty

Otevřený agregátor propozic pro Česko, Slovensko, Německo, Rakousko, Švýcarsko, Itálii a Polsko se nenašel. Nejnovější repozitáře na dotaz „cycling race calendar“ jsou tréninkové aplikace, hra na Critérium du Dauphiné a americký https://github.com/livlisko/race-tracker (0 hvězd, push 18. 7. 2026, čte BikeReg a newyorské kalendáře). Z toho se vzít nedá.

Učit se je z čeho už se čte: stránka série (TBC), rozpis celé série (Janev), časomíry a svazy, pro které existují vlastní čtečky. Janev je vzor dokumentu, kde v jednom PDF leží mnoho kol. Stránka světového poháru UCI je vzor pasti: veřejná stránka závodu prodává vstupenky a propozice tam nejsou.

## Placené služby

Oddělené od open source. Do stropu 5 USD měsíčně se nevejdou.

Firecrawl, veřejný ceník k 6. 11. 2026 (https://www.firecrawl.dev/pricing): 1 kredit za stránku, JSON navíc 4 kredity, Hobby 19 USD za 5 000 kreditů, Standard 99 USD za 100 000 kreditů. Pět tisíc stránek bez JSON je 19 USD měsíčně. Pět tisíc stránek se strukturou JSON je 25 000 kreditů, tedy Standard za 99 USD měsíčně. Osmistránkové PDF série stojí kredit za každou stranu. Kupovali bychom stahování, které na Macu je.

LlamaParse se na stránce výrobce 6. 11. neotevíral. Sekundární přehled, který cituje jeho dokumentaci (https://docuocr.com/llamaparse-pricing), uvádí 1,25 USD za 1 000 kreditů a u nejrychlejšího režimu 1 kredit na stránku, tedy 6,25 USD za 5 000 stran textu. Režim, který skládá tabulky modelem, je v tom přehledu 12,50 USD za 1 000 stran. Je to cizí přepočet, ne nabídka.

Mojeek Startup je 2 GBP za 1 000 dotazů. Pět tisíc dotazů je 10 GBP. Pět tisíc závodů při dvou dotazech je 20 GBP. Pokrytí klubových PDF neznáme, takže to není náhrada procházení známého webu.

## Pokusy na jeden den

Bez zápisu do katalogu. Když kritérium nesplní, knihovnu nepřidávat a vlastní kód nechat.

1. **Crawlee nebo Katana na TBC.** Vstup: `https://tbcserie.cz/kalendar-2026`. Úspěch: najde všech 11 stránek kol, které v HTML už jsou, po přerušení procesu pokračuje bez opakování hotových adres a mezi požadavky na stejnou doménu je mezera. Když to dnešní stahování umí taky, knihovnu nepřidávat.
2. **Schéma Crawl4AI nebo uložený llm-scraper na jedné stránce kola TBC.** Vstup: stránka kola a druhá stránka stejné šablony. Model smí běžet jen při výrobě schématu. Úspěch: z druhé stránky bez dalšího volání modelu vzejde název, datum, GPS a pořadatel, nula polí z jiného kola.
3. **AutoScraper na stejném kalendáři.** Úspěch: z příkladu dvou řádků vytáhne zbylých devět odkazů na kola. Když po drobné změně HTML vrátí cizí odkaz, smazat.
4. **LiteParse na obou PDF.** Úspěch: v textu je „Hůrecký krpál“, „350 Kč“, „7.11.2026“ a u Janevu řádek „3.10.2026“ / „Chýnov“, a ke „350 Kč“ existuje souřadnice na první straně. Když některý řetězec chybí, nechat unpdf.
5. **trafilatura na 30 uložených stránkách.** Úspěch: text je kratší aspoň o třetinu a žádná ručně označená věta se startovným, časem nebo místem nezmizí. Jedna ztracená věta znamená nepoužít.
6. **Splink offline na 104 dvojicích.** Úspěch: navrhne sloučení jen tam, kde už je řečeno „stejný závod“, a nespojí dvě kola téže série. Jeden takový návrh znamená nenasazovat. Výsledek nezapisovat.
7. **promptfoo na třech pastech.** Vstup: věta o vstupenkách z Tábora, „Statut závodu“ z Hůrky, věta o řediteli série, pokud ve zlaté sadě je. Úspěch: současný prompt všechny tři neuloží jako startovné, stanovy a pořadatele kola, a úprava promptu, která to rozbije, spadne. Cena běhu pod 0,10 USD.
8. **Common Crawl na 30 známých doménách.** Úspěch: aspoň 10 z 30 domén má v `CC-MAIN-2026-43` nějaké PDF a mezi nimi je dokument, který už bereme jako propozice. Když dopadnou jako `tbcserie.cz`, index do hledání nezapojovat.
9. **libphonenumber-js.** Vstup: „731 402 943“, „+420 731 402 943“, „00420 724 891 109“ a jedno německé a polské číslo z propozic. Úspěch: všechna platná se převedou na mezinárodní tvar a text, který číslo není, se zahodí.

## Architektura pro 5 000 závodů z 1 000 webů

Měsíc, ve kterém se čte jen změněné.

| Položka | Kdo | Odhad za měsíc |
| --- | --- | --- |
| Stažení známého webu, sitemap, odkazy na PDF, otisk textu | vlastní kód; Crawlee jen když jednodenní pokus vyhraje | 0 |
| Párování dokumentu k závodu datem, místem a přezdívkou ze série | vlastní kód | 0 |
| Pořadí zdrojů po polích, citace, zákaz přepisu | vlastní kód, u odkazu už rozjeté | 0 |
| Text PDF a skeny | unpdf a macOS Vision | 0 |
| Model jen na nový otisk | Claude Haiku. 200 změněných dokumentů × 0,2–0,5 centu | 0,40–1,00 USD |
| Hledání, jen když web neznáme | Brave, uvnitř 1 000 dotazů | 0 |
| Telefony | libphonenumber-js | 0 |
| Kontrola promptu | promptfoo, občas | pod 0,20 USD |
| Součet | | pod 2 USD, pokud se nečte celý katalog znovu |

Jeden nucený průchod všech 5 000 je 10–25 USD a do měsíčního stropu se nevejde. Proto otisk: stejný text podruhé model nevidí.

Pořadí zavádění:

1. Pořadí zdrojů po polích, ať další čtení neničí hotové údaje.
2. Sběr dokumentů z webů, které už známe, a přezdívky ze stránek sérií.
3. Otisk textu a platba modelu jen za změnu.
4. Tři významové kontroly a jejich zlatá sada.
5. Telefony, je to malé.
6. Splink až potom, a jen ke čtení.
7. Frontu v Postgresu až s hromadným průchodem domén.

## Co nedělat

- Nevyměňovat unpdf a Vision za Marker, MinerU, Surya, PaddleOCR, Docling ani Camelot. Na plakátech už jedna taková výměna údaje ztratila. pdfplumber nerozdělil ani startovné, ani časy.
- Neopírat data o chrono-node ani dateparser. Prohazují den s měsícem a z rozmezí udělají jeden den.
- Nebrat cenu z price-parseru. „free“ se stane nulovým startovným.
- Nečíst datum závodu z htmldate ani z `datePublished`.
- Nehledat propozice přes SearXNG a neobcházet ochrany, které inzeruje Scrapling.
- Nepouštět Stagehand, ScrapeGraphAI ani Skyvern jako čtečku.
- Nepřidávat Prefect, Dagster, DBOS ani Redis.
- Nenasazovat GoldenMatch, dedupe ani recordlinkage.
- Nedávat PyMuPDF do aplikace kvůli AGPL, když pdf.js už text čte.
- Nekupovat Firecrawl na 5 000 stránek za 19–99 USD měsíčně.

## Zdroje

- GitHub API k uvedeným repozitářům, 6. 11. 2026: hvězdy, licence, `pushed_at`, poslední vydání. U sporných licencí soubor LICENSE. MinerU: https://github.com/opendatalab/MinerU/blob/master/LICENSE.md
- Dnešní běhy: pdfplumber na obou PDF, stažené HTML čtyř stránek, chrono-node 2.10.3, dateparser, price-parser, phonenumbers. Common Crawl CC-MAIN-2026-43, viz výše.
- Měření Doclingu: `reports/pdf-extraction-2026-11-05/docling-comparison/RESULT.md`
- Noční běh: `reports/pdf-extraction-2026-11-05/morning-2026-11-06/RESULT.md`
- Crawl4AI README o `generate_schema`: https://github.com/unclecode/crawl4ai
- Scrapling adaptive: https://github.com/D4Vinci/Scrapling/blob/main/docs/parsing/adaptive.md — a zároveň nabídka obcházení ochran v README téhož projektu.
- LangExtract o `char_interval`: https://github.com/google/langextract
- Web Data Commons: http://webdatacommons.org/structureddata/2023-12/stats/schema_org_subsets.html a oznámení https://lists.w3.org/Archives/Public/public-schemaorg/2025Jan/0000.html
- Firecrawl: https://www.firecrawl.dev/pricing
- Mojeek: https://www.mojeek.com/services/search/web-search-api/
- LlamaParse jen zprostředkovaně: https://docuocr.com/llamaparse-pricing
- Srovnání GoldenMatch se Splinkem napsal autor GoldenMatch: https://dev.to/benzsevern/goldenmatch-vs-splink-vs-dedupe-vs-recordlinkage-a-practical-comparison-1akf
