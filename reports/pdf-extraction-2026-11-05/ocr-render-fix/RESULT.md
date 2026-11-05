# Oprava vykreslení OCR a rozhodnutí o Doclingu · 5. 11. 2026

## Chyba
`scripts/ocr-document.swift` po přidání podpory otočených stránek předával `getDrawingTransform` celé plátno. Tato funkce stránku jen zmenšuje, nikdy nezvětší, takže sken skončil v 72 DPI uprostřed plátna. Vision pak četl rozmazaný obrázek. Testy to nezachytily, protože běžely bez skutečného vykreslení malého písma. Přidána samostatná zkouška `node scripts/test-ocr-document.cjs` (skutečný Vision, písmo 7 bodů, stránka rovně i otočená o 90°).

## Znaky: Codexova cesta / opravená / Docling + Vision
Indexy z `docling-comparison/manifest.json`. Výstupy opravené cesty: `baseline-*.txt` v této složce (při rozlišení 216 DPI).

| Dokument | Před opravou | Po opravě | Docling + Vision |
| --- | --- | --- | --- |
| 15 Puchar Polski | 1 970 | 4 048 | 6 003 |
| 22 Słubice | 4 694 | 10 937 | 11 757 |
| 29 Moskava | 2 032 | 10 348 | 12 689 |
| 74 Młodzieżowe MP | 1 405 | 4 897 | 8 276 |
| 94 Mieczysław | 3 561 | 11 682 | 13 651 |
| 110 Kielce | 3 736 | 8 072 | 11 288 |
| 3 Topoľčianky (plakát) | 449 | 790 | 366, bez termínů |
| 28 Slovenský raj (plakát) | 595 | 735 | 46, bez názvu, data a tras |

## Slova místo znaků
Na šesti dlouhých skenech má Docling stejně nebo méně slov (např. 473 proti 457, 1 293 proti 1 218, 949 proti 876). Přebytek znaků dělají značky tabulek v Markdownu. Slova, která má jen Docling, jsou téměř vždy jiná varianta téhož čtení, někdy lepší („paweł“), někdy horší („fundacia“). Žádný nový odstavec, termín ani částka.

## Vizuální kontrola proti obrázku stránky
- Moskava, strana 2, startovné: všech 8 řádků správně a v řádcích v obou čtečkách (60, 60, 50, 30, 15, 25, 90, 80). Obě čtou v tisku slovo „Opłata“ jako „Oplata“.
- Młodzieżowe MP, strana 3, program: řádky času, disciplíny a kategorie sedí v obou čtečkách; Docling navíc dává mřížku tabulky.
- Puchar, strana 3: obě 09:00 správně po opravě. Řádky bez času zůstávají bez času.
- Topoľčianky: všech 11 časů i termíny 24. a 25. 10. čte jen naše cesta.

## Rozhodnutí
**Docling do projektu nepřidávat ani selektivně.** Nepřináší žádný doložený správný údaj navíc, je to těžká závislost (torch, modely) a na plakátech je výrazně horší. Vrátit se k němu má smysl jen tehdy, když extrakce ukáže konkrétní tabulku, kterou naše řádky nedokážou vyjádřit.

## Další nastavení OCR
- Pořadí jazyků ani automatická detekce výstup nemění (stejný text v jediné variantě kromě 11 znaků), takže zůstává společný seznam.
- Vyšší rozlišení pomáhá: na šesti polských dokumentech v kontrolním seznamu slov 123 správných a 35 chybných při 216 DPI, 128 a 24 při 324 DPI, čas srovnatelný. Nasazeno 324 DPI (nejdelší strana nejvýš 3 800 pixelů). Toto je malý ladicí seznam, ne měření přesnosti.
