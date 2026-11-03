# První oddělené výchozí měření — 3. listopadu 2026

Výběr začal v oficiálních zdrojích, potom se hledaly odpovídající identity v katalogu. Zdrojové stránky byly přečtené přímo ve vykresleném prohlížeči, nikoli našimi čtečkami. Žádný katalogový záznam se při měření nezměnil.

Referenční sada: [údaje a původ](../../docs/quality/reference-2026-11-03.json). Zmrazený výsledek: [baseline.json](baseline.json). Opakování: `node scripts/with-node.cjs tsx scripts/measure-reference-catalogue.ts --out=tmp/reference-catalogue-latest.json`.

| Kontrolní případ | Výsledek proti databázi |
|---|---|
| Fullgaz 2027, 3.–4. dubna, Německo | Nenalezen posouzený veřejný protějšek. Prověřeny názvy, předchozí ročníky, zdrojové URL a ID, web pořadatele i německé záznamy daného víkendu. Existuje ročník 2026. UCI potvrzuje termín, ale její údaj místa uvádí organizaci; nelze jej bez dalšího vydávat za obec nebo areál. |
| Ötztaler Mountainbike Festival, 24.–25. dubna 2027, Haiming | Existuje. Datum, země, obec a XCO souhlasí. Katalog má `local` a prázdnou UCI třídu; UCI uvádí Continental Series / CS. |
| Raiffeisen Österreich Grand Prix C1, 5. června 2027, Windhaag | Existuje pod názvem bez slova Windhaag. Přesné federální ID potvrdilo identitu a kontrolovaná pole souhlasí. Youngster Grand Prix je jiná soutěž; společný web a den nejsou důvod ke sloučení. |

Ve třech kontrolních případech jsou dva posouzené veřejné protějšky, jeden má všechna měřená pole ve shodě a druhý má rozdíl v zařazení. Třetí vyžaduje doplnění chybějícího ročníku a ověření místa. **Nejde o odhad podílu správných závodů ani pokrytí celého katalogu.**

Kamptal byl z nezávislé sady vyřazen: našel se už v říjnových podkladech k opravám. Zůstává diagnostickým příkladem závodního víkendu s více soutěžemi.

## Omezení měření

Tři cíleně vybrané případy ze dvou zemí a MTB nejsou reprezentativní vzorek. Zatím není kontrola ostatních disciplín, falešných závodů, falešných sloučení, ceny hostingu a práce vlastníka ani porovnání před/po. Neporovnává se čerstvost veřejného HTML nebo Google. Názvové návrhy ve skriptu jsou jen podněty pro posouzení identity a nejsou automaticky uznaná shoda.

Jakmile se kontrolní případ použije k úpravě čtečky nebo párování, přesune se do regrese. Pro doložení přenositelnosti změny je třeba vybrat další nedotčené případy. Dnešní zdrojové údaje nejsou navždy platné; při pozdějším přeměření se musí znovu ověřit.

## Aktuální fronta zveřejnění

Při kontrole čekalo 890 úloh detailů a 32 úloh seriálů. Dnešní limit 60 pokusů detailů byl vyčerpaný; čtyři dávky vyžádání aktualizací za 24 hodin rovněž. Limity se neobcházely. Opraveno také hlášení kontrolního skriptu: dřívější `pending=0` označovalo jen odložené položky z právě zpracované dávky, nikoli celou frontu. Nyní vrací skutečných 890 čekajících kontrol samostatně od `deferredInBatch=0` a částečný výsledek; prázdná dávka se neoznačuje za vyprázdněnou frontu. Čekající kontrola není důkaz chybné veřejné stránky nebo neindexace. Skutečné vyprázdnění této fronty proto dnes není dokončený úkol.

## Navazující konkrétní práce

Ověřit místo Fullgaz z pořadatele/předchozího ročníku a příčinu chybějícího nového ročníku; doplnit doložené zařazení Ötztalu běžnou chráněnou cestou. Tyto případy potom budou regresní, nikoli nezávislý důkaz zlepšení. Rozšířit kontrolní sadu o další země, disciplíny a negativní případy.
