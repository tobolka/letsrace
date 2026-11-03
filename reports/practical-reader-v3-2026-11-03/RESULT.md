# Praktické údaje: další skutečný zdroj a opravy čtečky

3. listopadu 2026. Navazuje na řádek „Získat maximum praktických údajů“ v trackeru.

## Provedené změny

- Bezplatné čtení tabulky údaj/hodnota: vyžaduje výslovný název závodu a datum ročníku v sousedních řádcích. Nevyžaduje rok v adrese webu. Pořadatel z řádku Pořadatel a první výslovně datovaný start procházejí společnou kontrolou zdrojové citace a identity. Jiný ročník, sousední jiný závod ani rok v patičce nestačí.
- Více dokumentů zachovává samostatné praktické údaje i různé varianty tras. Dřívější přepsání celého pole výsledkem posledního dokumentu mohlo zahodit dříve nalezenou trasu nebo program.
- Kontrolní otisk obsahuje také identitu, termín a známý areál. Stejný dokument při změně závodu není automaticky už zpracovaný podklad pro nový kontext.
- Neúplný průchod při limitu pěti dokumentů či nedostupném dalším dokumentu se výslovně hlásí jako částečný a odložený. Nedostane značku dokončeného přečtení. Další pokusy střídají pořadí navazujících odkazů; první položky navigace nemají trvale přednost. Částečné pokusy používají stávající třídenní odstup a zachovávají užitečné uložené údaje. Rozpočet ani počet dokumentů za běh se nezvyšuje.

## Skutečný zápis

Existující závod `72427d58-6a5b-4a97-860f-c80c77041d3b`, RAAB FORCE Rohálovská 50ka 2027:

- Pořadatel: **Sportovní klub Vesani.cz, z.s.**
- Program: **Start hlavního závodu 1. května 2027 ve 12:30**.
- Zdroj obou údajů: [oficiální propozice](https://www.vesani.cz/propozice/).
- Uloženo přes stávající transakční zapisovač se zdroji a zámky: dvě změněná pole, jeden existující závod, žádný nový závod. Náklad AI tohoto běhu **0 USD**.
- Navazující skutečný běh: **0 změněných polí / 0 změněných závodů / 0 chyb / 1 částečný průchod**. Neznovuuvádí doplněná data jako nové; další dokumenty zůstávají k přečtení.
- Dětský start 8:30 nebyl zaměněn za hlavní start. Smíšené ceny jednotlivce, tandemu, dětí a zahraničních účastníků se neparsují jako jedna obecná cena. Starý odkaz na obrázek mapy 2026 nebyl vydáván za GPX ani nově potvrzenou trasu.

[Výstupy náhledu, zápisu a opakování](roh-extraction.json) zachovávají citace a seznam skutečně přečtených adres; nikoli veřejné bankovní údaje celé stránky.

## Nasazení a veřejný výsledek

- **1 476 testů / 226 souborů prošlo**, sestavení i cílená kontrola kódu prošly. Logy: `tmp/practical-v3-all-tests.log`, `tmp/practical-v3-build.log`, `tmp/practical-v3-lint.log`. Integrační zkouška nedokončeného průchodu ověřuje limit pěti dokumentů, odložení bez falešného dokončení, opakovatelný checkpoint a nulové volání modelu.
- Kód nasazený jako `135b024c`, Vercel `dpl_Kc6P9wiLVRhGgFY7D23aKEyLnMMg` READY na produkční doméně. Nainstalovaný Mac má totožné soubory čtečky i skládání výsledků. Runner i panel běží; hlášení při kontrole staré šest sekund.
- Na [veřejném detailu](https://letsrace.cz/cs/zavod/raab-force-rohalovska-50ka-rocnik-2027) ověřen pořadatel, datum a hlavní start 12:30 včetně odkazů na propozice. Uložený pořadatel je i v JSON-LD jako `Organization`; `SportsEvent.startDate` zůstává datem 2027-05-01, nenaznačujeme přenos času do tohoto pole.
- [Snímek veřejného detailu](production.jpg). Nejde o nezávislý test pokrytí katalogu ani o důkaz indexace Googlu.

## Zbývající práce

Rozšíření běžného textu a složitých cenových podmínek, širší nezávislé vzorky a plošné doplnění katalogu. Střídání odkazů je omezený průchod, nikoli důkaz přečtení celého webu. Konfliktní hodnoty z různých důvěryhodných zdrojů zatím vyžadují další pravidla; jejich řešení tato změna neslibuje. Schéma samo o sobě nepotvrzuje pravdivost všech údajů.
