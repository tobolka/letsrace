# Převzetí změn a ochrany pipeline · 5. listopadu 2026

## Ověřený výchozí stav

Posouzené commity druhé AI: `fd6d657e`, `40eb87b1`, `7c37d9b0`, `c4260fda`. Poslední z nich je při převzetí v `main`, `origin/main` i v produkčním nasazení `dpl_zRXWYTFABabsNwkck4VRucFbjHWL` ve stavu READY. Změny nejsou pouze lokální.

Přibylo týdenní hledání dalších ročníků v Česku, přehled jejich stavů v adminu, slučování nových duplicit během cyklu, automatické pozastavení neproduktivních podstránek, omezení upozornění na blížící se závody a zobrazení smíšených gravelových závodů. Samostatné reporty dokládají konkrétní opravy dat a ruční úklid 717 zdrojů; tento report jejich celý historický rozsah znovu neověřuje ani neopakuje importy.

Mac má `paused: true`, neaktivního potomka a žádný probíhající serverový požadavek. Vercel má zapnuté pravidlo `TEMP pause server scans`, které odmítá `/api/cron/watch` a `/api/cron/explore`. Poslední záznam hlavního čtení zdrojů v databázi je z 3. listopadu. Rutinní zveřejňování a doplňování historie počasí běží odděleně od těchto scanů.

## Co bylo nutné opravit

| Zjištění v převzatém kódu | Provedená oprava | Ověření |
| --- | --- | --- |
| Kontrola ročníků použila první stejný normalizovaný název bez ověření země a místa; jiná větev přijala libovolný závod ve stejný den a obci nebo na stejném webu. | Odstraněny obě zkratky. Oznámený ročník používá více údajů o identitě a rozlišuje jednoznačnou shodu, nejasnost a chybějící ročník. Nejasná existující edice se nevydává za nalezenou ani se nevytváří další kopie. | Stejný název v jiné zemi, jiný závod ve stejné obci, dvě shody, jiný den/délka/místo a rozdílné kolo. |
| Citace „Uzávěrka přihlášek závodu …“ prošla jako termín, protože obsahovala slovo závod. | Část citace s datem musí samostatně dokládat den akce, nikoliv přihlášku či platbu. Sdílený web se kontroluje už při dvou závodech. Výchozí rok se již nepřipíná k roku 2026. | Česká a anglická uzávěrka, samostatný den závodu vedle oznámení registrace, dosavadní pozitivní oznámení. |
| Náhradní důkaz sloučení tvořil pouze názor modelu a názvy, někdy se shodou domény. Výběr dvojic přitom připouštěl sousední dny, vzdálenost 40 km a neznámé místo. | Sloučení bez citace navíc vyžaduje stejný den a rozsah akce, známou společnou zemi, konkrétní blízké místo a společnou rodinu disciplíny; společná doména ani otisk nezvyšují tento důkaz. Zachovány konflikty kol, formátů a seriálů. | Správná shoda a osm variant neshody, navíc různá kola. Cesta s doloženou citací zůstává samostatná. |
| Automatické pozastavení počítalo jakékoliv tři pokusy, včetně chyb; přehlíželo kandidáty ve stavu conflict/publishing a některé rozpracované podstránky. | Nejnovější nejméně tři čtení musí být dokončená, úspěšná, úplná, bez nalezených závodů, odkazů, chyb a odkladů. Chrání se čekání na sezónu, ruční zdroje, existující závody, kandidáti a aktivní potomci. | Izolovaný PostgreSQL: chyby, neúplné/staré metriky, odklady, sezónní stránka, potomci, existující závod, idempotence a zákaz veřejného volání. |
| Přeskočení nezměněných řádků označilo všechny závody zdroje jako znovu viděné. | Jeden chráněný hromadný zápis jen pro skutečně načtená nezměněná ID bez čekající kolize. Nezmění stav ani termín dalších závodů. | Skutečná databázová funkce: jen uvedená ID/aliasy, platnost převzetí, ruční pauza, nulový seznam a veřejná oprávnění. Integrační test hlavního sběrače také ověřuje výběr ID. |

Dokončena také dříve rozpracovaná ochrana měření: sdílená kalendářová URL nesmí sama prokázat identitu všech záznamů z kontrolní sady. Původní zmrazená sada zůstala beze změny, SHA-256 `52d90d3c6923509a1b340467a23ee5d5667374f3776b3098fd3b2ce089e46bf7`.

## Co zůstává otevřené

- **P0.4f:** živé chyby načítání ročníků přetrvávají. Konkrétní logy z `06:58:35` a `06:59:40 UTC` ukazují timeout RPC `public_edition_candidates` na německých ročnících; nejde pouze o historické chyby. Nové měření selhání veřejných databázových čtení zapisuje prostředek, skutečnou dobu a stav časového limitu/volajícího. Neposílá klíče, parametry ani obsah odpovědi. Příčina zatím není doložená a bod se neoznačuje jako hotový.
- **P0.4a:** okno `2026-11-04 07:00 – 2026-11-05 06:55 UTC` má 17 617 požadavků: bez označení 9 339, veřejný web 6 853, historie počasí 721, monitor 347, zveřejňování 233, údržba 124. Okno je dlouhé 23 h 55 min a zahrnuje dobu před nasazením rozlišení a úspor; nedokazuje celodenní spotřebu po změně ani splnění limitu 16 000. Údaj o GB není z počtu dopočítaný.
- **P1.2a / P1.1a:** nový celý týdenní cyklus a kvalita automatických sloučení se po dnešních opravách živě neměřily. Lokální testy nenahrazují kontrolní vzorek výsledků.
- **Pozůstatky datových oprav druhé AI:** report `promo-data-fixes-2026-11-04/RESULT.md` upozorňuje na chybějící přesměrování skrytých seriálů a ruční zámek přihlášek osmi kol Dětského MTB Cupu. Zámek blokuje i budoucí správný odkaz. Tyto body se nesmějí ztratit v obecném „hotovo“; nejsou součástí dnešních ochranných oprav.

Dnešní kontrola nevytvořila závody, neslučovala produkční záznamy, nespustila hromadný sběr a nespotřebovala rozpočet na volání modelů. Změny databáze zahrnují definice dvou ochranných funkcí. Kontrola našla nula zdrojů s automatickým markerem `[auto-bez-zavodu]`, takže nebylo potřeba obnovovat zdroje vypnuté původním pravidlem. Ruční úklid druhé AI se neměnil.

## Ověření a vydání

- Kompletní sada: **234 souborů, 1 556 testů prošlo**. Kontrola typů, cílený lint a produkční sestavení prošly. Při sestavení neběžel sběr dat.
- Zkoušky `scripts/test-fruitless-sources.mjs`, `scripts/test-calendar-freshness.mjs` a `scripts/test-local-runner.cjs` prošly.
- Databázové změny aplikovány: `require_complete_reads_before_auto_pause` (`20261105070628`) a `scope_calendar_observations_to_listed_rows` (`20261105070652`). Jejich přítomnost ověřena samostatným čtením. Druhá migrace se při prvním volání vrátila kvůli kolizi časového ID migrace; po ověření úplného rollbacku bylo opakované volání úspěšné.
- Soukromá kopie na Macu aktualizovaná `07:12:28 UTC`; otisky čtyř změněných provozních souborů souhlasí se zdrojem. Po aktualizaci je Mac nadále v pauze, bez potomka a bez serverového požadavku. Tři veřejné detaily (Road Stage Orlické hory, Peklo Severu, JBC) byly při převzetí dostupné se správnými názvy. Konkrétní nasazení dnešní opravy je v doplnění níže.

### Možnost návratu

Vrátit konkrétní aplikační commit; nová databázová funkce je přídavná a starým kódem se nepoužije. Při potřebě odstavit automatický úklid zdrojů použít dočasnou funkci bez změn, ne obnovit nebezpečné počítání chyb jako prázdných čtení. Databázové definice i izolované zkoušky jsou ve verzovaných migracích. Před návratem ponechat scany v pauze.
