# LetsRace: plán produktového měření v Umami

Datum auditu: 26. 10. 2026. Stav: návrh, bez implementace a bez změn v produkci.

**Oprava po ověření živého webu:** Umami už je nasazené. Prohlížeč na `https://letsrace.cz/cs` načítá `https://stats.letsrace.cz/s.js` (`id=umami-analytics`), website ID `21150631-b65b-4b9e-966e-c87fb90e14e2`, `data-host-url=https://stats.letsrace.cz`, `data-domains=letsrace.cz`, `data-do-not-track=true`, `data-exclude-hash=true` a `data-before-send=letsraceAnalyticsBeforeSend`, strategie `afterInteractive`. Skript vrací HTTP 200 a vystavuje Umami API `track`, `identify`, `getSession`. Produkční bundle obsahuje komponentu `Umami`, kontrolu hostname a GPC/DNT; jeho `DeferredVitals` načítá pouze Speed Insights. Místní pracovní strom obsahuje starší odlišnou integraci s Vercel Analytics. První verze plánu chybně zobecnila lokální nález na produkci. Další práci je nutné založit na nasazené integraci a nejdřív dohledat její zdrojový commit/checkout. Není důvod zakládat druhou instanci ani přidávat další tracker. Načtení skriptu a konfigurace je ověřené; doručení konkrétních událostí v dashboardu a úplnost sanitizace zatím ověřené nejsou.

## Doporučení

Začít deseti typy událostí a třemi přehledy: **které sekce lidé navštěvují**, **jestli při hledání najdou závod** a **zda pokračují na registraci nebo si závod uloží do plánu**. Hlavní produktový signál je postup od procházení ke konkrétnímu závodu. Registrace a uložení jsou dva samostatné navazující výsledky. Nepřevádět jejich součet na počet spokojených uživatelů.

Nejdřív zavést důvěryhodný základ. Teprve podle dat přidávat podrobnější měření. Není potřeba sledovat každý pin, posun mapy, scroll nebo otevření nabídky.

## 1. Co je skutečně v aplikaci

Funkce aplikace byly ověřeny čtením pracovního stromu. Po upozornění uživatele bylo navíc ověřeno načtení a konfigurace Umami v prohlížeči na živém webu a příslušný veřejný produkční bundle. Přístup do účtu analytiky neproběhl. Lokální nálezy níže nejsou automaticky stavem produkce.

| Oblast | Nález a důsledek pro měření |
| --- | --- |
| Stávající analytika | Produkce už má Umami na `stats.letsrace.cz/s.js` a samostatné Speed Insights. Místní `root-document.tsx`/`DeferredVitals` se liší a stále obsahují Vercel Analytics. Před změnou integrace dohledat nasazený zdroj; nepřidávat druhý loader. |
| Stávající události v lokálním kódu | `outbound_enter` se slugem a druhem odkazu; `open_race_page`; `share_native`; `share_link`. Jsou rozptýlené mezi panel detailu, embedded detail, trust row, sdílení a samostatnou stránku závodu. Přítomnost volání v kódu nedokazuje doručování do produkční analytiky. |
| Procházení | Mapa, seznam, závodní kalendář (`schedule`), rozcestník zemí a disciplín, seriály a kolekce. `calendar` je stará cesta přesměrovaná na osobní plán, nikoliv závodní kalendář. |
| Osobní část | Plán (`account`), doporučení, oblasti/upozornění (`account/alerts`), jezdci a nastavení. V navigaci mohou doporučení a oblasti sdílet aktivní položku; analytika má rozlišit skutečnou stránku. |
| Filtry | Text, kategorie, disciplíny, úroveň, seriál, země, datum, vzdálenost, řazení. Filtry cestují mezi pohledy v URL a obnovují se z preferencí. Automatické obnovení není akce uživatele. |
| Hledání v mapě | Po 400 ms se nejdřív hledá závod; při nulovém nálezu a textu délky alespoň 3 znaky následuje hledání místa a přesun mapy. Hledání rozšiřuje datum na nadcházející závody. První nulová odpověď proto ještě není neúspěšné hledání. |
| Seznam a kalendář | `useRaceFeed` používá po první odpovědi debounce 250 ms a má stavy `loading`, `settled`, `failed`. Hledání místa není stejná cesta jako v mapě. |
| Výsledky mapy | Načtená data zahrnují přesah mapy. `useMapList` z nich odvozuje skutečně viditelný seznam. Některý otevřený závod může být v datech ponechán i mimo aktuální dotaz. Počet načtených řádků tedy nelze použít jako počet zobrazených výsledků. |
| Chyby mapy | `useMapFeed` vrací `null` i pro chybu nebo překonaný požadavek; `listSettled` samo o sobě neznamená úspěšné načtení. Před implementací měření je potřeba explicitní stav úspěchu/chyby a kontrola HTTP odpovědi. |
| Detail | Panel nad mapou, panel v dalších pohledech, mobilní sheet a samostatná stránka `/e/[slug]`. Otevření detailu nesmí záviset jen na změně pathname. |
| Odchozí akce | Registrace, web pořadatele, alternativní listing, propozice, výsledky a navigace na místo. Primární tlačítko může místo registrace vést jen na web/listing. |
| Uložení | `SaveRaceButton` a `src/lib/saved-races.ts`: nepřihlášený uživatel otevře přihlášení, závod se může uložit až po návratu z něj. Kliknutí není dokončené uložení. Již uložené tlačítko vede do plánu. |
| Soukromí v lokálním kódu | Lokální privacy ve všech pěti jazycích uvádí Vercel Analytics. Produkční znění je třeba samostatně porovnat s nasazeným Umami a rozsahem nových událostí; nepředpokládat jeho shodu s lokálním souborem. |

Hlavní integrační místa: `src/components/shell/nav-items.ts`, `app-rail.tsx`, `root-document.tsx`, `src/components/explore/explore-shell.tsx`, `use-map-viewport.ts`, `use-map-feed.ts`, `use-map-list.ts`, `event-detail-panel.tsx`, `event-detail-model.ts`, `src/components/shell/use-explore-filters.ts`, `use-race-feed.ts`, `src/components/seo/outbound-track-link.tsx`, `src/lib/saved-races.ts` a stránka závodu v `src/app/[locale]/(shell)/e/[slug]/page.tsx`.

## 2. Produktové otázky a metriky

Všechny poměry zobrazovat s čitatelem, jmenovatelem a obdobím. „Návštěvník“ znamená anonymní identitu Umami, nikoliv zaručeně jednoho člověka. „Hledání“ je dokončené zpracování dotazu, nikoliv návštěvník nebo návštěva.

| Otázka | Metrika / přesná definice | Rozhodnutí a omezení |
| --- | --- | --- |
| Které sekce lidé otevírají? | Počet `section_view` podle `section`; přes API také unikátní anonymní identity s danou sekcí / identity s alespoň jednou sekcí. | Priorita navigace a obsahu. Součet podílů může překročit 100 %, protože člověk navštíví více sekcí. Počet událostí není počet lidí. |
| Vedeme z procházení ke konkrétnímu závodu? | Nativní funnel: vstup na konkrétní katalogovou cestu → `race_detail_view`, okno 30 minut mezi kroky. Pro mapu, seznam a kalendář samostatně. Souhrnný přes všechny sekce až přes ověřený report/API. | Změnit relevanci výsledků, jejich podobu nebo navigaci. Otevření není důkaz vhodnosti závodu. SEO vstupy přímo na detail nepatří do jmenovatele tohoto funnelu. |
| Funguje hledání? | Počet `search_completed` s `outcome=zero` / počet úspěšně dokončených hledání (`outcome=results` nebo `zero`). Vedle toho samostatně počet chyb. | Rozlišit nedostatek závodů a problém hledání. Ve jmenovateli nejsou překonané požadavky, zrušené dotazy ani chyby. |
| Které filtry končí prázdně? | Počet `results_view` s `result_count=0` a `trigger=filter` / všechny úspěšné `results_view` s `trigger=filter`, podle výsledné kombinace filtrů. | Upravit výchozí datum, kombinace filtrů nebo pokrytí katalogu. Nula v mapě je regionální nález, nikoliv důkaz chybějícího závodu v celém katalogu. |
| Pokračují lidé k přihlášení? | Funnel `race_detail_view` → `registration_outbound`, okno 30 minut mezi kroky. Vedle toho tentýž funnel pro detaily s `has_registration=true`, pokud instance umožní potřebný filtr; jinak přes API. | Zlepšit detail a dostupnost registrací. Jde o kliknutí, nikoliv dokončenou registraci nebo návštěvu cílového webu. Nativní funnel bez dalšího nezaručuje stejný závod v obou krocích. |
| Má plán hodnotu a neblokuje ho login? | Počet `plan_save_completed`; funnel `plan_save_requested` → `plan_save_completed`, 30 minut. Přes API zvlášť `auth_required=true/false` a vazba na stejnou operaci. | Opravit ukládání nebo přihlášení. Úspěch emitovat po potvrzeném novém zápisu, ne po kliknutí či synchronizaci. |
| Chybí možnost dalšího kroku? | Podíl zobrazení detailů bez registrace a bez jakéhokoli hlavního odchozího odkazu, podle vlastností detailu. | Priorita doplnění dat místo úprav tlačítek. Vhodnost odkazu se tím neověřuje. |
| Vracejí se lidé? | Nativní měsíční Retention, konkrétně D7 u již dozrálých denních kohort. | Posuzovat opakovanou užitečnost. Nezaměňovat D7 za „vrátil se někdy během sedmi dnů“. Anonymní identita má omezení mezi sítěmi, prohlížeči a rotačními obdobími. |

První 2–4 týdny slouží jako výchozí stav, pokud objem provozu dovolí smysluplné porovnání. Žádné předem vymyšlené cílové konverze. Změny vyhodnocovat při srovnatelném zdroji návštěv, zařízení a sezóně. Ukazovat i absolutní počty a nejistotu; u malých segmentů agregovat delší období. Vyšší používání mapy samo o sobě nedokazuje, že mapa zlepšuje konverzi.

## 3. Datový kontrakt

- Názvy událostí: anglicky `snake_case`, stabilní, do 50 znaků; žádné ID ani lokalizované popisky v názvu. Kontrakt má `schema_version=1`.
- Společný kontext podle potřeby: `section`, `locale`, `surface` (`desktop`/`mobile`), `source` z uzavřeného seznamu. Zařízení a akvizici využít primárně z vestavěných dat Umami.
- Závod identifikovat `race_id=EventListItem.id`. `race_slug` může být doplňkový pro čitelnost; nenahrazuje ID. Nový ročník s novým ID je samostatná katalogová událost. Po sloučení duplicit potřebuje dlouhodobé API vyhodnocení mapu přesměrovaných ID; fingerprint ani název nejsou stabilní identifikátory.
- U závodu lze připojit veřejnou zemi, disciplínu a vlastnosti `has_registration`, `has_primary_outbound`, `is_past`. Neodvozovat věk ani rodinné poměry návštěvníka z jeho filtru kategorií.
- Snapshot filtrů: `country_set`, `discipline_set`, `category_set`, `level_set` jako seřazené krátké kanonické hodnoty; `series_id`, `date_mode`, `date_span_bucket`, `radius_km`, `has_query`, `geo_scope=viewport|radius|global`. Prázdná sada má jednotnou hodnotu `all`. Rozmezí data popsat jako `this_weekend|upcoming|custom|any` a délku `1_7|8_31|32_90|91_plus|open`.
- Neposílat text dotazu ani jeho hash, GPS, přesné bounding boxy, uživatelská/rodinná ID, jména, e-maily, obsah formulářů, tokeny nebo celé cílové URL. Dotaz charakterizovat jen `query_length_bucket` a skutečnou větví `race|place|no_match`. Vyloučit libovolné hodnoty URL i referreru a titulky obsahující osobní údaje.
- `operation_id` je krátké náhodné ID jedné interakce, ne člověka. Použít pouze pro vazbu request→výsledek a ukládání, pokud bude skutečně využit API rozbor. Nezobrazovat jako běžnou dimenzi; raw query ani GPS nepoužít k jeho tvorbě.
- Data držet plochá a krátká. JavaScript API zachová čísla a booleany; HTML atributy je převádějí na řetězce. Proto použít jeden typovaný JavaScript helper. [Události](https://docs.umami.is/docs/track-events), [tracker API a limity](https://docs.umami.is/docs/tracker-functions).

## 4. Plán událostí

P0 = první zavedení; P1 = až po zhodnocení základu. Příklady jsou ukázky kontraktu, ne skutečná naměřená data.

| Událost | Přesný trigger | Vlastnosti a příklad | Produktová otázka / rozhodnutí | Priorita |
| --- | --- | --- | --- | --- |
| `section_view` | První skutečné zobrazení cílové sekce po přímém vstupu nebo dokončené navigaci. Až za případným redirectem nebo přihlašovací bránou. | `section=list`, `section_group=discover`, `locale=cs`, `surface=mobile`, `entry_type=route`. | Které části produktu mají dosah? Priorita navigace a obsahu. | P0 |
| `results_view` | Poslední platný úspěšný výsledek je skutečně vykreslen; při prvním načtení a ustálené změně dotazu/filtru, nikoliv při každém renderu. | `trigger=initial|search|filter|viewport`, `result_count=0`, `result_bucket=0|1_5|6_20|21_plus`, `geo_scope=viewport`, snapshot filtrů, případně `operation_id`. | Kde je prázdno? Upravit pokrytí, výchozí filtry nebo rozsah mapy. | P0 |
| `search_completed` | Poslední platné hledání dokončí i případný fallback na místo a vykreslení výsledků; jedna událost na dokončenou operaci. | `mode=place`, `outcome=results|zero|error`, `result_count=8`, `submit_method=debounce|enter|initial_url`, `query_length_bucket=3_5`, snapshot, `operation_id`. | Funguje hledání závodu i místa? Upravit konkrétní větev. | P0 |
| `filters_applied` | Uživatel změní výsledný stav filtrů; více změn v jednom batchi/slidu sloučit. Obnova preferencí ani automatické rozšíření data při hledání triggerem nejsou. | `changed_group=date`, `action=set|clear|reset`, snapshot výsledného stavu, `operation_id`. | Které možnosti lidé potřebují? Upravit pořadí a výchozí nastavení filtrů. | P0 |
| `race_detail_view` | Závod je skutečně zobrazen v aktivním panelu/sheetu nebo na stránce. Jednou na otevření daného závodu v daném povrchu. | `race_id=<id>`, `presentation=panel|sheet|page`, `source=map_pin|map_list|list|schedule|browse|series|collection|plan|recommendations|direct|internal_unknown`, `has_registration=true`, `has_primary_outbound=true`, `is_past=false`. | Co vede ke konkrétnímu závodu a které detaily nenabízejí další krok? Upravit výsledky a doplnit data. | P0 |
| `registration_outbound` | Aktivace skutečného registračního odkazu; ne každého primárního CTA. Odkaz otevřít bez čekání na analytiku. | `race_id=<id>`, `presentation=sheet`, `placement=primary`, `destination_host=<host>`. | Pokračují lidé na registraci? Upravit CTA a registrační data. | P0 |
| `race_outbound` | Aktivace ostatního závodního odchozího odkazu. S registrační událostí vzájemně výlučné. | `race_id=<id>`, `kind=website|listing|regulations|results|directions`, `presentation=page`, `placement=secondary`, pouze hostname. | Potřebují lidé pořadatele, propozice, výsledky nebo cestu? Upravit informace v detailu. | P0 |
| `plan_save_requested` | Uživatel žádá nové přidání závodu. Kliknutí na již uložený závod sem nepatří. | `race_id=<id>`, `source=list`, `auth_required=true`, `operation_id=<id>`. | Kolik zájmu o plán narazí na přihlášení? Rozhodnout o úpravě této cesty. | P0 |
| `plan_save_completed` | Potvrzené nové uložení závodu včetně odloženého uložení po přihlášení; emitovat z centrálního save toku. | `race_id=<id>`, `source=list`, `auth_required=true`, `operation_id=<stejné-id>`. | Kolik záměrů se promění v uložený závod? Opravit skutečné ztráty. | P0 |
| `action_failed` | Konečná chyba výsledků, detailu nebo uložení, která se projeví uživateli. Bez abortů, duplicit a překonaných požadavků. | `action=results|detail|plan_save`, `error_class=network|http|invalid_response|permission|unknown`, `section=map`, bez chybové zprávy a URL. | Je propad produktu ve skutečnosti technická chyba? Priorita opravy před redesignem. | P0 |
| `navigation_click` | Výslovná aktivace odkazu v hlavní navigaci; až pokud bude potřeba hodnotit její umístění. | `from_section=map`, `to_section=plan`, `placement=sidebar|tabbar|more|account_menu`. | Kudy lidé sekce objevují? Upravit sidebar/tabbar. Kliknutí samo nepotvrzuje zobrazení cíle. | P1 |
| `race_share_completed` | Úspěšné zkopírování odkazu nebo dokončené předání do native share API; zrušení nepočítat. | `race_id=<id>`, `method=clipboard|native`. | Má smysl zlepšit sdílení? Neříká, že adresát odkaz otevřel. | P1 |
| `detail_section_seen` | Nejméně 50 % sledovaného bloku je vidět aspoň 1 s v aktivní stránce; u dlouhého bloku použít krátký označený začátek. Jednou na blok a otevření detailu. | `race_id=<id>`, `detail_section=about|location_map|series_rounds`, `presentation=page`. | Dostanou se lidé k popisu, mapě a dalším kolům? Upravit pořadí informací. Viditelnost nedokazuje čtení. | P1 |

`results_view` s nulou nahrazuje zvláštní událost `zero_results`. `search_completed` a `results_view` nejsou dvě hledání: první diagnostikuje operaci hledání, druhá stav výsledků. Nelze je sčítat.

### Které sekce se otevírají

Tohle je samostatný P0 přehled, nikoliv až druhá fáze:

| Kanonická sekce | Skupina | Interní route; veřejná adresa se odvodí přes `localePath` |
| --- | --- | --- |
| `map` | `discover` | Kořen konkrétního jazyka |
| `list` | `discover` | `list` |
| `schedule` | `discover` | `schedule`; závodní kalendář |
| `browse_countries` | `browse` | `c` |
| `browse_country` | `browse` | `c/[code]` |
| `browse_discipline` | `browse` | `c/[code]/[discipline]` |
| `series` | `browse` | `series/[slug]` |
| `collection` | `browse` | `collections/[slug]/…` |
| `race_page` | `race` | `e/[slug]` |
| `plan` | `personal` | `account`; také cíl starého `calendar` |
| `recommendations` | `personal` | `account/recommendations` |
| `alert_areas` | `personal` | `account/alerts`; staré `alerts` po vyřešení cílového redirectu |
| `riders` | `personal` | `account/riders` |
| `settings` | `personal` | `account/settings` |
| `about`, `privacy` | `info` | Odpovídající informační stránky |

Mapování dělat podle interních identifikátorů a `localePath`, ne podle českých názvů nebo jediného URL prefixu. Veřejné české cesty jsou například `/cs/seznam`, `/cs/kalendar`, `/cs/muj-plan` a `/cs/zavod/[slug]`; interní `calendar` redirect není veřejný kalendář `schedule`. Kolekce mají také lokalizované cesty pod rozcestníkem závodů, proto rozpoznání musí využít existující překlad rout. Nejkonkrétnější route vyhodnotit před rodičem `account`. Na jednu stránku emitovat jednu leaf sekci s vlastností `section_group`; neposílat navíc rodičovskou sekci. Nezařazená veřejná route má `other` a při QA se prověří.

Změna `q`, kamerových souřadnic, filtrů nebo parametru `e` nevytváří novou návštěvu sekce. Přechod mapa → seznam → mapa znamená tři zobrazení sekcí. Detail v panelu je `race_detail_view`, nikoli druhý `section_view=map`. Samostatná stránka závodu má pageview, `section_view=race_page` a `race_detail_view`; jsou to různé metriky a nesčítají se. Prefetch, skrytá mobilní/desktopová kopie UI, skeleton, redirect nebo neúspěšná navigace nejsou návštěvou sekce.

V prohlédnutém detailu nejsou sekce „O závodě“, mapa a další kola akordeony. Nelze je vykazovat jako otevření rozbalovací sekce. Jejich dosažení lze volitelně měřit pomocí `detail_section_seen`. Samotné roztažení mobilního sheetu lze doplnit až při konkrétní otázce o jeho použitelnosti.

### Dokončení a deduplikace

1. Oddělit počátek operace, poslední platný výsledek a jeho vykreslení. Staré requesty, aborty, prefetch a React remount nesmějí vytvářet úspěšnou událost.
2. U mapy výsledek až po race-search → případném place-search → finálních závodech. Nenalezené místo a chyba geokódování musí mít odlišný výsledek. Nula z prvního kroku není finální nula.
3. Zaznamenat `result_count` podle skutečně filtrovaných výsledků v daném pohledu před stránkováním; ne podle přesahu mapy ani počtu řádků právě přítomných v DOM. Ponechaný otevřený závod nezapočítat jako shodu. Automatické lety mapy nesmějí vyrobit další uživatelské hledání.
4. Zachovat současné chování hledání. Analytika čeká na poslední platnou a viditelnou odpověď. Debounce znamená dokončené provedení dotazu, ne důkaz definitivního záměru uživatele. Rychlé psaní ruší čekající měření; Enter nad již dokončeným nezměněným dotazem bez nové operace nepočítat znovu. Opravdu nová interakce se stejným textem později se počítat může.
5. Pohyb mapy agregovat až po ustálení (návrh 800 ms bez dalšího pohybu), jen pokud se skutečně změnil rozsah a zobrazený výsledek. Neměřit souřadnice ani každý frame.
6. Stabilní dedupe klíče držet v paměti pro danou operaci/route/opening, ne přes trvalou identitu návštěvníka. Na detailu se změnou závodu A→B vzniknou dvě události; změna velikosti sheetu a re-render téhož závodu další událost nevytvoří. Zavření a nové výslovné otevření může být nové zobrazení.
7. Jen jedna vrstva odesílá odchozí kliknutí; nepoužívat zároveň HTML autoevent a ruční handler. Zapojit i navigaci na místo, nyní bez stejného měření jako hlavní CTA.
8. Uložení měřit v centrálním save toku. Obnova již uložených závodů, opakované přihlášení nebo idempotentní save již existující položky nejsou nový úspěch. Neúspěch ukládání je `action_failed`; opuštění loginu není technická chyba.

## 5. Uživatelské cesty a skutečné možnosti Umami

Aktuální oficiální dokumentace je pro Umami v3. Vlastní události, jejich vlastnosti, funnely, journeys a retention jsou dostupné i v self-hosted variantě. Před setupem je nutné ověřit konkrétní verzi instance a její oprávnění, nikoliv předpokládat aktuální Cloud UI. [Přehled produktu a dostupnosti](https://umami.is/product-analytics).

- **Procházení:** mapa / seznam / kalendář → `race_detail_view` → `registration_outbound`.
- **Hledání:** `search_completed` → `race_detail_view` → registrace nebo uložení. Filtrovat zvlášť výsledek hledání a pohled; samo otevření jiného závodu později nemusí být výsledek daného dotazu.
- **Přímý detail:** samostatný vstup na závod → `race_detail_view` → registrace nebo web. Nepožadovat předchozí návštěvu mapy.
- **Plán:** `plan_save_requested` → případné přihlášení → `plan_save_completed` → pozdější návštěva `plan`.
- **Orientace v produktu:** skutečná `section_view` → další sekce; Journey může ukázat posloupnost vlastních událostí, ovšem filtr vlastností a čitelné rozlišení sekcí v konkrétním UI ověřit. Záložní nativní Journey stavět z URL, sekce přesně agregovat přes API.

Funnel podporuje uspořádané kroky URL nebo událostí a maximální prodlevu **mezi sousedními kroky**, nikoliv automaticky celkový čas cesty. Návrh 30 minut je analytická volba, ne výchozí hodnota Umami. Nejde o podíl prostých počtů událostí. [Dokumentace funnelů](https://docs.umami.is/docs/funnel).

**Hranice nativních reportů:** dokumentace funnelu potvrzuje URL/event kroky, ne vazbu „tentýž `race_id` či `operation_id` ve všech krocích“. Nezaručuje zde ani libovolné odlišné property podmínky každého kroku. Proto je registrační odchod samostatná událost. Přesné připsání registrace konkrétnímu otevření závodu, deduplikované sjednocení „registrace NEBO uložení“, souhrnný funnel všech katalogových sekcí a recovery po nule vyžadují ověřit možnosti instance nebo malý read-only API report. Nejsou podmínkou první užitečné verze. Pokud API neposkytne potřebné řádkové údaje a vazby, takové metriky nevydávat za vypočtené; nejdřív navrhnout doložený exportní postup.

Segmenty první fáze: mobil/desktop, jazyk produktu, zdroj návštěvy, vstupní stránka, katalogový pohled, závodní země, datumový režim, závod minulý/nadcházející a dostupnost registračního odkazu. Země návštěvníka a země závodu jsou dvě různé dimenze. Členění podle použití filtru nevykládat jako demografii.

Návratovost je odhad. Umami standardně odvozuje anonymní identifikátor z webu, IP, user agentu a rotující soli. Rotace je standardně měsíční; identita se nemusí zachovat při změně prostředí a může sloučit podobné návštěvníky. Nativní Retention je denní kohorta uvnitř zvoleného měsíce. Z něj neodvozovat spolehlivou víceměsíční retenci jednotlivých lidí. V první fázi nepoužívat `identify` ani vlastní trvalý identifikátor. [Identita a definice](https://docs.umami.is/docs/metric-definitions), [retention](https://docs.umami.is/docs/retention).

## 6. Konkrétní produktový přehled

V Umami v3.1+ navrhnout neveřejný website board **LetsRace — Produkt**. Boards jsou nativní dashboardy s widgety; skutečnou dostupnost jednotlivých typů widgetů ověřit. Pokud není některý výpočet nativně možný, použít odkaz na report nebo jasně označený read-only API přehled, nikoliv předstíranou kartu. Ve v2 použít odpovídající reporty bez příslibu Boards. [Boards](https://docs.umami.is/docs/using-boards).

| Část | Obsah | Co udělat při nálezu |
| --- | --- | --- |
| Sekce — P0 | Pořadí `section_view` podle `section`, trend po týdnech; vedle toho nativní Pages/Entry pages. Oddělit procházení, osobní část a info. Jednotlivé závody agregovat do `race_page`. | Málo používaná sekce: nejdřív ověřit její objevení a dostupnost. Vysoký počet views může být i opakované bloudění. |
| Nalezení závodu — P0 | Tři katalogové funnely do detailu, podle zařízení. | Propad jen na mobilu řešit v mobilní navigaci/výsledcích. Propad při stejné návštěvnosti a více nulách řešit jako relevance/data. |
| Hledání a filtry — P0 | Rozdělení výsledků `search_completed`, nuly z `results_view`, top kombinace země/disciplína/datum s dostatečným vzorkem, technické chyby odděleně. | Nuly u úzkého data: prověřit výchozí víkend. Nuly u země/seriálu: prověřit pokrytí. Chyby: opravit načítání. |
| Další krok — P0 | Funnel detail→registrace, detail→ostatní odchod; počet nových uložení; save funnel a podíl detailů bez hlavního odkazu. | Slabé pokračování s chybějícími odkazy je úkol pro data. Slabé pokračování s dostupnými odkazy je hypotéza pro detail/relevanci. |
| Návraty — P0 report | Měsíční Retention, dozrálé D7 kohorty a absolutní velikost. | Porovnávat kohorty ve stejné části sezóny; nízkou denní retenci automaticky nepovažovat za selhání závodního plánovače. |
| Akvizice — samostatně | Referrery, vstupní stránky a bezpečné UTM kampaně, následně kvalita podle postupu do detailu/registrace. | Rozlišit přínos kanálu od růstu neangažovaných návštěv. |

**Týdenní práce, přibližně 15 minut:** porovnat posledních dokončených 7 dnů s předchozími 7 dny ve stejné timezone Europe/Prague; při malém objemu použít 28 dnů. Zkontrolovat zdraví měření, sekce a vstupní mix; pak nuly, postup do detailu a pokračování. Zapsat jednu doloženou hypotézu a jedno produktové opatření. Po release přidat datum a popis změny do analytických poznámek. Nevymýšlet alarm „pokles o X %“ bez základní variability a dostatečného vzorku.

U každého problému postupovat od zdravotního stavu k vysvětlení: doručují se události? Nezměnil se zdroj návštěv nebo počet minulých závodů? Mají lidé výsledky? Otevírají je? Mají v detailu kam pokračovat? Dostanou se přes login při ukládání?

## 7. Návrh technického setupu

### Instance a konfigurace

1. Použít existující Umami na `https://stats.letsrace.cz` a website ID uvedené v opravě auditu. Nejdřív dohledat zdroj aktuálního nasazení a přístup k dané website. V této relaci nebyl nalezen Umami konektor a účet/dashboard nebyl procházen. Nezakládat druhý projekt.
2. U existující instance ověřit přesnou verzi, způsob hostování, region, retenci, případné limity a oprávnění pro reporty. Vlastní hostname a hlavička serveru Vercel samy nedokazují Cloud tarif ani konkrétní region databáze. Migraci hostingu tento plán nenavrhuje.
3. Nejprve převzít skutečné proměnné nasazené integrace; případné rozšíření sjednotit s nimi, nikoli vytvářet druhou konfiguraci. Původně navržené veřejné build proměnné: `NEXT_PUBLIC_UMAMI_SCRIPT_URL`, `NEXT_PUBLIC_UMAMI_WEBSITE_ID`, `NEXT_PUBLIC_ANALYTICS_ENABLED`. Website ID není tajný klíč. Čtecí API token zůstává výhradně na serveru / v zabezpečeném reportovacím prostředí.
4. Zapnutí pouze ve Vercel production scope a na přesně povoleném hostname; `NODE_ENV=production` samo nerozliší preview build. `data-domains` je další ochrana. Lokální vývoj bez síťového odesílání; pro QA oddělená testovací website s vlastním ID, nikoli tag přimíchaný do produkce.
5. Pro produkční analytiku vyloučit admin, API, auth/reset/callback cesty a předprodukční hosty. Osobní stránky dostanou jen obecnou sekci, žádné profilové údaje. Ověřit skutečné veřejné hostnames před nastavením allowlistu.

### Integrace v aplikaci

- Budoucí `src/lib/analytics.ts`: typovaný `trackProductEvent`, povolené eventy a vlastnosti, sanitizace, gate prostředí a ochrana proti selhání. Propojovat přes něj všechny akce. Neznámé vlastnosti zahodit; chybu analytiky nikdy nepředat do uživatelského toku.
- Existující produkční komponentu `Umami` zachovat a případně upravit v jejím skutečném zdroji; žádný druhý loader. Požadavek zůstává jediné načtení `next/script` strategií `afterInteractive`, bez blokování mapy nebo HTML. Před implementací byl přečten lokální guide `node_modules/next/dist/docs/01-app/02-guides/scripts.md` pro zdejší Next 16.4.2. Script v layoutu Next načítá jen jednou během navigací v daném layoutu.
- Existující script nemá `data-auto-pageview=false`, tedy podle prohlédnutého trackeru používá automatické pageviews. Nejdřív ověřit současné chování při změnách query a sanitizační hook. Teprve pokud query-only změny stále vytvářejí přebytečné pageviews, zvážit ruční režim `data-auto-pageview=false` (Umami v3.2+), ostatní inicializaci nechat zapnutou. Odeslat jeden pageview po prvním skutečném vstupu a po změně pathname; ne při změně query. Na starší instanci ověřit vhodný režim podle její dokumentace. Nikdy nekombinovat automatický pageview a druhé ruční route měření.
- `section_view` se emituje s týmž potvrzeným route přechodem. Změna locale může mít nový pageview; filtr sekce ne. Při přihlašovací bráně měřit cílovou sekci až po jejím skutečném zobrazení, ne podle URL v adresním řádku.
- Již zapojený hook `letsraceAnalyticsBeforeSend` nejdřív prohlédnout a otestovat; nevytvářet konkurenční druhý hook. Požadovaný kontrakt: odstranit query/hash z aktuální URL i referreru; interní referrer mimo povolené veřejné cesty zahodit; titulky osobních stránek nahradit obecným názvem sekce. `data-exclude-search`/`data-exclude-hash` přidat jako další ochranu. UTM přebírat jen podle schváleného allowlistu kampaní; ověřit, že sanitizace neobnoví raw query prostřednictvím jiné vlastnosti.
- Do načtení trackeru omezená fronta v paměti (návrh max. 50 událostí / 10 s), s kontextem a časem z okamžiku interakce. Nejprve pageview a sekce, pak akce. Pokud instance nepodporuje bezpečné zachování původního kontextu/času, neodesílat staré akce pod novou stránkou. Bez persistentního backlogu, bez nekonečných retry a bez frontování před případným souhlasem. Blokovaný tracker nesmí blokovat produkt.
- Produkční `DeferredVitals` už podle prohlédnutého bundle načítá jen Speed Insights, migraci loaderu z Vercel Analytics tedy nepovažovat za nehotovou. Porovnat skutečné produkční custom eventy s návrhem a migrovat/doplnit pouze prokázané mezery. Lokální Vercel volání nejsou důkaz, že je stejná migrace potřeba v produkci.
- Přesné počítání výsledků vyžaduje explicitní úspěch/chybu v mapovém feedu a finální dokončení place fallbacku. To je nutná malá podpůrná změna pro spolehlivost měření; zatím nebyla provedena.
- Přidat domény scriptu a ingest endpointu do existující CSP, pokud je aktivní. Žádné obcházení blokátorů přes proxy v první fázi. Automatické outbound trackery, replay a heatmapy nezapínat.

Možnosti nastavení i sanitizační hook vycházejí z [konfigurace trackeru](https://docs.umami.is/docs/tracker-configuration). Hook musí existovat před načtením scriptu. Vlastní události obsahují i výchozí URL/referrer/title kontext, proto sanitizace nesmí pokrývat jen pageviews. [Tracker functions](https://docs.umami.is/docs/tracker-functions).

### Soukromí a souhlas

Návrh minimalizuje data: bez reklamních účelů, bez replay, bez vlastního trvalého ID, bez čtení uživatelských profilů pro analytiku. Vybírané dětské kategorie jsou pouze veřejný katalogový filtr; neposílat identitu ani údaje jezdců/rodiny. Návrh retence: 90 dnů detailních analytických dat, pokud to vybraný hosting umožní; při jiné retenci ji výslovně uvést před spuštěním.

Umami uvádí cookieless provoz a možnost použití bez cookie banneru. To není dostatečný důkaz, že každá konkrétní integrace nepotřebuje souhlas: před spuštěním ověřit síťový payload, používaná browser API/úložiště, účely a podmínky hostingu. IP se používá při výpočtu identity; nelze tvrdit, že se vůbec nezpracovává. [Vyjádření Umami](https://umami.is/pricing), [definice identity](https://docs.umami.is/docs/metric-definitions).

ÚOOÚ vyžaduje předchozí souhlas pro netechnické cookies a informační povinnost zůstává i u technických. EDPB řeší technický dosah ePrivacy i mimo samotné cookies. Proto bez ověření finální konfigurace nevydávám právní závěr „souhlas určitě není potřeba“. Pokud vyhodnocení zvolené konfigurace souhlas vyžádá, tracker a fronta smějí začít až po něm a musí respektovat odvolání. Samotné `data-do-not-track` není souhlasový mechanismus. [ÚOOÚ](https://uoou.gov.cz/verejnost/qa-otazky-a-odpovedi/cookies), [EDPB – finální pokyny](https://www.edpb.europa.eu/documents/guideline/guidelines-22023-on-technical-scope-of-art-53-of-eprivacy-directive_en).

Pro Cloud ověřit konkrétní region, DPA a subprocesory; údaj „EU region“ nenahrazuje kontrolu přenosů. Aktualizovat všechny jazyky privacy: skutečný poskytovatel, účel, rozsah dat, právní základ, retence a možnosti omezení měření. [Umami smluvní podmínky a DPA](https://umami.is/terms).

## 8. Ověření před zapnutím

Kontrolovat skutečné requesty i přijatá data v testovací Umami website. Desktop a mobil včetně sheetů, back/forward a ovládání klávesnicí. Následující scénáře jsou plán testů, nikoliv tvrzení, že už prošly:

| Scénář | Očekávaný důkaz |
| --- | --- |
| Přímý vstup do každé sekce, pak navigace mapa→seznam→kalendář→plán | Jeden pageview a jeden správný `section_view` na dokončený přechod. `calendar` redirect se počítá jako plán; vnořené osobní stránky nikoli všechny jako plán. |
| Změna filtrů, kamera, otevření panelu, React remount, prefetch | Žádný nový pageview ani `section_view` při pouhé změně query/renderu. Panel má právě jedno skutečné zobrazení detailu. |
| Rychle napsaný známý závod, debounce a ihned Enter | Jedna dokončená hledací operace pro poslední nezměněný dotaz, správný finální počet a žádný raw text v payloadu. |
| Text nejdřív nenajde závod, ale najde místo | `search_completed` až po následném načtení závodů. Žádná předčasná nulová konverze. Automatický let nevytvoří další hledání. |
| Nenalezený dotaz, prázdná mapa a prázdný datumový filtr | Odlišit `no_match` a `geo_scope`; `result_count=0` jen při úspěšné finální odpovědi, nikdy při skeletonu. |
| Síťová/HTTP chyba, chyba geokódování a překonaný request | Chyba odlišena od nuly; abort a překonaný request neemitují finální výsledek. Data z původního dotazu se nepřiřadí novému. |
| Výsledky s přesahy mapy, radiem, stránkováním a ponechaným detailem | Počet odpovídá skutečné výsledkové sadě, ne padded cache ani počtu DOM řádků. |
| Změna závodu A→B, zavření a otevření, mobilní roztažení sheetu | Dvě odlišná zobrazení A/B; žádný duplikát ze skrytého druhého layoutu či roztažení. |
| Hlavní CTA pro registraci vs. pouze web; sekundární odkazy a navigace | Přesně jedna odpovídající outbound událost na aktivaci. Web/listing není registrace. Selhání trackeru nebrzdí otevření odkazu. |
| Uložení přihlášený, nepřihlášený→login→uložení, zrušení, chyba | Nová potvrzená položka má jeden success se stejnou operací. Zrušení loginu nemá success. Obnova plánu ani již uložená položka success nepřidávají. |
| Citlivé query/token/referrer, osobní sekce a admin/auth cesty | V testovací analytice není text, souřadnice, e-mail, jméno, token ani tajný parametr; zakázané cesty nic neposílají. |
| Lokální vývoj, preview, blokátor, pomalý script, případné odmítnutí souhlasu | Nula produkčních analytických requestů mimo povolený produkční kontext; žádná chyba nebo blokace produktu. |
| Test funnelu se dvěma různými závody a dvěma testovacími návštěvníky | Jasně prokázat hranici native funnelu oproti korelaci stejného závodu. Nikdy výsledek nepopsat silněji, než co report skutečně počítá. |

Budoucí automatizované ověření cílit na sanitizaci, prostředí, deduplikaci, pořadí hledacích odpovědí a potvrzené uložení. Potom typecheck/lint příslušných změn a běžné kontroly projektu. V této plánovací fázi testy aplikace nebyly spuštěny a neměnil se její kód.

## 9. Zavedení, závislosti a hotový výsledek

**První fáze:** dohledat zdroj nasazené integrace, ověřit existující Umami website, verzi a přijímané události; potvrdit datový kontrakt a soukromí; využít existující loader/hook a doplnit pouze chybějící helper, korektní pageviews a sekce; doplnit readiness mapového hledání; zapojit deset P0 událostí; porovnat a sjednotit skutečně nasazené eventy; vytvořit přehledy a projít QA na testovací website. Až potom zapnout produkční konfiguraci, doložit přijaté requesty z reprezentativních veřejných cest a označit datum začátku srovnatelných dat.

**Druhá fáze:** až podle první datové mezery: navigation click attribution, sdílení, dosažení bloků detailu a případný malý API report pro stejné závody/operace a kombinované výsledky. Upozornění, rodinné plánování nebo další akce nerozšiřovat do desítek událostí bez konkrétní otázky.

**Co vyžaduje přístup:** přesná verze a konfigurace existující instance, dashboard website se známým veřejným ID, oprávnění na reporty, region, tarif/kvóty, retence, DPA a případný čtecí API token. Veřejné website ID pro integraci je jiný údaj než soukromý API token.

**Co vyžaduje rozhodnutí provozovatele:** případné výdaje, pouze pokud budou potřeba; finální retenční a právní nastavení; případná identifikace přihlášených uživatelů ve vzdálenější fázi. Výchozí doporučení tohoto plánu je anonymní měření bez `identify`, rozšíření existujícího Umami a zachování oddělených Speed Insights.

**Hotovo znamená:** existuje ověřený přehled sekcí, správné finální nuly hledání, rozlišené registrace/web/uložení, reprodukovatelné reporty s definovanými jmenovateli a čisté oddělení testovacího provozu. Samotné vložení scriptu není dokončení.

Aktuálně je dokončen audit lokálního zdrojového kódu, ověření existence a konfigurace produkčního Umami a tento opravený návrh. Původní nález o chybějící integraci byl nesprávný pro živý web. Žádná integrace, založení účtu, změna proměnných, analytického dashboardu ani produkčního webu neproběhla.
