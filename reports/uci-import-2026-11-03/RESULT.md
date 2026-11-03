# UCI nálezy — 3. listopadu 2026

Trialové položky Dolany a Rzeszów byly podle posledního pokynu vlastníka vynechány. Nezakládá se pro ně závod ani nová disciplína.

## Skutečné zápisy

| Závod | Výsledek | ID | Termín | Zařazení |
|---|---|---|---|---|
| iXS European Downhill Cup — Szczyrk | Přidán | `48c78de2-d9ff-4db1-9722-09ffb8d5c520` | 30. 7.–1. 8. 2027 | DH; UCI Continental Series (CS); Elite a Junior muži/ženy |
| Mountainbike Junior Festival Graz/Stattegg | Doplněn existující | `7168eed6-550f-4f65-be73-14f6f3cba953` | 6. 7. 2027 | XCO; UCI C1 a UCI XCO Junior Series; junioři/juniorky |
| Black Forest ULTRA Bike Marathon | Opraven existující | `758ecc03-41f2-4ecd-9697-9beba5ae4fa3` | 25. 7. 2027 | XCM; UCI World Cup (CDM); Elite a amatéři |

Graz už existoval na správné datum, nepočítá se jako nový závod. Ostatní soutěže festivalu se nepřesunuly na 6. července. Black Forest zachoval ID, souřadnice, stávající vztahy a registrační odkaz. Nový duplicitní víkend ani zvláštní Elite kopie nevznikly: nynější záznam popisuje hlavní závodní den se společnými kategoriemi, nikoli vymyšlený rozpis oddělených soutěží.

Szczyrk má nový vlastní bod areálu u dolní stanice gondoly podle odkazu na mapu z oficiálního příjezdu (49.6958611, 18.9906111). Není vydáván za přesnou startovní čáru. UCI potvrzuje resort; registrace 2027 zůstává prázdná. Graz má nadále původní bod obce/areálu, potvrzený přesný start se netvrdí.

## Podklady

- [Szczyrk UCI 81090](https://www.uci.org/competition-details/2027/MTB/81090), [oficiální příjezd](https://www.szczyrkowski.pl/resort/dojazd-i-parkingi).
- [Graz UCI 80444](https://www.uci.org/competition-details/2027/MTB/80444), [pořadatel](https://www.bike020.at/) oznamuje festival 6.–10. 7. 2027; podrobné stránky stále obsahují program 2026, který nebyl převzat jako nový.
- [Black Forest UCI 80749](https://www.uci.org/competition-details/2027/MTB/80749), [oznámení kalendáře a amatérských soutěží](https://www.uci.org/pressrelease/the-uci-unveils-the-calendar-for-the-2027-hero-uci-cross-country-marathon-world-cup/6MQE6t6dQXXzyP33rs8SXK), [pořadatel](https://ultra-bike.de/).

Všechny podklady mají vlastní záznam zdroje a historie změn; stávající zdroje nebyly odstraněny. Předchozí stav je v `before.json`, provedená transakce v `apply.sql`, výsledné adresy v `manifest.json`. Transakce měla kontrolu původní verze, kontrolu nově vzniklé duplicity a současně uložila údaje, kategorie, zdroje, historii, ochranné zámky a požadavky na zveřejnění.

## Příčina a oprava automatizace

Black Forest pocházel z agregátoru se samotným názvem maratonu a bez vztahu ke světovému poháru. Název sám toto zařazení nedokládal. Čtečka UCI navíc rozpoznávala pouze C1–C3, ne CS/CDM, a některé doslovné názvy disciplín UCI chyběly v mapování. Doplňovací skript nesprávně převáděl World Cup/CDM na silniční WorldTour.

Čtečka nyní načítá CS, CDM, XCM a XCO Junior Series ze skutečných údajů UCI, propojuje příslušný seriál a World Cup odděluje od WorldTour. Opravené konkrétní hodnoty chrání zámky. Nové UCI adresy jsou zařazené do pravidelného čtení. Čtečka jednotlivého detailu se nadále nepovažuje za úplný kalendář a nepřítomné závody nemaže.

## Navazující původní úkoly

V etapě 3 `operations-progress.md` doplněno trvalé zveřejnění změn seriálu a kol: přejmenování, staré adresy, změny vložených údajů a přesuny závodů mezi seriály. Vlastní značky stránek a dat umožňují cílenou aktualizaci. Pouhé hlášení času čtení nevytváří práci. Potvrzení požadavku na seriál není prohlášení o kontrole jeho HTML.

## Ověření před nasazením

- Všechny tři výsledné řádky znovu načteny z databáze, registrační odkaz Black Forest zachovaný.
- 1 453 testů / 222 souborů prošlo; samostatně skutečný SQL test změn seriálu, členství, starých adres, návratu transakce a soukromého přístupu.
- Sestavení a kontrola typů prošly; stávající bezpečnostní nálezy databáze bez nového zhoršení.
- Veřejný výsledek se ověřuje po nasazení; tato část sama jej ještě nedokládá.

## Veřejný výsledek

Vydání `8f31731f` je na produkci, Vercel `dpl_2Kz1Er1L4QvNmK5kEAtVrG6waYC7` má stav READY. Všechny tři skutečné veřejné detaily vrací 200. Běžný sdílený seznam `/api/events?catalogue=1` obsahuje všechny tři záznamy se správnými termíny, zařazením, disciplínami a souřadnicemi; podklad pro mapu, seznam a kalendář v `production-checks.json`. Výběr DH/XCO/XCM odpovídá konkrétním závodům.

Cílená dávka zveřejnění ověřila osm detailů bez chyby, včetně těchto tří, v původním denním limitu. Oddělená dávka požadavků v té chvíli správně čekala na časový odstup; její limit nebyl vynulován ani navýšen. Přechodné pozastavení této jedné dávky při nasazení bylo zrušeno.
