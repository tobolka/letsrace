# Praktické údaje a sezónní kolekce — 3. listopadu 2026

## Provedeno

- Strukturovaný areál/adresa, skutečný pořadatel, program/starty, ceny a varianty tras. Každý údaj má zdroj, doslovný podklad, ročník a stáří; jednotlivé varianty mají vlastní původ.
- Zápis pod zámkem řádku, kontrolou veřejné verze a ručních zámků, společně s historií a požadavkem na zveřejnění. Opětovné přečtení stejné hodnoty nemění datum jejího potvrzení. Nepřebírá starý program jako nový; změna termínu skryje staré časy.
- Běžné čtení HTML/PDF, bezplatné čtení tabulek programu, model jen pro chybějící pole. Stávající denní a měsíční finanční limity zachované. Nečitelný nebo přerušený výstup není úspěšné dokončení.
- Česko 2027, MTB Česko 2027 a děti 2027 v existujících kolekcích. Celý kalendářní rok, dvanáct měsíců, známé vzdálenosti/kategorie/seriály, pět jazykových cest. Pevná česká kolekce má jednu kanonickou adresu bez přebytečného filtru země.
- Stejný areál a adresa jsou vidět návštěvníkovi i ve strukturovaných údajích; skutečný pořadatel se přidává jen pokud existuje podklad.

## Skutečné zápisy do databáze

Migrace `20261103075455_practical_race_details.sql` aplikována.

- JBC `4a99a311-023a-4b88-8a78-ad8e954eb926`: Areál Dobrá Voda, Turnovská 40, 466 01, Jablonec nad Nisou 6 z oficiálního kontaktu. Údaj bez určení ročníku, nikoli nové potvrzení programu 2027. Registrace a děti nedoplněny odhadem.
- FILIPA Podkrkonošský maraton `627394f7-e4a4-412e-9ad0-b4710b729817`: skutečný program 2027, přibližné starty včetně sekund, ceny podle termínů a pět pojmenovaných variant z oficiálních propozic. Bezplatný deterministický zápis změnil tři skupiny údajů jednoho závodu.

## Ověření

- Kompletní předchozí sada: 1 441 testů / 220 souborů.
- Po poslední ochraně změny termínu: 30 relevantních testů prošlo.
- Reálný SQL test kontroluje souběh, zámky, společné uložení historie a zveřejnění, opakování bez změny a návrat transakce při chybě.
- Produkční sestavení prošlo; lokálně všech pět kontrolovaných detailů/kolekcí vrací 200. Výsledky v `local-pages.json`, náhled v `season-preview.jpg`.

## Omezení

Nejde o dokončené plošné doplnění všech závodů. Čtení má omezenou dávku a počet dokumentů; konflikty mezi zdroji a nezávislé měření zůstávají samostatná práce. Větší množství zápisů ani úspěšné testy nedokazují pravdivost katalogu. Levné zveřejnění není dosud oddělené od následné kontroly detailů a nahromaděná fronta se nepovažuje za indexaci Googlu.

Návrhy další hodnoty detailu závodu a seriálu: [konkrétní seznam](../../docs/race-series-next-content-2026-11-03.md).
