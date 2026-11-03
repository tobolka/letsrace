# LetsRace — pokračování a úplné zadání k SEO/datům

Aktualizováno 3. listopadu 2026 podle přímých požadavků uživatele. Bez časových odhadů. Navazuje na [původní úkoly](work-tracker-2026-11-02.md) a [sedm etap provozu](operations-progress.md).

| Úloha | Ověřený stav | Další konkrétní práce |
|---|---|---|
| Nový admin na produkci | Nasazený a ověřený po přihlášení, staré nástroje v `/admin/tools`. Poslední kontrola společného seznamu je již zobrazená samostatně, stejně jako neověřené požadavky. | Skutečné vytváření a vykonávání rozhodnutí zůstává rozpracované; zobrazování poslední kontroly už není otevřený úkol. |
| Aktuální veřejné údaje | Samostatná trvalá dávka společného seznamu ověřila 1 006 záznamů proti databázi. Limit 60 kontrol detailů za den zachovaný. | Implementováno oddělené vyžádání aktualizace (200 záznamů v dávce, nejvýše 4 dávky za 24 hodin) a kontrola místa/adresy v detailu. Zbývá nechat doběhnout nahromaděné kontroly a audit změn dalších navázaných údajů. Čekající kontrola není důkaz neindexované stránky. |
| Získat maximum praktických údajů | Společné schéma, transakční zápis s původem a zámky, prompt a bezplatné čtení tabulek. Vedle JBC a Podkrkonošského maratonu uložen pořadatel a hlavní start Rohálovské 2027. Nově i běžné tabulky údaj/hodnota, zachování položek z více dokumentů a opakování neúplného čtení. | Rozšířit pokrytí dalších zdrojů, běžného textu a složitých cenových podmínek; nejde o plošně doplněný katalog. Finanční limity zachované. [Důkazy](../reports/practical-reader-v3-2026-11-03/RESULT.md). |
| Poslat Googlu uložené údaje | Implementován skutečný areál/adresa/pořadatel v JSON-LD i viditelném detailu, chybějící údaje se neodhadují. | Nasazeno `1254e213`; na skutečné veřejné adrese JBC ověřena adresa v obsahu i JSON-LD. |
| Sezónní přehledy v kolekcích | Implementovány tři roční kolekce v existujícím prostoru, leden–prosinec 2027, měsíční rozložení, vzdálenosti, doložené kategorie a seriály. | Nasazeno `1254e213`, všechny tři veřejné adresy ověřeny; regionální kolekce až s podklady. |
| Další hodnota detailu závodu a seriálu | Historické/další ročníky, okolní závody a základní kategorie již existují. | Hotový [konkrétní návrh detailů](race-series-next-content-2026-11-03.md); doporučení nejsou vydávána za provedenou implementaci. |
| Dávka českých závodů z přílohy | Inventura našla požadované hlavní záznamy; vydání `d398a611` a navazující opravy jsou již zaznamenané i ve starším trackeru. Lost Ride je skrytý provizorní záznam; Oremon je rekreační jízda mimo závodní kalendář. | Znovu neimportovat hotovou dávku. Případné nově doložené podrobnosti doplňovat do existujících záznamů. [Výsledek importu](../reports/cz-2027-import-2026-10-31/REPORT.md). |
| Chotěbuz / Eventiv | Chotěbuz přečtena a přiřazena existujícímu závodu bez AI, opakování 0 změn/0 duplicit. Eventiv odmítá přístup 401, nezaměňuje se za prázdný výsledek. | Vydání `7a591cbd` ověřeno na produkci a Mac aktualizován. Eventiv zůstává skutečné omezení přístupu. |
| Duplicita Die Mauer von Kendenich | Aktuální databáze: jeden veřejný záznam, druhý skrytý a sloučený do něj. | Průběžná prevence dalších duplicit, bezpečná a obnovitelná rozhodnutí; neznovu slučovat hotový případ. |
| Historie počasí | Společné skutečné limity, serverový běh, trvalé záznamy; úvodní naplnění není dokončené. | Poslední serverový běh 3. listopadu doplnil 18 míst bez chyby; 725 odložených položek. Úvodní naplnění pokračuje v zachovaných limitech, předpověď zůstává krátkodobá. |
| Nezávislé měření / původní etapy 0–6 | Testy ani úspěšné nasazení nejsou nezávislá správnost a pokrytí. | Oddělená kontrolní sada, audit pravidelných zapisovačů, výsledky/cena/čas člověka; neoznačit celý projekt za hotový jen po dokončení jedné vrstvy. |

Odložené zůstávají nový koncept ověřovacích statusů a stažené veřejné editační formuláře. Neobnovovat je. Rozšiřování SEO má využít existující kolekce a přinášet doložené užitečné údaje.

Dne 3. listopadu pokračuje etapa 3: trvalé zveřejnění seriálů a změn jejich kol, včetně starých adres, samostatných značek a stejného omezeného rozpočtu požadavků. UCI příloha: trialové závody na přání vlastníka vynechány; přidán Szczyrk, doplněn existující Graz a opraven Black Forest při zachování ID/registrace. Zpráva: [UCI import](../reports/uci-import-2026-11-03/RESULT.md).

Navazující opravy etap 2/3: společné doplnění disciplíny ze seriálu, bezpečný návrat zaznamenaných automatických změn a kontrola přijetí výsledku čtenáře zdrojů. [Přesný rozsah a důkazy](../reports/atomic-catalog-writes-2026-11-03/RESULT.md). Při produkčním běhu doplnění disciplín nebylo nic způsobilého k doplnění (`filled: 0`); nevydává se to za nově obohacené závody. Náhled návratu nic v katalogu nezměnil a zachoval tři zamčené disciplíny.

Další krok: hlavní sběrač ukládá změnu existujícího závodu a historii v jedné transakci, chrání novější změnu i aktuální zámky a odmítne sloučený záznam. [Ověření](../reports/atomic-watcher-update-2026-11-03/RESULT.md). Není tím dokončena atomická tvorba nového závodu ani jeho vedlejších vazeb.

Zpřesnění přehledu: zobrazení poslední kontroly v adminu a oprava staršího trackeru importu už byly provedené; nejsou znovu uváděny jako čekající práce. Automatické rozhodování, plošné pokrytí a nezávislé měření jsou skutečné zbývající úkoly.
