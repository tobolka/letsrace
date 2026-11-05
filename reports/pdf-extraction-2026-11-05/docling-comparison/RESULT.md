# Docling: skutečné porovnání rozběhnuté 5. 11. 2026

## Proč a co právě platí

Vlastník se výslovně ptal na Docling a požádal o pokračování; potom požádal **vše zapsat kvůli docházejícím kreditům**. Toto je průběžný checkpoint, nikoli konečný verdikt o nasazení. Původní `HANDOFF.md`, Claudovy rozpracované soubory i výsledky minulé kontroly zůstaly zachované.

Docling teď už byl skutečně spuštěn: **varianta s RapidOCR dokončila všech 13 dokumentů**. Srovnávací současná cesta unpdf + vlastní Vision dokončila stejných 13 dokumentů. **Varianta Docling + Apple Vision s celostránkovým OCR také dokončila všech 13 dokumentů. Žádný z těchto měřicích běhů už nečeká na dokončení.**

Žádný zápis do katalogu, placená AI, instalace do soukromého běhového prostředí, commit ani nasazení se v tomto kroku nedělaly. **Docling není zapojený do aplikace ani automatického sběru.**

## Nastavení a soubory

- Docling **2.148.0**, docling-core 2.106.0, rapidocr 3.10.0, torch 2.15.0; přesné již nainstalované balíčky lze přečíst přes pip ve virtuálním prostředí.
- Existující prostředí: `/private/tmp/claude-501/-Users-radektobolka-Documents-GitHub-letsrace/6153316b-b499-4955-aff7-7704997561f3/scratchpad/docling-venv`.
- Do něj přidané `ocrmac` a `onnxruntime` (nikoli do projektových závislostí). `setup.log` obsahuje výsledek.
- Pouze místní veřejné PDF z Claudova scratchpadu. `manifest.json` drží přesné cesty, původní URL a původní výstupy unpdf/poppler. Zatím je neuklízet; `/private/tmp` může později zmizet.
- 13 dokumentů / 40 vybraných stran: problematické skeny a tenký text z předání, plus tři textové kontroly. U XCO-NRW se porovnává jen strana 4, u českého BMX jen strana 7, ostatní se čtou celé.
- `benchmark.py`: opakovatelné nastavení Docling, CPU, čtyři vlákna, tabulky v přesném výchozím režimu, časový limit dokumentu 180 s. Modely se poprvé stáhly do `~/.cache/letsrace-docling-review` (ne do projektu). Lokální inferenční modely, nikoli placené vzdálené volání. První čas zahrnuje přípravu modelů; ostatní časy jsou se zahřátou čtečkou.
- `rapid`: RapidOCR, `lang=['en']`, výchozí výběr OCR oblastí. Není to tvrzení, že toto nastavení je nejlepší pro každý jazyk.
- `vision-full`: OcrMac/Vision, jazyky cs-CZ, pl-PL, de-DE, it-IT, fr-FR, en-US, `force_full_page_ocr=True`. Záměrně se čte celá stránka podobně jako v naší současné cestě.
- `baseline.ts`: aktuální unpdf + vlastní Vision, stejné vybrané strany. Může využívat existující uložené OCR výsledky, **jeho časy nelze přímo poměřovat s čerstvým Doclingem**. Původní Topoľčianky trvaly 66,7 s, další položky často čerpaly uložené výsledky.
- `baseline-*.txt`, `rapid-*.md/.txt`, `*-document.json`: skutečné výstupy; souhrnná čísla sama správnost nedokazují.
- `golden.json`: ručně zapsané očekávané údaje. `comparison-summary.json` shrnuje dosud dokončené běhy; obnovuje ho `summarize.py`.
- Vykreslené PNG Topoľčianek, BMX, polského Pucharu a Slovenského raje jsem vizuálně prohlédl podle skillu PDF. Nejde jen o počítání znaků.

## Dosavadní věcná zjištění

### České BMX, strana 7: tabulka

Před čtením výstupu Doclingu jsem podle obrázku zapsal 24 buněk (šest činností × čtyři kategorie), dva společné časy a názvy sloupců. Docling Rapid zachoval všech 24 buněk ve správných sloupcích. Získal jednu explicitní tabulku s čísly řádků a sloupců.

**Důležitá korekce interpretace:** současný unpdf zde také obsahuje všechny časy ve správném textovém pořadí. Přínos Doclingu je explicitní struktura, nikoli objevení 24 dosud nepřečtených časů. Ještě není doložené, že ji navazující extrakce praktických údajů opravdu využije lépe.

Markdown Doclingu spojuje první záhlaví a řádek „Otevření areálu 8:00“ do vícesložkového záhlaví (`Park Elite Muži - 8:00`); JSON zachovává samostatné buňky a sloučenou buňku 8:00. Pro další zpracování proto zkontrolovat JSON, nespoléhat jen na Markdown.

Většina hodnot jsou **časová rozmezí**, nikoli přesné časy startů. Současné datové schéma je neumí zobrazit jako rozmezí; v minulém kroku se naopak opravilo jejich chybné vydávání za přesný čas. Lepší čtení samo neřeší chybějící reprezentaci rozmezí.

### Topoľčianky, plakát

Ručně očekáváno 11 časů včetně dvojic 10:00/10:02, 10:30/10:32 a 12:00/12:02. Rapid správně přečetl všech 11. **Vynechal ale spodní termíny 24. 10. a 25. 10.**, které současný Vision zachoval. V plakátu není výslovně vytištěný rok; nedopočítávat jej z pořadí kola ani dne v týdnu.

První Rapid dokument: 83,55 s včetně přípravy modelů. Následná tabulka BMX: 1,32 s. Nezaměnit studený start za běžnou rychlost.

### Polský Puchar, sken, strana 3

Vizuální kontrola potvrzuje u Odprawa techniczna čas **09:00** a u Sprint drużynowy finał další den také **09:00**. Rapid oba převádí na **00:60**. To je skutečná chyba čtení, ne nový noční program. Časová validace ji musí odmítnout.

Dvě rozpoznané tabulky zachovávají prázdná časová pole u dalších disciplín; **nedoplňovat předchozí čas všem následujícím řádkům**. `golden.json` obsahuje kontrolní časované i nečasované řádky.

### Slovenský raj, plakát

Výchozí Rapid přečetl jen několik log a krátkých slov (63 znaků), vynechal název, datum 6. 6. 2026 i délky tras. Současný Vision je má: 68 km, čtyři varianty 54 km, 23 km, Family 7+ 9 km. Obrázek jsem prohlédl. Zde je výchozí Docling jasně horší. Následuje ověření celostránkového OCR; nevydávat výchozí nastavení za jedinou možnost Doclingu.

### Delší polské skeny

Docling má u několika dokumentů výrazně více textu než současná cesta (např. Moskava 12 399 vs. 2 032 znaků, Młodzieżowe Mistrzostwa 8 163 vs. 1 405). **To je vodítko k ruční kontrole, zatím ne prokázaný přínos správných údajů.** Prověřit, které strany či bloky současnému Vision chybějí, a jestli Docling navíc čte skutečné podmínky, ne jen šum.

## Co ještě nelze tvrdit

- Že Docling je celkově lepší nebo že se má plošně nahradit současné čtení.
- Že 13 úspěšných konverzí znamená 13 správně přečtených dokumentů. Rapid hlásí SUCCESS i u zjevně vynechaného plakátu a loguje prázdné OCR oblasti.
- Že je dosažených 95 % správných nebo úplných praktických údajů. Tato sada není nezávislým testem celého katalogu.
- Že je ověřený výkon Doclingu na GPU/MPS. Běží CPU varianta.

## Další krok a přesné pokračování

1. **Běhy jsou dokončené.** Přečíst `comparison-summary.json`, `vision-full.log` a uložené výstupy. Původní PID 81963 už není čekající úkol; nepoužívat staré PID k zastavování procesů.
2. Aktualizovat souhrn:

```sh
python3 reports/pdf-extraction-2026-11-05/docling-comparison/summarize.py
```

3. Neúplnou variantu lze spustit znovu; skript zachovává existující výsledky podle názvu a nevytváří je podruhé:

```sh
/private/tmp/claude-501/-Users-radektobolka-Documents-GitHub-letsrace/6153316b-b499-4955-aff7-7704997561f3/scratchpad/docling-venv/bin/python reports/pdf-extraction-2026-11-05/docling-comparison/benchmark.py vision-full
```

Nejdřív ověřit, že původní běh už neběží. Přesměrovat do **nového logu**, ne přepsat původní.

4. Volitelně zkusit `rapid-full 3,28,41` stejným skriptem. Režim je připravený, **zatím nebyl spuštěný**. Tím se ověří, jestli problémy plakátů způsobuje výběr oblastí.
5. Pro tři vizuálně kontrolované dokumenty porovnat přesné hodnoty a vazby buněk s `golden.json`. Zvlášť ztracená data, chybných 00:60 a nesprávně propagované časy. Pro delší skeny přidat vizuální kontrolu skutečně chybějících informací.
6. Teprve podle správných dodatečných údajů rozhodnout o selektivním zapojení Doclingu. Pokud nepřináší víc, nepřidávat těžkou závislost do běžné cesty. Pokračovat také hlavními úkoly v `docs/operations-progress.md`.

Podklad k použití a konfiguraci byl ověřen i proti oficiálnímu repozitáři: https://github.com/docling-project/docling . Detail API pro konkrétní nainstalovanou verzi byl čten z místního balíčku.


## Závěrečný stav checkpointu po doběhnutí

Všechny tři cesty dokončily 13 dokumentů / stejných 40 vybraných stran. První Docling Rapid běh včetně přípravy: 206,94 s dohromady, Docling Vision-full 117,90 s (z toho první plakát 74,83 s). Současná cesta 75,32 s **s využitím existujících uložených výsledků**. Z toho nelze férově stanovit poměr rychlosti.

- **Puchar:** Vision-full správně zachoval obě 09:00, které Rapid změnil na 00:60.
- **Topoľčianky:** Vision-full přečetl program, ale také vynechal spodní data 24./25. 10. Současný vlastní Vision je má. Ani celostránkové OCR samo nezaručuje, že je výsledný dokument zachová po analýze rozložení.
- **Slovenský raj:** Vision-full exportuje jen 46 znaků, opět bez názvu, data a tras. Současná cesta má 595 znaků s těmito údaji. Docling tedy není bezpečná plošná náhrada pro plakáty v těchto nastaveních.
- **BMX:** kontrola JSON proti 24 očekávaným buňkám dává Rapid 24/24. Vision-full má všech 22 časových rozmezí správně, ale dvě buňky s pomlčkou ponechal nereprezentované/prázdné, tedy 22/24 doslovných hodnot. Nevymyslel jim čas. Podrobnosti v `checked-bmx-cells.json`; tabulka má 9 řádků a 5 sloupců.
- **Delší polské dokumenty:** Vision-full zachoval 6 003 / 11 757 / 12 689 / 8 276 / 13 651 / 11 288 znaků (indexy 15/22/29/74/94/110) proti současným 1 970 / 4 694 / 2 032 / 1 405 / 3 561 / 3 736. Další věcná kontrola těchto pasáží je nyní nejdůležitější, aby se oddělily zachráněné informace od šumu či odlišné serializace tabulek.

**Rozhodnutí pro pokračování:** ponechat současnou cestu pro plakáty. Uvažovat Docling + Vision selektivně pro tabulky a dlouhé skeny, až kontrola doloží dodatečné správné údaje. Připravit přenos struktury tabulky do následné extrakce, jinak samotný nový čtenář ještě nezlepší užitečné informace pro závodníka. Integrace ani nasazení neproběhly.


## Oprava po kontrole (Claude, 5. 11. 2026)

Čísla „současné cesty“ výše jsou podhodnocená chybou vykreslování, ne slabostí Vision. `getDrawingTransform` stránku nikdy nezvětší, takže OCR dostával sken v 72 DPI. Opravené měření a verdikt: `../ocr-render-fix/RESULT.md`. Původní výstupy zůstaly beze změny.
