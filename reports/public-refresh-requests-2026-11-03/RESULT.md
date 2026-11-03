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
