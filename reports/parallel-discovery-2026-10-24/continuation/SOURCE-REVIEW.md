# OpenAI: kontrola zdrojů a předání do fronty

Prověřených je všech 82 původních zdrojových URL: 55 čtení je dokončených, 27 zůstává odložených kvůli nepřístupnosti, nepodporovanému dokumentu nebo neúplnému čtení. Přes následné odkazy vzniklo dalších 328 úloh. Fronta ještě není dočtená. Dokončené čtení samo nepotvrzuje autoritu ani identitu závodu.

## Konkrétní předání

Tři níže uvedené pořadatelské zdroje byly zapsány do produkční `discovered_links` ve stavu `pending`. Stav byl nezávisle znovu načtený z databáze. Žádné eventy nebyly zapsány, aktivovány ani opraveny. Změny kódu čtečky a srovnávání zůstávají místní; commit, push a nasazení neproběhly.

| Kandidát | Datum uvedené pořadatelem | Srovnání a další kontrola |
| --- | --- | --- |
| [Gracia Orlová](https://www.graciaorlova.cz/o-zavodu/) | 29. 4. – 2. 5. 2027 | Dohledaný ročník 2026; ověřit návaznost identity. Silniční etapový závod žen. |
| [Strunk Connect Lesák CUP](https://lesak-cup.cz/) | 28. 8. 2027 | Starší Lesák CUP 2026. Nový ročník je avizovaný v centru Červeného Kostelce; nepřebírat starý Bohdašín. |
| [Pražská 50](https://prazska50.cz/tiskova-zprava/) | 18. 9. 2027 | Starší záznamy jako Pražská padesátka, včetně hidden/merged. Přesné místo startu 2027 zůstává k ověření. |

Jde o kandidáty na chybějící ročníky, nikoliv schválené nové identity. Uvedené dohledání v katalogu není vyčerpávající rozhodnutí o všech možných aliasech. Aktuální srovnání zahrnulo všech 9 165 načtených záznamů, včetně starších ročníků, skrytých a sloučených položek.

## Rozpory se nepřepisují

- Road Stage Orlické hory: pořadatelská homepage uvádí 5. 6. 2027, nalezené záznamy RR 77 km v katalogu 6. 6. 2027. Kontrola musí odlišit formát, ročník a návaznost na profesionální závod stejného dne.
- Decathlon Cyklomaraton Hradec Králové: další kalendář uvádí 31. 5. 2027, zatímco CSV i katalog mají 30. 5. 2027. Sekundární zdroj není podkladem pro automatický přepis.

## Oprava čtečky

Při kombinování parseru a AI se nesmí důkaz počátečního data vícedenního závodu připojit k parserovému záznamu s jiným začátkem, byť rozsahy překrývají. Regresní případ Gracia Orlová původně zaměnil otevírací 29. 4. za závěrečný 2. 5. Navíc se obecná hlavička „O závodu“ už nepovažuje za název akce. Nová verze pipeline-v7 zachovala Gracia Orlová 29. 4. – 2. 5.; opravená extrakce byla přehraná z cache bez další placené modelové spotřeby.

Report nyní řadí každé tvrzení k možnému existujícímu ročníku, možnému chybějícímu ročníku, datovému/identitnímu rozporu, společnému zdroji, předběžnému datu nebo potřebné kontrole důkazu. Stejná doména je jen doporučení pro hledání aliasů, nikdy automatická shoda. Švýcarský závod s podobným jménem se nesmí stát českým datovým konfliktem.

## Stav automatického třídění

| Kategorie | Tvrzení |
| --- | ---: |
| identity_review | 29 |
| possible_existing_edition | 22 |
| out_of_scope | 112 |
| possible_date_or_identity_conflict | 2 |
| date_evidence_review | 7 |
| possible_missing_edition | 15 |
| shared_source_identity_review | 20 |
| tentative | 3 |

Počty jsou tvrzení z jednotlivých zdrojů, nikoli počty nových závodů. Automatický filtr nepozná všechny cizí země, sporty a aliasy; i položky mimo automaticky vyřazenou kategorii vyžadují kontrolu. Obě konfliktní situace výše zůstávají bez změny katalogu.

Ověření: 1 156 testů, kontrola typů a lint změněných souborů. Čtení těchto zdrojů stálo přibližně 0,142 USD nad rámec 0,214 USD za OpenAI hledání. Celý sdílený denní ledger je na 2,724 USD z jednorázově schválených 2,75 USD; další placené čtení v tomto běhu nebylo spuštěno.

[Strukturovaná kontrola a důkazy](openai-source-review.json) · [Všechna tvrzení a návrhy shod](openai-candidate-review.json) · [Ověřený zápis do fronty](reviewed-source-handoff.json)
