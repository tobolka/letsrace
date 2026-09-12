# Kontrola před spuštěním — 12. 9. 2026

## Výsledek a hranice ověření

Aplikace má opravené konkrétní chyby dat, ukládání a mobilního ovládání. Tento přehled **není potvrzení, že každý závod v katalogu odpovídá aktuálním propozicím**. Automatická kontrola úplnosti ani existence URL takové potvrzení nedává. Produkční nasazení ani odesílání skutečných přihlašovacích e-mailů nebylo součástí ověření.

## Data v Supabase

Projekt `xlomrxswdcekarazaahx`. Stav auditu 12. 9. 2026, 05:50 UTC; importy běží průběžně, proto počty nejsou trvale konstantní.

| Kontrola | Výsledek |
| --- | --- |
| Záznamy celkem / veřejné | 7 006 / 5 116 |
| Nadcházející veřejné závody | 1 859 |
| Nadcházející bez webu, registrace i zdrojového odkazu | 0 |
| Nadcházející bez vyřešeného místa | 103 (5,5 %) |
| Kolize přesného fingerprintu | 0 |
| Skupiny se shodným názvem a datem | 11, všechny již proběhlé |
| Veřejné bez disciplíny / věkových kategorií | 67 / 1 278 |
| Nesoulad odvozených a uložených kategorií | 83 kandidátů k posouzení; ne automaticky 83 chyb |

Podrobný seznam neurčených míst a přesných kandidátů na duplicitu: [data-quality-2026-09-12.json](data-quality-2026-09-12.json). Shodné názvy nejsou úplná detekce duplicit: překlady názvů a různá označení téže akce mohou uniknout. Například dvojice názvů německého mistrovství XCE v Passau zůstává vhodná k samostatnému posouzení; závod poháru a mistrovství se nesmí sloučit jen podle města a data.

### Provedené opravy

- Sloučeno **9 dvojic**. Původní závody jsou archivované, nikoli smazané. Přesunuty zdroje, oblíbené závody a účasti; doplněny chybějící kategorie. Historické notifikace zachovávají původní identitu.
- **Kleť 13. 9.**: odstraněn duplikát ze screenshotu. Shodu potvrzují [propozice časomíry](https://stopnuto.cz/propozice/casovka-na-klet-2026). Starý detail nyní přesměrovává na zachovaný závod.
- **3x Kolem Kalicha**: zachována česká Malá Skála místo chybné slovenské polohy, doplněn [web pořadatele](https://3xkolemkalicha.webnode.cz/).
- **Zlínská 50**: zachován Zlín/Malenovice místo areálu v Beskydech. [Pořadatel](https://www.zlinska50.cz/) uvádí hrad Malenovice.
- **CX-MAS Cross Vol. 4**: dvě chybné polohy sloučeny; místo pro ročník 2026 změněno na Georg Weichand Sportanlage v Markgrafneusiedlu podle [oficiální adresy a GPS](https://team-bikestore.sportunion.at/cross-rennen/). Stránka obsahuje také archiv 2025; jeho přihlášku jsme nepřebírali jako aktuální.
- Historické kopie: Enduro Race Kouty (identická konkrétní URL), Slezská Harta, Bike Maraton Vysočina, Bystřické MTB a Okolo Libice. Zachován záznam s určeným místem oproti kopii s pouhým kódem země.
- Doplněny weby pro [dětský závod ve Stupavě](https://www.stupavskymaraton.sk/inpage/junior-mtb/) a [finále Enduro série](https://www.enduroseria.sk/).
- Odstraněny souřadnice ze **7 country-only lokací**. Centroid státu není místo závodu. Záznamy zůstávají dostupné k doplnění; mapa jim nevymýšlí přesnou polohu.

Přesná ID a kontrolní podmínky jsou v `scripts/verified-catalog-repairs-2026-09-11.sql`, `scripts/duplicate-identity-repairs-2026-09-12.sql` a `scripts/repair-verified-links.ts`. Geografické opravy keeperů mají zámek `location_id`, aby je import nepřepsal.

### Ochrana proti návratu problému

Migrace `20260911150004_durable_event_merges.sql` byla aplikována v Supabase. Slučování probíhá v jedné transakci; chyba nezanechá polovinu přesunutého plánu. Funkci smí volat pouze služba se service role. Ověřeno: anon=false, authenticated=false, service_role=true.

Importer vyhledává existující ročník podle identity zdroje; externí ID z jiného roku nepřepisuje starý ročník. Archivované aliasy se neúčastní měkkého ani URL párování. Jednotkový test ověřuje výběr kanonické identity sloučeného zdroje a oddělení ročníků; celý import nebyl znovu spuštěn jako zápisový test. RaceResult bez místa už nepoužívá kód země a centroid jako náhradu místa závodu.

Kontrola po zápisech: 9 aliasů, žádný veřejný alias, žádné zdroje ani současné účasti ponechané na aliasu. Samotná sloučovací funkce ověřena nejprve v transakci s rollbackem.

## Rozhraní a účet

| Před | Po | Důvod |
| --- | --- | --- |
| Všechny údaje v jednom zkráceném řádku | Datum a místo oddělené od disciplíny a seriálu | Rychlejší čtení na mobilu |
| Anglické disciplíny v českém seznamu | Lokalizované disciplíny a úrovně v seznamu, filtrech a detailu | Konzistence jazyka |
| Nejasné „149 km“ | Vzdálenost s vysvětlením, že jde o vzdušnou vzdálenost od vybraného místa | Nezaměňuje se s délkou trati |
| URL a čas importu působí jako záruka ověření | Popisek dostupného odkazu a „Ve zdroji nalezeno…“ | Poctivější informace o původu |
| Selhání načtení může vypadat jako prázdný plán | Chybový stav a možnost opakování | Uživatel nezamění výpadek za ztrátu dat |
| Chybějící obnova hesla | Obnova a formulář pro nové heslo | Dostupný návrat do účtu |
| Síťová chyba může ponechat formulář ve stavu ukládání | Uvolnění ovládání a srozumitelná chyba | Možnost zkusit akci znovu |
| Malé přepínače stavů a vysoké dialogy | Větší dotykové plochy, zalamování jmen, posouvání dialogu | Ovládání na malém displeji |

Přesunuto Next middleware do podporovaného `proxy.ts`. Přidána lokalizovaná stránka chyby s opakováním načtení.

## Ověření

- 546 testů v 67 souborech prošlo.
- Produkční build včetně TypeScriptu prošel; lint: 0 chyb, 49 existujících upozornění. Ty nejsou prohlášeny za vyřešené.
- Desktop: načtení mapy a přepracovaného seznamu.
- Mobil 390 × 844: seznam, výběr Kleti, detail s českou disciplínou a odkazy; přihlášení a přechod na obnovu hesla. V předchozí části kontroly též posouvání registračního dialogu při výšce 360 px.
- HTTP výstup původního detailu Kleti obsahuje přesměrování 308 na zachovaný slug (při streamingu formou refresh metadat).
- Politiky RLS profilů, rodinných jezdců, oblíbených a účastí omezují čtení i zápis na vlastní uživatelské ID.
- **Neověřeno živě:** doručení obnovovacího/ověřovacího e-mailu, kompletní přihlášení přes Google a souvislý průchod přihlášeného uživatele s reálnou session. Ukládání je kryté testy včetně odmítnutého zápisu a výpadku sítě; to nenahrazuje tento průchod.

## Zbývá před ostrým spuštěním

1. Doplnit nebo výslovně označit neurčená místa; pokračovat v kontrole kategorií a přeložených názvů. Vzorek ručně ověřených závodů nesmí být prezentovaný jako ověření všech 5 116 veřejných záznamů.
2. Projít autentizační toky s vyhrazeným testovacím účtem a ověřit doručení e-mailů, povolené redirect URL a produkční poskytovatele.
3. Supabase Security Advisor hlásí vypnutou [ochranu před uniklými hesly](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [PostGIS ve veřejném schématu](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [spatial_ref_sys bez RLS](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public) a veřejně spustitelné [st_estimatedextent SECURITY DEFINER funkce](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable). Jde o existující nastavení rozšíření, ne o novou slučovací funkci. Přesun PostGIS vyžaduje samostatné posouzení závislostí; nebyl proveden naslepo. Jedenáct admin/import tabulek má RLS bez veřejné politiky, což záměrně blokuje přímý přístup návštěvníků.

Opakování auditu: `node scripts/with-node.cjs tsx scripts/audit-data-quality.ts --output docs/data-quality-YYYY-MM-DD.json`. Dostupnost odkazu se zde kontroluje strukturálně, nikoli hromadným HTTP ověřením obsahu každého cíle.
