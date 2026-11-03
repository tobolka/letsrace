# Společné uložení vazeb závodu na seriály

3. listopadu 2026, pokračování etap 2 a 3 původního zadání.

## Odstraněná závada

`attachEventSeries` měnil zvlášť příznaky původního seriálu, vazbu na nový seriál a hlavní seriál závodu. Dva zápisy nekontrolovaly chybu. Pád nebo souběh mohly zanechat rozporné vazby. Připojení vedlejšího seriálu navíc rozhodovalo podle starého čtení závodu.

Nový `pipeline_attach_event_series` drží zámek závodu a v jedné transakci uloží hlavní seriál, vazby, původ a trvalé požadavky na veřejnou aktualizaci. Zohlední ruční zámek i sloučený záznam. Opakování stejné vazby je beze změn; běžný zdroj nepíše znovu stejné vztahy. Příznak hlavního seriálu a hlavní vazba se již nemohou rozejít kvůli selhání jednoho požadavku.

Také změna vedlejší vazby vytvoří aktualizaci závodu i dotčených seriálů. Detail seriálu načítá skutečné hlavní i vedlejší vazby; dříve bral pouze hlavní odznak a některé již uložené závody tak chyběly v přehledu dalšího seriálu. Načítání chyby databáze nepovažuje za prázdný seznam.

## Ověření

- Skutečný izolovaný PostgreSQL test: právě jeden hlavní seriál, vedlejší vazba bez přepsání hlavního, opakování bez nové historie či úkolů, ruční zámek, ochrana sloučeného záznamu a soukromý přístup.
- Vynucené selhání ukládání původu vrátí současně závod, vazby i frontu do původního stavu; nejde jen o test pomocné funkce.
- Na produkci opakováno přiřazení tří právě ověřených UCI závodů: třikrát `unchanged`, žádná nová vazba ani změna závodu.
- Regresní sada: 1 453 testů / 222 souborů, sestavení a kontrola kódu prošly.

## Zbývající rozsah

Tato změna nepřevádí celý hlavní import ani zápis kandidáta do jedné transakce. Neřeší všechny ostatní přímé zapisovače, automatické rozhodování o rozporech či nezávislé měření pokrytí. Historie vazby není tvrzení o nezávislém ověření závodu a návrat transakce není automatický návrat libovolné pozdější ruční změny.

## Nasazení a veřejný výsledek

Vydání `c9159297` je nasazené na produkci; Vercel `dpl_Caj5BGfbL7fE5WdLV8E9r3CJYJuf` READY. Spravovaný sběr na Macu aktualizován a soubory čtečky UCI i zápisu vazeb porovnány se současným zdrojovým kódem.

Skutečný ověřený příklad: `https://letsrace.cz/cs/serie/nrw-cross-cup-2026` uvádí závod Die Mauer von Kendenich právě jednou a odkazuje na zachovaný záznam `a55944aa-c6ac-4428-bfcd-eba0a897582d`, i když jde o vedlejší vazbu k seriálu. Náhled `production-series.jpg`. Nová kopie závodu nevznikla.
