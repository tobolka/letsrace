# Let's Race: co zbývá udělat (hlavní seznam)

Stav k 20. 11. 2026. Tohle je jediné místo pro rozpracované a zapomenuté úkoly. Jen to, co teprve přijde; hotové věci se odsud mažou. Dokumenty, ze kterých se úkoly sebraly, jsou smazané a zůstávají v historii gitu (`git log --stat -- docs/<soubor>.md`). Čísla jsou z místní kopie katalogu na Macu, pokud není uvedeno jinak.

## Kde co najít

| Dokument | K čemu |
| --- | --- |
| [hosting.md](hosting.md) | Kde co běží (Cloudflare Worker, Supabase, Mac), nasazení, limity, ochrana |
| [keep-fresh.md](keep-fresh.md) | Provoz Macu a serveru: kroky cyklu, limity AI, jak číst stav |
| [pipeline-v2.md](pipeline-v2.md) | Návrh a stav brány návrhů, fronty a agenta |
| [pipeline-write-paths.md](pipeline-write-paths.md) | Kdo všechno zapisuje do katalogu |
| [race-completion-system.md](race-completion-system.md) | Jak se závod dokončuje z propozic, pořadí zdrojů, zásada „nejdřív sbírat“ |
| [annual-editions.md](annual-editions.md) | Pravidla pro nové ročníky |
| [emails.md](emails.md) | Zapnutí e-mailů (Resend, Supabase Auth) |
| [product-analytics.md](product-analytics.md) | Umami: události a metriky |
| [propagace-2026-11/BEZ-OSLOVOVANI.md](propagace-2026-11/BEZ-OSLOVOVANI.md), [TEXTY.md](propagace-2026-11/TEXTY.md) | Odkazy na web bez oslovování pořadatelů, hotové texty |
| `quality/`, `fixtures/` | Kontrolní sady a referenční seznam CZ 2027 (používají je skripty) |

## A. Teď rozpracované

| # | Úkol | Proč (důkaz) | Kdo / závislost | Velikost |
| --- | --- | --- | --- | --- |
| A2 | Změřit, kolik změn data dostalo citaci | Dnes 1 z 69 (`date-proposals`), čtečka `pipeline-v9` se šíří postupně | čas, pár dní | žádná |
| A3 | Odesílání změn data a zrušení přes bránu | Migrace `20261120120000_date_and_cancellation_proposals.sql` je napsaná a vyzkoušená na zkušební databázi; chybí odesílač a nasazení migrace. Změny existujících závodů se dnes neposílají (`--only-new-races`) | ty souhlasil s migracemi; závisí na A2 | střední |
| A5 | Pořadí zdrojů u místa, názvu a harmonogramu: sledovat rozpory propozice × záznam v `pipeline:status` (dnes místo 29 z 490, země 1, dny programu 0) a opravovat automaticky, až budou skutečné chyby | Většina rozdílů v místě je pravopis nebo začátek × cíl trasy; z propozic se nečte název závodu | já, podle čísel | malá |
| A6 | Rozhodnout 28 skupin „stejný web a den“ a případy „50 km × 100 km“, „hlavní × dětský“ | Katalog je drží jako samostatné závody, scorer je slučuje (`dedup-golden.test.ts`) | ty, po dvojicích, ne plošně | produktové rozhodnutí |
| A8 | První běh `audit-source-yield` a napojení mezer na discovery (`discover-races.ts --sources`) | Měření poroste od prvního týdenního běhu | čas, pak já | střední |
| A9 | Referenční kalendáře pro SK, DE, AT, PL (CZ má 51 řádků v `fixtures/`, zmrazená sada v `quality/`) | Chybí ověření, kolik závodů nenacházíme | já nebo ty (výběr zdrojů) | střední |
| A10 | Hledání nových webů bez Brave: čtečka odkazů z kalendářů, sérií a portálů | Brave: 977 dotazů dalo 64 odkazů, je vypnutý | já | střední |
| A11 | Itálie: ne adaptér na portál, ale zobrazit okno přihlášek a kontakt na pořadatele z detailu FCI | Přihláška u 51 z 215 závodů, roztříštěně (`endu.net` asi 10). Detail FCI má „Iscrizioni“ jen jako data a e-mail s telefonem | ty (produkt) | malá až střední |
| A12 | Itálie: web pořadatele chybí u 130 z 215 (80 bez webu, 50 jen `rideandrest.net`) | Bez webu není propozice ani přihláška | závisí na A10 | střední |
| A13 | Denní strop AI odvozovat ze zbytku měsíce (útrata po krocích se zapisuje, vyhodnotit za týden) | Strop 0,50 USD × 30 je víc než měsíční limit | já, za týden | malá |
| A14 | Tvrdý měsíční limit v Anthropic Console, o něco vyšší než projektový (10 USD) | Projektový limit je jen vlastní pojistka | ty | malá |
| A15 | rad-net (Německo): uložená stránka jako vstup, nebo se zeptat BDR na export | Od 11. 11. za kontrolou robotem Anubis, kterou obejít nesmím | ty | odloženo |
| A16 | Smazat kód a tabulky nároku pořadatele (dnes skryté za `ORGANIZER_CLAIMS=1`) | Použito 0× | ty, až budeš chtít | odloženo |
| A17 | Ověřit, zda server drží stejná čísla jako místní kopie | Všechna měření jsou z kopie | já | malá |
| A18 | Ověřit `revalidateTag` v `organizer-publish.ts` na Cloudflare | Hosting nemá tag purge (`hosting.md`) | já | malá |
| A19 | Opravit zbylé staré údaje v dokumentech (interval správce, AI dny) | Rozcházejí se s kódem | já | malá |
| A20 | Neověřeno: Chrome v krocích GitHub Actions; hranice předpověď × klima u počasí | Nečteno v kódu | já | malá |

**Vědomě nedělat:** přesun čtení do cloudu (sběrač nemá dostávat produkční klíče, Mac běží přes 90 průchodů denně), e-maily pořadatelům, obcházení kontroly robotem.

## B. Zapomenuté nápady ze smazaných dokumentů

### B1. Data a pipeline

| Nápad | Odkud | Poznámka |
| --- | --- | --- |
| Hierarchie důvěryhodnosti zdrojů pro všechna pole, ověřovací sada identit s popisky, trvalé rozhodnutí o každém kandidátovi, vrácení libovolné změny pole (ne jen sloučení) | `pipeline-architecture` (zbývající omezení) | Souvisí s A5 |
| Další pole přes bránu: `registration_url`, `website_url`, praktické údaje. Brána je přísnější, proto vrátit se, až budou stránky ročníku 2027 | `pipeline-v2-handoff` | Souvisí s A3 |
| Kroky cyklu jako úlohy ve frontě (až bude druhý pracovník potřebovat víc než hledání propozic) | `pipeline-v2-handoff` | Odloženo |
| Kontrola veřejných stránek podle druhu změny a souhrn v administraci | `pipeline-v2-handoff` | Mění web, vyžaduje nasazení |
| `test-local-sync.cjs` padá na duplicitním klíči ve zdrojích závodů | `pipeline-v2-handoff` | Zkouška celého převozu na živých datech |
| Nezávislý pilot: kontrolní sada bez ladění na odpovědích, porovnání před/po včetně ceny a tvých minut; cílené zveřejnění změny místo plošného překreslování; schopnost pokračovat po chybě | `operations-autonomy-plan` | Základ pro A8, A9 |
| Hledání nových závodů: dotazy po `zemi × sezóně × disciplíně`, pak kraje a měsíce; fronta dotazů pro známé závody bez ročníku 2027; kalendáře a příspěvky jako tipy, ne jako zamítnuté weby | `parallel-race-discovery` | Souvisí s A10; bez Brave |
| Agent: týdenní náhodný vzorek rozhodnutí, druh rozhodnutí s chybou se sám vypne, týdenní souhrn vzorů (kandidáti na pravidla), vypnout agenta, když čísla dva týdny neporostou | `race-agent` | Agent dnes běží na Codexu přes `agent-desk.cjs` |
| Zdroje pro ručně přidané seriály: ověřit, že watcher čte jejich stránku. `prahamtb.cz` není sledovaný zdroj ačkoli `parsePrahaMtb` existuje. Noční kontrola: počet událostí ze zdroje série vs. katalog | `series-integrity-handoff`, `data-quality-audit` | Ruční vložená kola Prima Cupu bez data nejdou obnovit čtečkou |
| Uzávěrky přihlášek z platforem (RaceResult, sportsoft, dostartu); Polsko (`odjazd.pl` bez kategorií i po vykreslení) a Švýcarsko | `data-quality-audit` | |
| Švýcarské kódy `E M`, `E F`, `F E` se nemapují na elite; české dráhy z UCI bez města (doložit na webu pořadatele); Due Giorni del Mare má v UCI rok 2026 a termín 2027 | `handoff-2026-11-18-race-cleanup` | Malé úlohy pro čtečky |
| Z 219 zdrojů „k posouzení“ nebo „chyba“: 97 stránek má několik plných dat a čtečka nic nevytáhne, tedy chybí čtečka, ne web | `handoff-2026-11-18-race-cleanup` | Počty z 18. 11. |
| Cíl úplnosti: aspoň 90 % nadcházejících závodů v každé z CZ, SK, AT, DE (web, souřadnice, disciplína, kategorie ze zdroje) | `catalog-completeness` | Cíl z 5. 10. nedosažen |

### B2. Kategorie a kvalita

| Nápad | Odkud |
| --- | --- |
| Potvrzení kategorií od lidí („Pojede tu Jonáš (U11)?“, tři shodné odpovědi nebo jedna od pořadatele) | `data-quality-categories` |
| Kategorie z jednoho kola seriálu rozšířit na všechna jeho kola (jako `explicit` se zdrojem „seriál“) | `data-quality-categories` |
| Stránka „Kategorie k ověření“ v administraci, seřazená podle zájmu návštěvníků | `data-quality-categories` |
| Podíl `explicit` / `default` / prázdné podle zdroje a země v přehledu kvality | `data-quality-categories` |
| Chyby z hledání víkendového závodu: „#02 Hannover“ jako Česko, „Cykloklub Chýnov“ jako možný duplikát JANEV CUP Chýnov, „PARKBIKE Ostrov“ bez disciplíny | `data-quality-categories` |

### B3. Produkt a SEO

| Nápad | Odkud |
| --- | --- |
| Detail závodu: kam přesně přijet (areál × obec × start), kdy být na místě (prezentace, starty), kolik zaplatím a do kdy, která varianta je pro mě, GPX a převýšení, podmínky účasti, co je proti loňsku jinak, kdo pořádá a odkud údaj máme. Bez fiktivních hodnocení a bez „vhodné pro začátečníky“ z délky | `race-series-next-content` |
| Detail seriálu: kalendář všech kol s přepínačem sezón, srovnání kol v tabulce, pro koho seriál je, jak se hodnotí pořadí, celkové náklady jen z úplných cen, mapa kol, přidat kola do plánu | `race-series-next-content` |
| Trasa: GPX parser, mapa s profilem převýšení a stažení GPX, typované řádky tratí, programu a poplatků se zdrojem a citací (část praktických údajů už je) | `event-detail-depth` |
| SEO: stejná fakta v detailu, seznamech, mapě, metadatech i sitemapě; strukturovaný pořadatel a areál v JSON-LD; sezónní stránky „Cyklistické závody Česko 2027“, „MTB“, „Dětské“; kraje až po kontrolovaném přiřazení obcí; stránka trvalé identity závodu; hreflang podle skutečných překladů | `seo-next-steps` |
| Vložitelný widget „Termíny seriálu“ pro weby pořadatelů a klubů. Stavět jen když o něj bude zájem | `propagace-2026-11/PLAN` |
| Zmenšit sitemapu jen na přehledy a české závody, pokud počet procházených a indexovaných stránek za 4 až 6 týdnů neroste | `propagace-2026-11/PLAN` |

### B4. Provoz a bezpečnost

| Nápad | Odkud |
| --- | --- |
| Supabase Security Advisor: vypnutá ochrana proti uniklým heslům, PostGIS ve veřejném schématu. Projít přihlašování s testovacím účtem a ověřit doručení e-mailů a povolené redirect URL | `launch-review-2026-09-12` |
| Supabase přenos: filtrované `/api/events` pro mapu se při chybění v CDN ptají databáze; sledovat graf využití (free plán 5 GB, jednou překročeno) | `supabase-usage` |

## C. Poznámky ze správy seriálů (z `series-integrity-handoff`)

- Víkendová kola musí mít v `end` neděli. Po sobě jdoucí jednodenní kola používají `swallowUntil`, aby se okna nepřekrývala.
- Číst celou stránku, ne homepage: kalendáře Talent Cupu a PKK jsou na `zavody.php`, partnerská kola `iprimacup.cz` mají vlastní adresy.
- Některé weby občas vrací 403 botovi, přepínač je `BROWSER_UA_HOSTS` v `src/lib/watcher/http.ts`.
- MČR uvedená v kalendáři Českého poháru MTB se zařazuje do `cesky-pohar-mtb` jako „MČR …“.
- Místo z agregátoru („Soumar“, „NMNM“) se geokóduje kamkoli. Po opravě vždy projít `locations` a opravit podle obce.
- `series.website_url` nevěřit slepě: seriál z agregátoru může mít web klubu nebo sponzora. Při opravě nastavit na hostitele kalendáře.
- Filtr „Libovolné datum“ je od dneška nahoru, kromě filtru seriálu, který ukazuje celý rok (záměr, `src/lib/events.ts`).
