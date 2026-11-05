# První skutečný průchod a provedené změny · 5. listopadu 2026

## Co je cílem

Dokončit malou dávku práce od zdroje až po veřejný detail. Nulový přírůstek není sám o sobě závada. Pokud pořadatel nic nového nezveřejnil, má být výsledek „zkontrolováno, beze změny“ a další kontrola má počkat. Odlišujeme nečitelný zdroj a údaje, které na zdroji jsou, ale čtečka je neuměla získat.

## První živý průchod: 08:33:29–08:34:08 CET

Běh na Macu, ručně vyvolaný v checkoutu po dnešním souhlasu vlastníka. Pravidelné scany zůstaly v pauze. Rozsah nejvýše čtyři sledované zdroje a osm detailů, bez placené AI; velká navazující údržba vypnutá.

| Výsledek | Skutečnost |
| --- | --- |
| Celková doba | 39 sekund |
| Sledované zdroje | 4; navíc jednou samostatný Racetime kalendář s deseti již známými tvrzeními, nula nových kandidátů |
| Nové závody | 0 |
| Skutečně změněné závody hlavního sběrače | 0; dva přijaté zápisy měly nulovou změnu |
| Omezení čtení | 2 nepřečtené zdroje; nezaměňují se za potvrzení absence závodu |
| Praktické údaje | 8 vybraných závodů, 7 přečtených detailů, 18 dokumentů, nula doplnění |
| Dokončená dřívější práce | 10 uložených úloh upozornění, 7 změn; není to sedm nových údajů v katalogu |
| Zveřejnění | 0 nově ověřených detailů, původní fronta 253 úloh zůstala; přerušení/limity se nevydávají za ověření |
| AI a placené hledání | 0 volání a 0 USD |

To není nezávislá zkouška celkového pokrytí. Prokázané problémy tohoto průchodu jsou níže; nulový počet nových závodů sám nedokazuje, že sběr nefunguje.

## Co běh skutečně odhalil a co se opravilo

1. **Zbytečné zdroje ve výběru:** automaticky přidané slavnostní vyhlášení Cyklománku a výsledková stránka Road Stage znovu zabíraly místa určená kalendářům. Stejná pravidla, která už brání jejich novému přidání, nově platí i při výběru existujících automatických zdrojů. Ruční zdroje, historické vazby a závody se nemažou. Žádná ze stávajících stránek nebyla touto opravou automaticky obnovena z pauzy.
2. **Čtečka neuměla běžné propozice:** Jičínské PDF skutečně uvádí pořadatele, místo konání i šest startů, ale bez řádku „Závod:“ je původní čtečka přeskočila. Nová větev ověřuje záhlaví s názvem a přesným datem, čte výslovného pořadatele a místo, rozlišuje páteční výdej čísel od sobotních závodů. Adresu kanceláře nevydává za areál. Časové rozsahy zatím nezkracuje na jeden čas. Kompletní český a anglický rozpis se stejnými starty se nemají zdvojit.
3. **Čtení bez výsledku vypadalo stejně jako chyba:** souhrn prvního průchodu se zachovává včetně jednoho nečitelného detailu a částečných čtení. Nedokládá, že na všech zbylých zdrojích nic není; nepodporovaná podoba dokumentu je samostatné omezení. Tato oblast není dokončená plošně.

## Konkrétní dokončené doplnění

Záznam `acfd9ef7-6c71-47d8-97f6-9f8fdddf1350`, **JANEV CUP 2026 / UCI C2 – Jičín**, 14. listopadu 2026:

- Areál Jičín–Šibeňák.
- Pořadatel CYKLOKLUB Jičín z.s.
- Šest startů: 09:10, 10:15, 11:00, 12:20, 13:20 a 14:30, s původními názvy skupin.
- U každého údaje je konkrétní zdroj; nic se nedopočítává z minulého roku.

Zdroje: [české propozice](https://www.cyklokros.cz/files/2026-11-14-jicin-c2-v10-final.pdf), [anglický průvodce](https://www.cyklokros.cz/files/race-guide-jicin-2026.pdf).

Cílené opakování zapsalo tři skupiny údajů do jednoho existujícího závodu, bez AI a bez nové identity závodu. Při první kombinaci obou jazykových průvodců vzniklo dvanáct programových řádků; před dokončením byly překlady odděleny od skutečných variant, šest přebytečných řádků odstraněno přes chráněný zápis s historií a ověřeno šest uložených i zobrazených startů. Toto je regresní příklad použitý při opravě čtečky, nikoliv nezávislé měření její kvality.

[Veřejný detail](https://letsrace.cz/cs/zavod/janev-cup-uci-c2-jicin-2026-11-14) v běžném HTML zobrazuje pořadatele, areál i všech šest startů. Při automatickém ověření se kontrolovala přímo sekce praktických údajů; streamovaný obsah Next.js může být mimo původní `article`. Zdrojové citace se nepočítají jako další programové řádky. [Výsledek kontroly](jicin-public.json).

## Jak se mění celý běžný průchod

- Běžný cyklus již nezkouší dočítat až 40 dávek za sebou. Má jednu omezenou dávku zdrojů a celkový strop 15 minut.
- Kalendáře dostávají většinu míst, ale část dávky zůstává pro stránky konkrétních závodů. Prázdná část se doplní ostatní vhodnou prací, stejný zdroj se nevybere dvakrát.
- Následuje samostatný čas pro praktické údaje a pro zveřejnění. Rozsáhlá denní údržba běží až poté; nemůže tyto části předem vyhladovět.
- Jednotlivé kroky mají vlastní omezení času včetně potomků. Vypršení znamená odloženou práci, nikoliv hotový výsledek. Čas a výsledek kroku se zapisují.
- Praktická čtečka sdílí dokumenty mezi závody a krátkodobě mezi běhy; při využití uloženého dokumentu jej znovu nestahuje. Konkrétní test ověřuje dva závody z jednoho stažení.
- Týdenní AI kontrola ročníků nesmí sama navýšit denní a měsíční limit. Ve výslovně bezplatném režimu se placená část nespouští.

## Spotřeba Vercelu a odstraněný zbytečný výpočet

Přímo v přihlášeném dashboardu: období **6. října – 5. listopadu, posledních 30 dní**, všechny projekty dohromady **9 h 28 min aktivního CPU / 4 h limit**. LetsRace tvoří **9 h 1 min (95,3 %)**. Nejde o čas dnešních scanů. Výpis CPU podle cest přes API v tomto tarifu vyžaduje placené Observability Plus; bez souhlasu se nic nekupovalo. Samotná celková čísla nerozdělují veřejný web a sběr.

V kódu odkazů na další ročníky byla násobná práce: každý budoucí kandidát prohledával znovu celý katalog, i když se název ani seriál nemohl shodovat. Nově se nejprve vyřadí tyto nemožné shody a původní důkladná kontrola se provede jen u možných identit. Pravidla místa, země, kola, disciplíny a nejasností zůstávají.

Místní porovnání původního a nového algoritmu na aktuálním veřejném německém snímku: **1 455 záznamů, 30 závodů × 5 ročníků = 150 kontrol; 4 716 ms → 64 ms; všech 150 výsledků stejných, tři nalezené odkazy**. Toto jsou místní časy jedné části na jednom vzorku, nikoliv naměřená úspora účtu Vercelu. [Výstup](edition-benchmark.json), opakovatelné porovnání `scripts/benchmark-edition-links.ts`.

## Co zůstává otevřené

- Změřit skutečný denní pokles CPU a databázového provozu po nasazení. Stejné funkční výsledky a lepší místní čas nezaručují celkový rozpočet.
- Rozšířit kontrolu čtečky na jiné dosud nepoužité propozice a více jazyků. Nelze tvrdit, že už umí všechen volný text, ceny nebo vícedenní program.
- Řídit další čtení podle novosti a výsledku zdroje, včetně smysluplného odkladu, když nové informace nejsou.
- Dokončit kontrolu zveřejňovací fronty a vysvětlit staré neověřené úlohy.
- Rozhodnout o postupném pravidelném provozu podle výsledků a spotřeby. Nové běhy jsou povolené, ale plošné spuštění současně na Macu i serveru zatím nemá doloženou spotřebu. Běžné scany zůstaly v pauze; dnešní běhy byly omezené a ruční.

Důkazy o ochranných opravách převzatého kódu jsou v [předchozím reportu](../takeover-review-2026-11-05/RESULT.md). Jediný aktuální a jednoduchý plán je [operations-progress.md](../../docs/operations-progress.md).

## Kontroly před vydáním

1 567 testů ve 235 souborech prošlo. Prošla kontrola typů, cílený lint a produkční sestavení. Zkouška časového stropu zastaví také potomka kroku; zkouška pořadí ověřuje, že po dávce zdrojů přijde doplňování a zveřejnění před rozsáhlou údržbou. Konkrétní commit a produkční nasazení doplní závěrečná kontrola.
