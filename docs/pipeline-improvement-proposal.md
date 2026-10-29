# Návrh zlepšení discovery, ingestu a deduplikace LetsRace

Datum: 23. 10. 2026. Stav: návrh k rozhodnutí, bez autorizace implementace nebo produkčních zápisů.

## Doporučení

Rozvíjet současný systém po malých, měřitelných krocích. Nejvyšší prioritu mají dohledatelné ztráty mezi nalezeným zdrojem a veřejným závodem, bezpečné přiřazování identity a společné využití již stažených dokumentů. AI používat jako čtečku obtížných zdrojů a pomoc při rozhodování; hodnoty a zápisy musí dál kontrolovat kód.

Úspěchem je více ověřených závodů, správnější údaje a méně ručních oprav za známou cenu. Samotné rozdělení souborů, více volání modelu ani více databázových zápisů nejsou produktovým výsledkem.

## Co zachovat a na čem stavět

- Watcher, stávající adaptéry a parsery velkých strukturovaných zdrojů.
- `event_sources`, `event_facts`, uchování zdrojových výsledků a existující rollback faktů.
- Aditivní slučování kategorií a respektování ručních zámků.
- Sběr dossiers, čtení PDF a sdílenou lokální cache dokumentů.
- Existující discovery přes `discovered_links` a správu zdrojů přes `watched_urls`.
- Existující hledání kandidátních duplicit, modelový judge a mechanismus review.
- Sdílený rozpočtový ledger, kontrolu citací a zpracování uložených důkazů bez nového placeného volání.

Tento návrh vychází z lokálního pracovního stromu, který již obsahuje rozpracované změny pipeline. Neoznačuje je za otestované nebo nasazené. Před implementací je potřeba určit, které části jsou dokončené, a navázat na ně bez vytváření druhé implementace.

## Výchozí stav a jeho omezení

Lokální report `reports/pipeline-refactor-2026-10-23/baseline.json`, zachycený 23. 10. 2026 v 16:10 UTC, uvádí:

| Ukazatel | Hodnota |
| --- | ---: |
| Nadcházející veřejné závody | 1 141 |
| Z nich s webem | 1 046 |
| Z nich s registračním odkazem | 526 |
| Běhy za posledních sedm dní | 1 068 |
| Zápisy či aktualizace za stejné období | 19 459 |

Jde o uložený snapshot, nikoli o nově ověřený stav produkce. Počet zápisů neříká, kolik přibylo unikátních závodů. Přítomnost odkazu neprokazuje jeho správnost. Chybějící registrace nemusí být chyba, pokud ji pořadatel ještě neotevřel. Úplnost známého katalogu není pokrytí všech závodů v zemi.

## 1. Ukázat, kde závody vypadávají

Rozšířit existující audit a provozní reporty o návaznost:

`nalezený odkaz → použitelný zdroj → přečtený závod → ověřený kandidát → existující nebo nový závod → veřejný záznam`

U každého neúspěšného kroku ukládat srozumitelný důvod: neznámý ročník, chybějící datum, neúplně přečtená stránka, konflikt identity, skrytý záznam, vyčerpaný rozpočet nebo technické selhání. Odlišit úspěšně přečtený prázdný kalendář od neúspěšného čtení a od stránky, která ještě nezveřejnila další sezonu.

Reportovat po zdroji, zemi, sezoně a metodě počet nových ověřených závodů, skutečně doplněných polí, konfliktů a náklady. Opakované nezměněné zápisy nezapočítávat jako přínos.

**Výsledek:** lze vybrat konkrétní největší ztrátu a ověřit její opravu. Stavět na `scripts/audit-pipeline.ts`, `source-yield` a stávajících statistikách, nejprve ověřit jejich aktuální chování.

## 2. Sjednotit ochranu identity a existujících údajů

Stejná pravidla musí platit při importu, přiřazení dalšího zdroje i pozdějším slučování:

- Externí ID je identita v rámci konkrétního zdroje a jeho pravidel pro ročníky; není globálním klíčem.
- Shodná URL, fingerprint, místo a blízké datum jsou vodítka. Samy neopravňují ke sloučení.
- Rozdílný ročník, kolo, samostatný formát nebo jiná jednoznačná identita blokují automatické sloučení. Oprava chybného data musí mít vlastní důkaz.
- Výrok modelu a jeho číselná jistota nemohou obejít konflikt identity.
- Nejasný případ musí skončit v trvalé frontě s důkazy a důvodem; nestačí výpis do logu. Využít existující review mechanismus a podle potřeby rozšířit jeho stavy.
- Rozlišovat sloučení dvou záznamů od vztahu festival–závod, seriál–kolo nebo závod–trať. Různé tratě automaticky neznamenají různé katalogové závody.

Autoritu údaje posuzovat podle původu, příslušnosti k závodu a ročníku a konkrétnosti důkazu. Metodu extrakce evidovat odděleně: model může číst oficiální dokument i agregátor. Novější datum stažení samo nepřebíjí správný oficiální údaj.

Slučování má zachovat zdroje, kategorie, zámky a historii. Před zapojením automatického apply ověřit konzistenci zápisu a auditu i při chybě nebo souběhu. Obnova sloučených záznamů vyžaduje vlastní ověření; rollback jednotlivých faktů ji sám nezaručuje.

**Výsledek:** nové importy neznehodnocují existující katalog a nejisté případy nezmizí bez rozhodnutí.

## 3. Zlepšit discovery na jedné prokazatelné mezeře

Rozšířit `discovered_links` o dohledatelné zpracování a výsledek místo zavádění druhé nezávislé fronty URL. Rozlišit kandidáta na zdroj od kandidáta na konkrétní ročník závodu.

Preferovat odkazy z ověřených federací, seriálů a pořadatelů. Vyhledávání používat cíleně pro kombinaci země, disciplíny a sezony, kde audit nebo nezávislý kontrolní seznam ukáže mezeru. Pozastavené zdroje nerozbíhat plošně; nejdřív zkontrolovat důvod pozastavení.

Výstup extrakce musí jít zkontrolovat před založením závodu: název, datum, zdroj, doklad ročníku, případná vazba na existující záznam a důvod nejistoty. Pro první pilot stačí uložený dry-run report; novou databázovou vrstvu zavést až podle potřeby provozního zpracování.

**Pilot:** vybrat 10–20 zdrojů v jedné zjištěné mezeře. Změřit nové ověřené závody, již známé závody, chybné kandidáty, cenu a čas potřebný na kontrolu. Větší rozsah schválit podle výsledku, nikoli podle počtu nalezených odkazů.

## 4. Využívat společné dokumenty a důkazy

Sjednocovat čtečky postupně nad existující cache a dossiers. Jeden stažený dokument má sloužit více čtečkám; společné sezonní propozice mohou sloužit více kolům, pokud je jejich platnost pro každé kolo ověřená a nejsou uvedené výjimky.

Oddělit cache dokumentu od cache jeho výkladu. Dokument identifikovat URL a otiskem obsahu; výsledek modelu navíc verzí čtečky, promptu, modelu a relevantním kontextem závodu. Změna promptu musí umožnit nové vyhodnocení stejného dokumentu. Nezměněný dokument nesmí způsobit přehlédnutí změněných vstupních údajů závodu.

Kontrola musí ověřovat nejen přítomnost citace, ale i její vztah ke správnému závodu, poli a ročníku. Konfliktní důkazy uchovat a použít explicitní pravidlo výběru; částečný seznam kategorií nesmí být vydáván za úplný.

**Výsledek:** méně opakovaných čtení a placených volání, lepší doplňování již známých závodů a vysvětlitelné opravy.

## 5. Rozhodovat podle ověřovacích sad a provozních výsledků

Připravit dvě oddělené sady uložených zdrojů:

- Nejméně 50 závodů napříč jazyky, zeměmi, HTML/PDF a dostupnými i chybějícími poli. Měřit správnost navržených hodnot i podíl údajů, které čtečka dokázala získat. Samotné odmítnutí všech hodnot nesmí vypadat jako úspěch.
- Samostatnou sadu dvojic pro identitu: skutečné duplicity i podobné různé závody, sousední kola, opakované URL, odlišné ročníky a festivaly. Zvlášť měřit chybné sloučení a přehlédnuté duplicity.

Oddělit příklady používané při vývoji od závěrečného ověření. Počáteční cíle: alespoň 95 % správných navržených hodnot pro každé pole s dostatečným vzorkem a žádné chybné sloučení v kritických regresních případech. Uvádět vždy počet hodnocených případů. Cíl 99 % precision pro automatické slučování nelze prohlásit za prokázaný na několika desítkách příkladů.

Sledovat také náklady na ověřený nový závod, náklady na správně doplněné pole, velikost a stáří fronty k rozhodnutí a počet pozdějších oprav. Porovnání před/po provádět na stejných zdrojích a stejném souboru závodů; růst katalogu vykázat zvlášť od změny úplnosti.

## Pořadí implementace

| Krok | Rozsah | Podmínka dokončení |
| --- | --- | --- |
| 0. Výchozí měření | Prověřit rozpracované změny, doplnit report ztrát a definice metrik | Vybraná konkrétní mezera s reprodukovatelnými příklady |
| 1. Identita a ochrana zápisů | Sjednotit kontrolní pravidla, trvalé odložení nejistých případů, audit slučování | Regresní příklady a dry-run bez chybného sloučení |
| 2. Discovery pilot | Navázat na existující frontu a ověřit 10–20 zdrojů | Report čistého přírůstku, chyb, ceny a kontrolní práce |
| 3. Dokumenty a evidence | Připojit jednu čtečku ke společnému vstupu a pravidlům důkazů | Správnost na uložené sadě a doložené omezení opakované práce |
| 4. Rozšíření podle výsledků | Zapojit další čtečky, cílený LLM judge nebo shadow srovnání parserů | Lepší měřený výsledek při zachování ochrany dat a rozpočtu |

Každý krok má být samostatně zkontrolovatelný a vypnutelný. Změny chování ověřovat na uložených vstupech a malém dry-run vzorku. Parsery a model porovnávat nad stejným dokumentem; větší počet extrahovaných položek sám neprokazuje lepší kvalitu.

## Rozpočet a provoz

Sjednotit deklaraci limitů: `docs/catalog-completeness.md` uvádí $0.50/den a $5/měsíc, zatímco lokální `refresh-data.sh` nastavuje výchozí $2.50/den a $25/měsíc. Jde o rozpor v současných podkladech, nikoli o návrh zvýšení. Před placeným pilotem určit platný schválený limit a nechat všechny vstupní body používat stejnou konfiguraci a ledger. Efektivní limit uvádět v reportu; nepředpokládat, že výchozí hodnota odpovídá skutečnému prostředí.

Po vyčerpání rozpočtu pokračovat bezpečným zpracováním uložených dokumentů a důkazů. Rozlišit dokončenou práci, chybu a práci odloženou kvůli rozpočtu nebo času; odložená položka nesmí být označena jako dokončená.

## Co teď nezařazovat

Kompletní přepis watcheru, náhradu velkých parserů modelem, nový obecný scraping agent, plošné hromadné slučování, redesign Explore ani nový admin dashboard. Nejdřív stačí čitelný report a potřebné doplnění existujících front. Velké soubory dělit při konkrétní změně chování, po zajištění odpovídajících regresních příkladů.

## Rozhodnutí po prvním pilotu

Pokračovat v té části, která prokáže nové ověřené závody, správně doplněná pole nebo menší opravnou práci při přijatelné ceně. Pokud pilot přinese hlavně již známé závody nebo drahou frontu nejistých případů, upravit výběr zdrojů a pravidla před rozšířením. Bez výsledku pilotu neslibovat procentní růst katalogu ani přesnou návratnost celého refaktoru.
