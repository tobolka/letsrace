# Produkční spuštění pipeline — 23. 10. 2026

Tento dokument doplňuje původní předprodukční REPORT.md. Kód je nyní na `main` a nasazený v produkci.

- Finální commit: `51821a01241257a7981640c2db2a9bd7923a7eff`.
- Vercel: `dpl_DwCocQPpnYWVYrXv27oqQJdxRvHm`, production, READY, build 67.3 s.
- Produkce: https://letsrace.cz (ověřené aliasy také www.letsrace.cz).
- Migrace `audited_event_merges`: aplikovaná verze `20261023191651`; lokální soubor odpovídá záznamu databáze.
- Nové tabulky cache a historie sloučení mají RLS a nejsou čitelné anonymními ani přihlášenými veřejnými klienty.
- AI klíč je bezpečně doplněný do produkce. Limity AI a kalendářové extrakce jsou každý 0.25 USD na proces, nikoliv společný měsíční limit účtu. Produkce používá databázovou cache.

## Ověření

- Finální revize: 160 souborů / 1 105 testů úspěšných, typová kontrola a lint změněných souborů úspěšné.
- Migrace a obnova sloučení ověřeny lokálně i proti skutečnému produkčnímu schématu uvnitř vrácené transakce. Syntetická testovací data nezůstala uložená.
- Tři registrované zdroje: dsergebnis.de, Oderský pohár na kolarna.eu a Stevens Cup.
- Poslední kontrolní průchod: 44 extrahovaných a 44 aktualizovaných záznamů; 0 nových, 0 chyb zápisu, všechny tři zdroje dočtené.
- Přímo v produkční serverless funkci byl následně znovu načten Oderský pohár: HTTP 200, 6 aktualizací, 0 vytvořených záznamů, 0 chyb, 1 zásah sdílené cache, vykázaná AI cena 0 USD. Ingest run `15263ff1-a833-430c-996e-74cdbff08e4b`.
- Ostatní tři původně zvažované klubové URL nebyly v registru pod přesnou adresou, a proto tento zápisový průchod neproběhl pro šest zdrojů. Nejsou započítané jako zpracované.
- Odhad AI nákladů tří lokálně spuštěných produkčních průchodů: 0.0134653 USD; nezahrnuje předchozí čtecí benchmark ani případné jiné procesy.
- Před a po: 5 966 veřejných nesloučených závodů, z toho 1 141 nadcházejících. Žádný čistý přírůstek nových závodů se z tohoto vzorku nepotvrdil.
- Skryté závody ACK Stará Ves I. a finále Zábřeh 28. 11. zůstaly skryté.

## Problémy nalezené během spouštění a opravy

První průchody vytvořily tři duplicity. Příčinou byl obecný nadpis „Termine 2026“ použitý jako seriál, párování různých dat přes společnou kalendářovou stránku a následné vytvoření nové kopie při nerozhodné shodě dvou kandidátů. Opraveno v kódu před finálním nasazením. Datum AI řádku omezuje kandidáty, obecné nadpisy nejsou seriály a nerozhodná silná shoda se odloží s `identity_review_required`.

Všechny tři nově vzniklé duplicity byly sloučeny do existujících závodů s historií a přesměrováním. Chybně přiřazený zdroj Zlatých Hor II. byl vrácen správnému závodu; u duplikátu Stará Ves II. bylo opraveno místo před sloučením. Obecný adresář propozic dsergebnis byl odebrán z dotčených nově aktualizovaných záznamů, nadpis kalendáře byl odebrán z názvů a jeho omylem vzniklý seriál byl skryt a odpojen. Zdroje a důkazy jsou zachované.

Audit sloučení:

- `1848a547-b1e1-4363-9d59-67b18e7c14e3`: Stará Ves II.
- `0db71c2b-7197-4aa6-bfa9-5d1a62546d02`: Stahnsdorf.
- `cc6b674a-9ceb-45ca-9e3f-1af421d78e96`: Donkey Creek Cross.

Obnova je podmíněná nezměněným stavem po sloučení; další úpravy mohou vyžadovat ruční kontrolu.

## Živá kontrola

- https://letsrace.cz/ — HTTP 200.
- https://letsrace.cz/api/events?catalogue=1 — HTTP 200, 822 položek veřejného feedu, obsahuje Stahnsdorf. Počet feedu má vlastní produktové filtry a není celkovým SQL počtem nadcházejících závodů.
- https://letsrace.cz/cs/e/bl-cyclo-cross-stahnsdorf-2026 — HTTP 200, správný název a datum 2026-11-14.
- Kontrola provedena přes ověřený Vercel konektor; běžné automatické HTTP požadavky z lokálního prostředí zachytil Vercel Security Checkpoint. Ochrana nebyla vypnutá.
- Cache `public-catalogue` byla invalidována po úpravách.
- Výpis chybových a fatálních runtime logů finálního deploymentu během kontrolního okna neobsahoval záznamy. To není dlouhodobá zátěžová zkouška.

Stávající denní cron konfigurace zůstává v nasazeném `vercel.json`: sledování zdrojů 05:00 UTC, katalog 05:15 UTC, objevování zdrojů 06:00 UTC. Nebyl spuštěn neomezený místní proces ani plošný import celého katalogu. Změny a pravidla budou používány při dalších bězích.

Podrobné výsledky jsou v `production-runs.json` a `production-serverless-proof.json`. Tyto závěrečné reporty jsou lokální artefakty; nasazený kód je uvedeným commitem.
