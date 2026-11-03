# Vyžádání aktualizací oddělené od kontroly výsledků

3. listopadu 2026.

## Problém a změna

Cílené odstranění starého detailu se spouštělo až po převzetí úkolu ověření veřejné stránky. Fronta měla při kontrole 674 čekajících úkolů. Limit 60 pokusů o ověření denně tak současně brzdil samotné vyžádání aktualizace.

Nyní existuje samostatná trvalá dávka požadavků. Bere nejvýše 200 aktuálních verzí závodů, cíleně odstraňuje staré odpovědi pod jejich značkami a předá potvrzení o vyžádání. Potvrzení zapisuje pracovník až po úspěšném dokončení celé odpovědi služby. Pád či změna verze se znovu zpracují; neoznačují se za ověřenou stránku. Čekající úkoly ověření zůstávají zachované.

Nová dávka má nejvýše čtyři pokusy za posledních 24 hodin a nejvýše jeden za hodinu včetně chyb. Staré limity 60 kontrol detailů za den i čtyř kontrol společného seznamu zůstávají stejné. Nová cesta nečte zdroje ani nevolá placený model. Nespouští hromadné načítání detailů; stránky se sestavují při skutečné návštěvě.

Běh je zapojený před běžnou práci Macu i do existujícího denního serverového běhu. Vypnutý Mac znamená méně časté dávky, nikoli ztrátu úkolů. Admin ukazuje zvlášť počet nevyžádaných změn a počet vyžádaných změn čekajících na kontrolu.

## Ověření

- Izolovaný skutečný PostgreSQL test: 205 závodů → 200 potvrzených požadavků a 5 čekajících; všech 205 stále čeká na ověření.
- Souběžná nová verze se nepotvrdí starým podkladem; propadlé převzetí a soukromý přístup kontrolovány.
- Limity 60/den, 4/24 hodin a odstup pokusů zůstávají v databázi, nevynulovány.
- Čtyři testy pracovníka: úspěšná odpověď, chyba bez potvrzení, pokračování zbývající dávky, vyčerpaný limit.
- Relevantní předchozí testy zveřejnění, přehledu a společného seznamu: 19 úspěšných testů.
- Produkční sestavení a kontrola typů prošly. Migrace `20261103090530_separate_public_refresh_requests.sql` aplikována.

## Hranice

Požadavek není důkazem veřejného výsledku ani indexace Googlu. Kontroly detailů se dočerpávají v dosavadních limitech; čerstvější očekávaná verze může starší kontrolu nahradit. Tato změna nedokazuje úplnost a pravdivost katalogu ani nedokončuje původních sedm etap provozu.

## Ověření na produkci

Vydání `f07e269f` nasazeno, Vercel `dpl_GtS4bp4mDU3W1N9HUy1By8asT46V` READY. Skutečný první běh: 200 vyžádaných aktualizací, žádná z nich tím označena za ověřený detail. Databáze uchovává 200 potvrzení požadavků; následující kontroly běží samostatně. Produkční admin ověřen po přihlášení a zachycen v `production-admin.jpg`.

Při prvním běhu kontroly detailů prošly 4 z 10. Šest dalších správně vracelo 404 po sloučení do závodu mimo podporované země; kontrola chybně předpokládala veřejnou stránku jen podle viditelnosti cílového řádku. Opraveno posouzení skutečného cíle včetně země, statusu a běžných pravidel viditelnosti. Další živá dávka prošla 10 z 10 bez zápisu závodů. Osm testů kontroly zveřejnění a kontrola typů prošly.

Úplná sada po oddělení požadavků: 1 447 testů / 221 souborů. Pozdější cílená ochrana sloučeného cíle přidává jeden test; jeho úspěch se nevydává za nové úplné měření.
