# Registrace, propozice a pokrytí kalendářů — 8. 10. 2026

## Skutečný výsledek v databázi

Stejný kontrolní vzorek obsahuje **226 veřejných aktivních závodů** v CZ, SK, AT, DE, PL a CH s termínem v příštích 30 dnech.

| Údaj | Před | Po | Ověřený přínos |
|---|---:|---:|---:|
| Závody s propozicemi | 90 | 92 | +2 |
| Závody s registrací | 122 | 122 | 0 |

Nové propozice:

- **Wasgau-Bike-Marathon, 10. 10. 2026:** https://www.wasgau.bike/ausschreibung/ — pořadatelovy podmínky, harmonogram, poplatky a datum konání.
- **Cycling Cup Thaur, 11. 10. 2026:** PDF „Ausschreibung Rennrad (>U13)“ z aktuální stránky pořadatele. Dokument pokrývá silniční část programu; netvrdíme, že obsahuje MTB pravidla. URL a doslovné citace jsou v uloženém plánu.

Oba zápisy doplnily pouze prázdná pole. Před uložením se znovu načetly zdroje, porovnal se jejich obsah, ověřil se termín, skutečný odkaz a lidské zámky. Po uložení proběhlo zpětné načtení a samostatná kontrola dvou záznamů `event_facts`. Žádný nový závod se nevytvářel a žádné sloučení neproběhlo.

## Co experiment skutečně ukázal

Prvních 20 a dalších 20 nejbližších závodů nepřineslo automaticky schválený zápis. Dvě doslovně doložené nabídky registrace odmítla obsahová kontrola: Zossen měl online přihlášky uzavřené a Tour de Respect odkazoval na obecný kontakt. Správné cílové odkazy na propozice model rovněž našel, ale dodával nepřesné citace identity, data nebo popisku.

Zlepšení vzniklo až po **ruční kontrole citací a nezávislém posouzení Sonnetem**. Není to důkaz, že se zlepšila přesnost samotného Haiku. Úprava instrukcí a opakované čtení tento problém na malém vzorku spolehlivě nevyřešily. Celkové doložené výdaje této navazující série pokusů jsou **0,234487 USD**; zahrnují i neúspěšné pokusy. Dva doplněné odkazy představují výtěžnost 2 ze 40 ručně a automaticky zkontrolovaných závodů, nikoliv automatickou úspěšnost 5 %.

Plošný nový import proto není připojený do denního běhu. Další práce má cílit na konkrétní mezery a aktuální pořadatelské dokumenty. Levný model může navrhovat kandidáty; přijetí zůstává podmíněné ověřením doslovných důkazů a skutečného cíle.

## Opravené příčiny chyb

- Čtečka měla výchozí limit 8 MiB. Dostupné propozice Thauru mají **10 821 566 bajtů**, takže je původní čtení přeskočilo. Cílené ověřování nyní může výslovně povolit 16 MiB; obecný limit zůstává 8 MiB. Proud se zastaví při překročení limitu i bez hlavičky Content-Length. Větší dokument se podařilo skutečně načíst a jeho obsah prošel kontrolou.
- Doplňování registrací dříve započítávalo úspěch před zápisem a přehlíželo jeho chybu. Nyní rozlišuje návrh a skutečné uložení, respektuje zámky, ukládá původ informace a započítá úspěch až po zpětném načtení.
- Kontrola pokrytí nyní porovnává externí ID a **celý rozsah termínu veřejné nesloučené akce**, nikoli pouze první den. Testy hlídají, že skrytá položka, jiný ročník ani jiný identifikátor nezamaskují chybějící závod.

## Prověřené „chybějící“ položky

| Zdrojová položka | Existující veřejný záznam | Závěr |
|---|---|---|
| Kamptal XCO, 4. 4. 2027 | KTM Kamptal Trophy, 3.–4. 4. 2027 | Už zastoupeno stejným externím ID |
| Zanzenbergrennen, 28. 5. 2027 | Zanzenbergrennen, 27.–28. 5. 2027 | Už zastoupeno stejným externím ID |
| PZKol 2880, 25. 10. 2026 | Słubice, 24.–25. 10. 2026 | Už zastoupeno stejným externím ID |

Všechny tři případy byly ověřeny aktuálním zdrojovým kalendářem, detailní stránkou a databází. Nevznikly tři nové duplicity.

Nový audit 28 kalendářových/federálních URL doběhl bez placených modelových volání. Po vyloučení výhradně italského kalendáře mimo nastavený rozsah jde o **213 nadcházejících nabídek: 191 zastoupených veřejně, 20 s existujícím neveřejným záznamem a 2 bez odpovídající vazby na daný zdroj**. Těmito dvěma případy jsou Ústecký přebor 7. 11. 2026 a Achensee Kids Race 29. 5. 2027. Oba závody byly následně nalezeny veřejně pod jiným zdrojem/názvem. Nejde tedy o dva potvrzené chybějící závody; zbývá případně doplnit zdrojové vazby. Kontrola nově samostatně uvádí neveřejné záznamy a omezuje známé země na CZ/SK/AT/DE/PL/CH. Dvě kalendářové URL Sumatoru pro rok 2027 nadále vracejí 404.

Ternitz je odlišný případ: oficiální pořadatelův program má sobotní a nedělní část, ale katalog obsahuje **dva veřejné záznamy pro tentýž víkend 14.–15. 11.**. Nejde o chybějící nedělní závod. Podklady pro případné sloučení jsou v `tmp/entry-validation/ternitz-merge-review.json`; zatím pouze návrh. Zachovat se má záznam s propozicemi a kategorií, doplnit celý název a převést odkazy i návazná uživatelská data. Před provedením je potřeba kontrola vazeb a zámků a schválení konkrétního sloučení.

## Ověření a podklady

- Celá dosavadní sada: 816 testů ve 124 souborech prošlo; následně prošly ještě 4 nové testy zápisů registrace. Typová kontrola, lint změněných souborů a kontrola formátu změn prošly.
- `tmp/entry-validation/pilot-20.json`, `pilot-next-20.json`: původní vzorek a neúspěšné návrhy.
- `tmp/entry-validation/final-2-audited.json`: doslovné citace, celé dokumenty a schvalovací posudky.
- `tmp/entry-validation/final-2-audited-applied.json`: dva skutečné zápisy, žádné přeskočení, kontrolní vzorek a rozdíl před/po.
- `tmp/entry-validation/calendar-review.json`: aktuální kalendáře, zdrojové identity a Ternitz.
- `tmp/entry-validation/source-yield-after.json` a `source-yield-classified.json`: nový celkový audit a rozlišení veřejného pokrytí, existujících neveřejných položek a chybějících zdrojových vazeb.

Data jsou uložená ve sdílené databázi. Úpravy kódu a tento report zůstávají lokální; nebyly commitnuty, pushnuty ani nasazeny.
