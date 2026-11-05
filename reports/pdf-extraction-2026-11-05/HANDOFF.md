# Předání: čtení propozic (PDF), 5. 11. 2026

Cíl majitele: nové/všechny závody, dobré údaje, bez duplikátů. Teď: vytáhnout údaje z propozic co nejblíž 95 %. Majitel je technický, ale chce, aby ses rozhodl sám: technické otázky neklást, rozhodnout, nést za to odpovědnost a česky oznámit. Zápis do produkční databáze jen po jeho výslovném souhlasu. Limity AI (0,50 USD/den, 5 USD/měsíc) nezvyšovat. What's new jen o aplikaci.

## Stav práce
Vše níže je NEULOŽENÉ v gitu (working tree, větev codex/scan-admin-seo-review), nenainstalované do běhového prostředí Macu a nic nebylo zapsáno do dat. Commit dfd837b6 je lokální, nepushnutý.

Změněné soubory: scripts/ocr-document.swift, src/lib/catalog/document-ocr.ts, regulation-ages.ts (pdfText, pageNeedsOcr, obrázky v readDocument), practical-extraction.ts (kontrola), practical-enrichment.ts (municipality, ownUrls), testy practical-extraction a practical-partial-read. Poslední běh 3 testovacích souborů: 18 prošlo. Po posledních úpravách pustit celé testy a tsc.

## Zjištěno
- Běžný text: unpdf a poppler (pdftotext -layout) stejné výsledky na 146 PDF (datum závodu 79/79, rozbité písmo 4/4). pdf-parse ani PyMuPDF tedy nejsou úzké hrdlo. PyMuPDF je navíc AGPL.
- Skeny: 10 ze 146 PDF (7 %) bez textu, hlavně pzkol.pl a cyklistikaszc.sk. Nové OCR přes macOS Vision (zdarma, jazyky cs, pl, de, it, fr, en; slovenština chybí) přečetlo 9 z 10 dobře, s řádky tabulek. Desátý (Topoľčianky) spadl na časový limit při studeném startu; limit zvýšen, znovu neověřeno.
- Jen 79 ze 146 čitelných PDF obsahuje datum závodu podle mého hrubého regexu. Nevysvětleno (formát data nebo jiný ročník/seriál).
- Docling: nainstalován v /private/tmp/claude-501/-Users-radektobolka-Documents-GitHub-letsrace/6153316b-b499-4955-aff7-7704997561f3/scratchpad/docling-venv, NETESTOVÁN. Porovnat na tabulkách a skenech (ocr-out.json, pdf-sample.json); nasadit jen pokud přečte víc než Vision. Scratchpad může zmizet, případně nainstalovat znovu.

## Měření extrakce (bez zápisu)
- Původních 12 závodů, offline přehrání: přijato 31, odmítnuto 12; většina zbylých odmítnutí je správná (peněžní ceny, cizí datum, Ternitz 00:00).
- Nových 36 závodů (0,085 USD, všechny s odkazem na propozice, ale i weby): přijato 51, odmítnuto 70. venue 15/7, organizer 13/17, schedule 11/19, fees 9/13, routes 3/14. Správnost přijatých zatím NIKDO nekontroloval čtením dokumentů. Procento 95 % zatím není doložené.

## Další krok: opravit falešná odmítnutí z practical-ai2.json
Přehrání zdarma: zkopíruj reports/pdf-extraction-2026-11-05/replay.ts.txt do scripts/.tmp-replay.ts a spusť
node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/.tmp-replay.ts <složka> practical-ai2.json v
(první argument je složka s JSON, tedy tato složka; po použití skript smaž).
1. no_quote (15): odpověď má hodnotu a citaci, ale selže rawFact (asi chybějící nebo null identity_quote/edition_quote či source_url). Zjistit a přijmout.
2. not_about_this_race (21): weby závodu (La Gloria, RACA 1000, Maštale, Rad am Ring). isOwnDocument vyžaduje datum na začátku; pro dokument z website_url/regulations_url závodu a stránky ze stejné domény to uvolnit, ale pozor na sdílené stránky seriálu.
3. bad_value (8): částka jako text "17.50", gpxUrl "", precision "area", řádek bez času. Opravit hodnotu, vadný řádek zahodit, ne celé pole.
4. values_not_supported (22): data slovem ("Samstag, 13. März 2027", "Saturday, 7 August 2027") nerozpozná quoteContainsDate; řádky 00:00 zahazovat po řádku; organizátor z "Kontakt:" nebo z webu; "2500 M" u trasy; "ca. 2550m". Prompt: čas 00:00 nevymýšlet; Audax Club Parisien a Cyclingaustria nejsou pořadatelé.
5. not_this_edition (4): sezónní řády ("2026-27", "2026/27") a "Regulamin_GKKiP_2027" uznat jako ročník.
6. Podezřelé "ceny" v regexu poplatků u fees: může chytit "ceny startovného". Ověřit.
Nechat odmítat: peněžní ceny jako startovné, cizí datum v dokumentu seriálu, organizátora z nesouvisejícího dokumentu.

## Pak
1. Přečíst sám vzorek přijatých údajů proti dokumentům a poctivě reportovat najdeme/přečteme/vytáhneme.
2. Zapojit enrich do local-cycle.cjs: vrátit extraEnv u run(), LOCAL_ALLOW_AI=1 jen pro tento krok; ověřit, že swiftc a OCR běží z běhového prostředí; zkontrolovat practical_details v local-fills.cjs; zvážit FILLED_RACES_PER_DAY. Instalace: node scripts/install-local-runner.cjs.
3. Hledání propozic u závodů bez nich (932 z 1 215): 44 % stránek bez data odkazuje na stránku s propozicemi, 20 % přímo na PDF. Obrázky na stránkách: embeddedDocumentText čte jen data: URI, ne img src.
4. Duplicity: 30 dvojic bez vyjížděk k posouzení (Lakeland GRVL, Rallye Sudety, Trofeo Cittadella, Sensor Cyklo Maštale aj.), proti serveru; slučovat vratně přes app_merge_events.
5. Facebook: vlastní stránka u 33 % stránek bez data; odhlášeně čitelná jen část a automatizace je proti podmínkám FB. Rozhodnutí majitele.
6. Testy pro OCR a nová pravidla, What's new (jen pokud uvidí uživatel), docs/operations-progress.md a RESULT.md, commit a nasazení se souhlasem.
Kontroly: přesměrování Wels, útrata za pár dní, datum Gravel Trans Jura, MSR Selce (dokument 6. 12., katalog 5. 12.).

Podrobnosti předchozí práce: reports/mac-offload-2026-11-05/RESULT.md, reports/codex-handoff-2026-11-05/HANDOFF-CLAUDE.md.

## Starší seznam práce (počty z 5. 11., znovu nezměřené)
- Čekající ročníky (212): přečteno 201, rozhodnuto 42. Zbytek na stránce termín tohoto závodu nemá; nové nálezy dál přibývají.
- Nečitelné weby (604): změřeno skriptem scripts/audit-unreadable-sources.ts, neopraveno.
- Závody bez webu (975): neřešeno.
- Nezávislá kontrola správnosti: náhodný vzorek 80 hotový (60 sedí, 1 podezřelý, 19 nejde ověřit). Správnost údajů z propozic ještě ne.
- Wels: čeká na ověření přesměrování.
- Kontroly (292): v předání nedoloženo, nejdřív zjistit stav.
- Změny již vyplněných hodnot: neřešeno, posílá se jen doplnění prázdných polí.
- Podezřelá spojení (43): neřešeno.
- docs/operations-progress.md: priority neodpovídají novému cíli, přepsat.
