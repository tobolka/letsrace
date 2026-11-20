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

## A. Teď rozpracované (od nejdůležitějšího)

Důležitost: **Vysoká** = přímo zlepšuje to, co vidí rodiče a jezdci, nebo brání ztrátám. **Střední** = zlepší kvalitu nebo ušetří práci. **Nízká** = úklid nebo pojistka, nespěchá.

| # | Úkol | Proč na tom záleží (lidskou řečí) | Důležitost | Kdo / kdy |
| --- | --- | --- | --- | --- |
| A21 | Dokončit případy agenta (Codex je bez kreditu): zbývá 5 extrakcí podrobností (Świętokrzyska Liga a Porrentruy z PDF, Elmshorn, Nürnberg a Rheinzabern, tři z nich na rad-netu) | 20. 11. jsem zodpověděl 76 případů včetně 7 ověření podrobností a 3 extrakcí. Rad-net číst nesmím | **Nízká** | já, případně nový kredit Codexu |
| A22 | Zbylých 5 skrytých závodů bez zjištěného důvodu a disciplína u Vinařská 50 (místo Kobylí doplněno, závod zůstává skrytý) | 69 skrytých má zapsaný důvod, 5 závodů bylo zveřejněno (Zábřeh, HarzGravel, THE43, Wörthersee Gravel, Imster Radmarathon) | **Nízká** | já |
| A2 | Sledovat, kolik oprav data má citaci a jde na server (`pipeline:status`, řádky „Změny data a zrušení“ a „odeslané na server“) | Odesílač běží od 20. 11. (A3 hotové). Většina zadržených změn je už na serveru (4 z 5 byly „already_set“); 24 dalších nemá citaci, protože pocházejí z rozhraní API (radsport-events, odjazd.pl, endure, rideandrest) a ty stránky nemají text pro citaci | **Střední** | čas |
| A6 | Rozhodnout, kdy jsou „50 km a 100 km“ nebo „hlavní a dětský závod“ jeden závod a kdy dva | Teď se u jedné akce občas objeví dva záznamy a občas jeden. Rodič pak nenajde správnou kategorii. Je to tvoje rozhodnutí | **Vysoká** | ty, po dvojicích |
| A9 | Porovnat katalog s referenčními kalendáři SK, DE, AT, PL | Dnes víme jen, kolik závodů máme, ne kolik jich v zemi je. Bez toho nevíme, kolik nenacházíme | **Střední** | já nebo ty |
| A13 | Denní strop AI odvozovat ze zbytku měsíce | Dnes se limit AI vyčerpá v polovině měsíce a pak se přestanou číst propozice | **Střední** | já, za týden |
| A14 | Nastavit tvrdý měsíční limit v Anthropic Console | Pojistka proti chybě: kdyby se spletl náš vlastní hlídač výdajů, zastaví to služba | **Střední** | ty |
| A15 | rad-net (Německo) | Německé závody z jednoho velkého zdroje se nečtou, protože ho chrání proti robotům. Obejít to nesmíme. Řešením je ruční export nebo dotaz na svaz | **Střední**, odloženo | ty |
| A17 | Ověřit, že server drží stejná čísla jako Mac | Všechna naše měření jsou z kopie na Macu | **Nízká** | já |
| A18 | Ověřit, že se po úpravě pořadatelem obnoví stránka | Cloudflare nemá okamžité obnovení stránek. Dnes to nehraje roli, nárok pořadatele je skrytý | **Nízká** | já |
| A19 | Opravit staré údaje v dokumentech | Staré dokumenty ještě uvádějí interval správce 12 hodin místo 1 hodiny | **Nízká** | já |
| A20 | Ověřit Chrome v GitHub Actions a hranici předpověď × klima u počasí | Dvě drobnosti, které jsem nečetl v kódu | **Nízká** | já |
| A16 | Smazat kód a tabulky nároku pořadatele | Dnes skryté a nepoužívané. Mazat až později | **Nízká**, odloženo | ty |

**Vědomě nedělat:** přesun čtení do cloudu (sběrač nemá dostávat produkční klíče, Mac běží přes 90 průchodů denně), e-maily pořadatelům, obcházení kontroly robotem.

## B. Zapomenuté nápady ze smazaných dokumentů

**Co z toho je důležité** (zbytek jsou menší nápady, dělat až podle potřeby):

| Důležitost | Nápad | Proč |
| --- | --- | --- |
| **Střední** | Zdroje pro ručně přidané seriály (`prahamtb.cz` se nečte) | Přidat web jako sledovaný zdroj je neškodné (když na něm kalendář ještě není, nic se nezmění). Řada organizátorů ale dává termíny jen na Facebook, který číst nesmíme: takové závody se dostanou dovnitř jen přes kalendáře svazů a pohárů, nebo ručně z plakátu |
| **Vysoká** | Supabase Security Advisor: ochrana proti uniklým heslům, PostGIS ve veřejném schématu | Bezpečnost přihlašování. Je to nastavení v Supabase, aktuální stav jsem neověřil |
| **Střední** | Detail závodu: doplnit údaje (zobrazení už je hotové: místo, program, startovné, kategorie, tratě, pořadatel, parkování) | Chybí jen údaje, ne zobrazení: startovné je u 309, program u 418 a místo z propozic u 573 závodů. Doplňuje to čtení propozic, které stojí, dokud nedoběhne AI limit |
| **Střední** | Kategorie z jednoho kola seriálu na všechna kola | Rychle doplní chybějící kategorie. Část už dělá denní úklid, ověřit, co chybí |
| **Střední** | Uzávěrky přihlášek z platforem (RaceResult, Sportsoft, dostartu) | „Stihnu se ještě přihlásit?“ je častá otázka |
| **Střední** | Hledání nových závodů po zemi, sezóně a disciplíně | Víc nových závodů, ale bez Brave to chce jiný zdroj dotazů |
| **Střední** | SEO sezónní stránky | Dává smysl až poté, co Google začne web indexovat |
| **Nízká** | Widget „Termíny seriálu“, zmenšení sitemapy, trasa s GPX, potvrzování kategorií návštěvníky | Velká práce nebo nejistý přínos |

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
