# Kontrola discovery — 31. 10. 2026

Celá produkční fronta měla 207 položek. Stránka adminu zobrazovala pouze prvních 100; kontrola zahrnula všechny řádky, nikoli jen viditelnou stránku.

| Rozhodnutí | Počet | Výsledek |
| --- | ---: | --- |
| Přijato | 55 | Ověřené cyklistické zdroje přidané ke sledování |
| Odloženo jako doplňkové / duplicitní | 132 | Registrace, výsledky, mapy, historie a další stránky, které nejsou novým samostatným zdrojem |
| Odmítnuto | 19 | Neplatné odkazy, jiné sporty, nesouvisející firmy, kasino a zdroj odhadovaných termínů |
| Čeká na dostupný zdroj | 1 | `https://4bikes-festival.de` vrací opakovaně HTTP 500 i ve variantě www |

Přijetí zde znamená sledování zdroje. Tato dávka přímo nevytvářela závody ani nepotvrzovala všechny údaje uvedené na přijatých webech. Běžný sběrač může nově přidané zdroje následně načíst podle vlastních pravidel.

Každý původní odkaz má rozhodnutí a zdůvodnění v `decisions.json`. Dostupné stránky jsou uloženy v `sources/`; stav a přesměrování v `fetch.json`. Dva původně nedostupné odkazy byly ověřeny přes funkční variantu www a ke sledování byla přidána právě tato varianta. Pozastavené zdroje nebyly obnoveny.

## Zlepšení výběru odkazů

Nová kontrola odděluje zjevně doplňkové odkazy od nezávislých zdrojů. Zachycuje například obrázky, GPX, startovní listiny, konkrétní přihlašovací formuláře časomír, výsledky, galerie a podmínky. Kontrola platí i pro nucené přidávání odkazů z agregátorů a pro navazující odkazy na stejném webu.

Obecné vstupní stránky přihlášek nejsou plošně zakázané: některé malé závody právě tam zveřejňují i datum a propozice. Stejně tak zůstávají povolené propozice v PDF, dětské závody a oznámení dalšího ročníku.

Přehrání všech 207 skutečně posouzených odkazů zachytilo **41 doplňkových položek**, aniž by zablokovalo některý z **55 přijatých zdrojů**. Podrobnosti: `algorithm-replay.json`.

Související opravy z kontroly duplicit rozeznávají očíslovaná kola `CX Bundesliga 10` / `11` a správně chápou `Short-Track` jako XCC místo dráhové cyklistiky.

Ověření: všech 182 testovacích souborů, **1 254 testů**, kontrola změněných souborů a kontrola typů aplikace bez archivovaných reportů. Obecná kontrola typů celého pracovního adresáře narazila na již existující archiv `reports/search-console-2026-10-29/release-source/`, kterému chybí `race-skeleton`; tento archiv nebyl měněn.

Ověřené změny jsou připravené v pracovním kódu a byly přeneseny také do soukromé kopie místního sběrače pro jeho následující spuštění. Původní soubory jsou v `runtime-before/`. U jeho staršího souboru taxonomy byly aplikovány pouze dvě související úpravy; ostatní rozdíly zůstaly zachované. Nové serverové nasazení tento chat nevytvářel.

Stav před změnou: `before.json`, `watched-before.json`. Přesná použitá dávka: `apply.sql`. Žádné řádky discovery nebyly smazány.
