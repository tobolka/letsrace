# Společné zveřejnění seznamu, mapy a kalendáře

## Oprava

Původní fronta kontrolovala jednotlivé detaily, ale samostatně uložená odpověď společného seznamu mohla zůstat stará. Přidána jedna trvalá dávka `catalogue:upcoming`, do které se slučují změny nadcházejících veřejných závodů, jejich míst a základních údajů seriálu. Běžné hlášení čtečky ji nevytváří.

Obnova používá samostatné označení společných přehledů i jejich veřejných odpovědí. Neobnovuje každý detail závodu. Dokončení vyžaduje shodu celého běžně dostupného seznamu s nezávisle načteným seznamem z databáze, včetně míst, termínů a chybějících záznamů. Změna přijatá během kontroly zůstane čekat.

## Provoz a limity

- Nejvýše jeden pokus za šest hodin a čtyři za posledních 24 hodin, společně pro Mac i server. Pád nebo neúspěch se počítá také.
- Samostatný denní serverový běh v 6:40 českého zimního času; na Macu je dávka hned na začátku cyklu. Vypnutý Mac nezastaví denní serverovou obnovu.
- Zachováno 60 pokusů o kontrolu jednotlivých detailů denně, i stávající finanční limity. Společná kontrola nevyprázdní frontu nezávislých kontrol detailů.
- Otevřená návštěva při dalším načítání po pěti minutách obnoví společný seznam, místo aby navždy používala první odpověď. Nejde o stahování celého katalogu každou minutu.

## Ověření před nasazením

- 1 414 testů ve 215 souborech, sestavení a kontrola změněného kódu prošly.
- Izolovaný PostgreSQL test: transakční vznik, slučování dávky, změna místa a seriálu, ignorování hlášení čtečky, souběžná změna, soukromý přístup a oba limity včetně neúspěšných pokusů.
- Migrace aplikovaná na produkční databázi; žádné závody se v ní nemění. Soukromé funkce nejsou dostupné běžným účtům. Kontrola zabezpečení nepřidala nové nálezy.

## Hranice

Kontrola prokazuje shodu společných dat pro mapu, seznam a kalendář s databází, nikoli pravdivost závodů vůči pořadateli ani vykreslení každé kombinace filtrů. Rozpracovaná kontrola všech zapisovačů, detailem navázaných údajů a nezávislé měření zůstávají samostatné úlohy.

Při návratu lze vrátit tento webový commit a Mac skript; trvalá čekající dávka zůstane v databázi pro další pokračování. Limity se při návratu nemažou.

## Produkce

Commit `ec8c8441`, Vercel `dpl_DZu3mwCXepdQC9cRpxh8VfikQvfV` READY. První skutečná dávka skončila `done` 2. listopadu v 21:23 českého času: 1 006 závodů, shoda `a0d366bbf81fc8810e0626a37d5814ff8628814951b3c24925be32c5e2ac4d26`. Žádné zápisy závodů. Následný běžný požadavek již dostal veřejnou uloženou odpověď (`HIT`); JBC i opravené Deštné jsou v ní. [Veřejný kontrolní výsledek](public-check.json).

V databázi je jeden pokus společné dávky a stále pouze původních 60 pokusů detailů. Čtečka na Macu aktualizovaná v 21:23; sdílené finanční záznamy a čekající práce zachované.
