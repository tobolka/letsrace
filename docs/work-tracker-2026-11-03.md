# LetsRace — pokračování a úplné zadání k SEO/datům

Aktualizováno 3. listopadu 2026 podle přímých požadavků uživatele. Bez časových odhadů. Navazuje na [původní úkoly](work-tracker-2026-11-02.md) a [sedm etap provozu](operations-progress.md).

| Úloha | Ověřený stav | Další konkrétní práce |
|---|---|---|
| Nový admin na produkci | Nasazený a ověřený po přihlášení, staré nástroje v `/admin/tools`. | Doplnit poslední ověřený společný seznam; skutečné rozhodovací automaty zůstávají rozpracované. |
| Aktuální veřejné údaje | Samostatná trvalá dávka společného seznamu ověřila 1 006 záznamů proti databázi. Limit 60 kontrol detailů za den zachovaný. | Oddělit levné zveřejnění od následné kontroly detailů a doplnit kontrolu místa i změn navázaných údajů; neprohlašovat čekající kontroly za neindexované stránky. |
| Získat maximum praktických údajů | Implementováno společné schéma, transakční zápis s původem a zámky, prompt a bezplatné čtení skutečných tabulek. Uložena adresa JBC a program/startovné/trasy Podkrkonošského maratonu. | Ověřit další nezávislé zdroje a postupně rozšířit pokrytí; nejde o plošně doplněný katalog. Finanční limity zachované. |
| Poslat Googlu uložené údaje | Implementován skutečný areál/adresa/pořadatel v JSON-LD i viditelném detailu, chybějící údaje se neodhadují. | Ověřit nasazený výsledek na JBC; žádný vymyšlený pořadatel ani cena. |
| Sezónní přehledy v kolekcích | Implementovány tři roční kolekce v existujícím prostoru, leden–prosinec 2027, měsíční rozložení, vzdálenosti, doložené kategorie a seriály. | Ověřit nasazení, jazykové adresy a mapu; regionální kolekce až s podklady. |
| Další hodnota detailu závodu a seriálu | Historické/další ročníky, okolní závody a základní kategorie již existují. | Hotový [konkrétní návrh detailů](race-series-next-content-2026-11-03.md); doporučení nejsou vydávána za provedenou implementaci. |
| Dávka českých závodů z přílohy | Aktuální inventura našla požadované hlavní záznamy; existuje vydání `d398a611` a navazující opravy. Lost Ride je skrytý provizorní záznam; Oremon je rekreační jízda mimo závodní kalendář. | Opravit starý tracker, odkázat skutečné výsledky a neduplikovat již importované závody. Nejisté podrobnosti zůstávají oddělené. |
| Chotěbuz / Eventiv | Chotěbuz přečtena a přiřazena existujícímu závodu bez AI, opakování 0 změn/0 duplicit. Eventiv odmítá přístup 401, nezaměňuje se za prázdný výsledek. | Vydání `7a591cbd` ověřeno na produkci a Mac aktualizován. Eventiv zůstává skutečné omezení přístupu. |
| Duplicita Die Mauer von Kendenich | Aktuální databáze: jeden veřejný záznam, druhý skrytý a sloučený do něj. | Průběžná prevence dalších duplicit, bezpečná a obnovitelná rozhodnutí; neznovu slučovat hotový případ. |
| Historie počasí | Společné skutečné limity, serverový běh, trvalé záznamy; úvodní naplnění není dokončené. | Měřit postup a odložené dávky v zachovaných limitech; předpověď zůstává krátkodobá. |
| Nezávislé měření / původní etapy 0–6 | Testy ani úspěšné nasazení nejsou nezávislá správnost a pokrytí. | Oddělená kontrolní sada, audit pravidelných zapisovačů, výsledky/cena/čas člověka; neoznačit celý projekt za hotový jen po dokončení jedné vrstvy. |

Odložené zůstávají nový koncept ověřovacích statusů a stažené veřejné editační formuláře. Neobnovovat je. Rozšiřování SEO má využít existující kolekce a přinášet doložené užitečné údaje.
