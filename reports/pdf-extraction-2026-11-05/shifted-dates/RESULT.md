# Termíny 2026 vydávané za 2027 · 6. 11. 2026

Při kontrole dnů v týdnu vyšlo najevo, že část závodů 2027 má termín v pondělí, který byl v roce 2026 nedělí. Nebyly oznámené, jen dostaly nový letopočet.

## CUBE Cup
Web má nadpis „CUBE Cupe 2027“ nad tabulkou roku 2026 a čtečka vzala rok z nadpisu. Pořadatel přitom píše, že první novinky k sezóně budou od poloviny listopadu. **11 vymyšlených termínů je skrytých** (`fix-shifted-dates.cjs`, předchozí stav v `shifted-*.json`). Franken-Bike-Marathon má ověřené datum 6. 6. 2027 přímo od pořadatele, zůstává veřejný.

## RoadCup
Staré čtení přes AI přidalo letopočet k datům z tabulky 2026. Opraveno podle tabulky 2027 pořadatele:
- Velká cena Bíliny: 7. 6. → 6. 6. 2027
- Most – Lesná: 9. 8. → 8. 8. 2027
- LAWI Tour: 30. 8. → 29. 8. 2027
- Kraslický šíp: tři záznamy (23. 5., 30. 5., 20. 9.) sloučené do 30. 5. 2027
- Beskyd Tour: záznam na 27. 6. sloučen do 26. 6. 2027

## Pojistky
- Čtečka CUBE Cupu nepřijme tabulku, která v ohlášeném roce nepadá na víkendy.
- Obecně pro všechny zdroje: tabulka s aspoň 5 závody příštího roku, kde se aspoň 30 % a alespoň 3 z nich posunuly z neděle na pondělí a většina byla loni o víkendu, se nepřijme.

## Co pojistka nepozná
Sobota 2026 se v roce 2027 mění na neděli a vypadá přirozeně. Stejná chyba se tak může skrývat u závodů, které se loni jely v sobotu, pokud zdroj neměl dost nedělních závodů. Hledání kopií stejného dne s minulým ročníkem našlo už jen pár jednotlivých závodů, většinu s vlastním webem, a ty jsem neprocházel všechny.

Nejasné zůstává: Cycling Cup Thaur má dva záznamy (6. 6. a pondělí 14. 6. 2027) s různými ID Cycling Austria.

## Cizí propozice
Podmínky závodu ve Velešíně z maraton.cz byly přilepené k 7 cizím závodům. Odkaz je odstraněný (`clear-foreign-regulations.cjs`) a čtečka už nepřijme soubor pojmenovaný po místě, které závod neuvádí. Žádný z těchto 7 závodů z nich na webu údaje nemá.
