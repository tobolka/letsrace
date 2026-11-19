# Rožmitálský cyklokros 2027 — 30. 10. 2026

## Provedeno v produkčním katalogu

- Nový samostatný veřejný závod `a3faee63-e883-4c08-b4cf-24a8d637bb90`, slug `rozmitalsky-cyklokros-2027`.
- Termín 16. 10. 2027, stav `scheduled`, sezóna 2027/28.
- Zdroj: https://rozmitalskycyklokros.cz/, načteno 30. 10. 2026 přibližně 09:34 Europe/Prague. Pořadatel v oznámení po osmém ročníku uvádí 16.10.2027.
- Název, dosavadní místo, disciplína a obecné zařazení převzaty ze samostatně zachovaného ročníku 2026 (`ccc98479-e044-4062-aac6-2e4111451862`). Věkové kategorie označeny `previous`.
- Registrace, termíny přihlášek, výsledky a propozice nejsou z roku 2026 kopírovány. Nový konec závodu není odhadnutý z minulého ročníku.
- Původ uložen v 11 záznamech `event_facts`; oficiální web jako kanonický `event_sources` a aktivní `watched_urls` (`8ce953b6-d3e0-4cfb-bfcb-76aff56abd6a`). Dříve byl sledován jen zdroj MTBS, nikoli oficiální web.
- Zápis je jeden atomický příkaz v `apply.sql`, s ochranou proti opakovanému založení stejného závodu.

## Ověření

Po zápisu znovu přečteny oba ročníky: 2026 zůstává dokončený s původním datem 17. 10. 2026 a původními odkazy. Nový ročník má správný termín a nemá starou registraci ani propozice.

Veřejná stránka https://letsrace.cz/en/race/rozmitalsky-cyklokros-2027 vrací HTTP 200 a zobrazuje Saturday October 16th, 2027, Rožmitál pod Třemšínem, Cyclocross a u kategorií „as last year“. Stránka výslovně uvádí, že online přihláška zatím není nalezena.

## Pokyny pro další práci

Obecná pravidla jsou v `AGENTS.md` a `docs/annual-editions.md`. Součástí místní změny je česká a anglická poznámka do `src/lib/release-notes.ts`. Kód webu ani poznámka nebyly v rámci tohoto zásahu nasazeny; závod je již dostupný díky změně katalogu. Nebyly spuštěny hromadné zápisy ani placené AI hledání.
