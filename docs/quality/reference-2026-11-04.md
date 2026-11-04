# LetsRace · zmrazená kontrolní sada P1.4a

4. listopadu 2026. [Data a zdroje](reference-2026-11-04.json) · SHA-256 `52d90d3c6923509a1b340467a23ee5d5667374f3776b3098fd3b2ce089e46bf7`

## Co sada obsahuje

| Země | Počet | Příklady a rozsah |
| --- | ---: | --- |
| Česko | 1 | Czech Tour jako celý silniční etapový závod |
| Německo | 3 | Gravel, silniční 24hodinovka a dětský závod na Nürburgringu |
| Rakousko | 2 | Wachau a Kufstein, silniční maratony |
| Polsko | 2 | Mazowiecki Gravel s novým místem, čtyřdenní Bike Adventure MTB |
| Slovensko | 2 | Samostatný zimní a letní MTB závod v Stupavě |
| Švýcarsko | 2 | Octopus Gravel a juniorský silniční Tour du Pays de Vaud |
| Itálie | 2 | Amatérský Gran Fondo Strade Bianche, víkend BMX ve Veroně |

Dále jsou uložené **dvě kontroly neslučování** a **pět kontrol hranic podkladů**. Například výběrové řízení nepotvrzuje obec konání, program roku 2026 na stejné stránce nedokládá starty roku 2027 a dětská nesoutěžní aktivita se nemá změnit na závod.

## Jak výsledek vyhodnotit

- Výběr začal u pořadatelů a federací. Termín, jednotka závodu a dostupné místo byly zapsané před porovnáním s katalogem. Fullgaz, Ötztaler a další známé případy použité při opravách slouží pro regresi. Wachau a Kufstein byly dříve uvedené v inventuře jako veřejné, dostupné záznamy je neuvádějí jako případy použité k ladění.
- Sada rozlišuje víkend, samostatnou soutěž a variantu. U Rad am Ring mají tři samostatné soutěže vlastní očekávaný výsledek. U BMX ve Veroně se hodnotí zastřešující víkend. Při pozdějším měření je potřeba samostatně zaznamenat, zda veřejný katalog víkend reprezentuje jednotlivými koly.
- Podpůrná URL dokládá očekávané údaje. Sdílený harmonogram sám o sobě neprokazuje totožnost záznamu. Názvové návrhy a případy bez jednoznačné vazby se posoudí zvlášť. Chybějící ověřená vazba ještě neprokazuje chybějící závod.
- Datum se hodnotí pro danou jednotku. Pokud zdroj neurčuje obec nebo jednotnou disciplínu, zůstává toto pole mimo hodnocení. Očekávané údaje se měří proti referenci z uvedeného data. Pozdější změny pořadatele mají vlastní záznam; původní snímek se zpětně nepřepisuje.
- Kontroly neslučování a hranic podkladů mají vlastní výsledky a jmenovatele. Zkouška případu, podle kterého se čtečka později upraví, přechází mezi regrese. Hodnocení přenositelnosti používá další nedotčené případy.

Lokální ověření formátu a otisku

```bash
node scripts/with-node.cjs tsx scripts/measure-reference-catalogue.ts --validate-only --reference=docs/quality/reference-2026-11-04.json
```

Při přípravě nevznikl katalogový zápis ani běh sběrače. Porovnání s katalogem, náklady a čas obsluhy patří do P1.4b. Tento první průřez pokrývá všech sedm zemí. Širší pilotní vzorek má samostatnou položku P1.4d.
