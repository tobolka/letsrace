# Kontrola nových změn z 2. listopadu 2026

Rozsah: 26 commitů `bc8a710e..f8a2ab30`, 39 souborů; navíc kontrola návaznosti na lokální rozpracovanou administraci. Produkční nasazení `f8a2ab30` je READY. Tento report je kontrola, nikoliv tvrzení, že níže uvedené chyby už jsou opravené. Nově požadované odkazy na další ročníky se implementují samostatně.

## Závěr

Směr detailu odpovídá cíli: konkrétní užitečné údaje, lepší propojení stránek a méně opakovaného značení v seznamech. Nelze ale označit celou sadu za bezchybnou. Některé nové údaje vznikají odhadem z obecných štítků a nový zapisovač admina obchází dřívější bezpečné společné uložení.

## 1. P1 — Úprava závodu může zůstat částečná a bez ochranného zámku

`src/lib/race-edit.ts:85–128`: samostatný zápis závodu, následné zápisy kategorií a teprve potom ochranný zámek. Chyba v zápisu zámku se ignoruje. Chyba kategorie nastane až po uložení změny závodu. Výsledkem je buď úspěšná odpověď bez slíbené ochrany, nebo chybová odpověď nad již změněnými daty. Paralelní zápisy zámků také mohou přepsat jeden druhému přidané položky. Nový admin/proposal tok tak nemá stejné záruky jako existující `organizer_apply_edit`.

Doloženo dvěma izolovanými reprodukcemi [repro.test.ts](repro.test.ts), [výsledek](repro.log): chyba ochranného zápisu vrací `changed: 1`; chyba kategorie přichází po již provedeném zápisu závodu. Reprodukce používají náhradu databáze a nezapisují do produkce. Řešení: jedna databázová transakce se zamknutím řádku, historií, ochrannými zámky a požadavkem na publikaci.

## 2. P1 — Schválení návrhu není jednorázové a může přepsat novější údaje

`src/app/api/admin/proposals/route.ts:18–41`: stav `pending` se jen přečte, potom se provede změna a až nakonec samostatně uloží výsledek. Chyba závěrečného zápisu není kontrolovaná. Dvojklik nebo dva administrátoři mohou schválit stejný nový závod dvakrát; ani následné opakování po chybě nebrání další tvorbě. `applyRaceCreate` volá vložení s novým slugem, nepoužívá klíč návrhu pro jednorázové provedení. Pro úpravy navíc chybí očekávaná verze původního závodu; plný formulář uložený dřív jako návrh přepíše mezitím opravené údaje.

Řešení: atomické převzetí návrhu, ověření verze závodu, jednorázový klíč pro vytvoření a společné uložení výsledku. Formuláře jsou nyní z veřejných detailů záměrně stažené, ale serverové cesty a administrátorská schránka existují dál. V okamžiku kontroly bylo čekajících návrhů nula; netvrdím, že už tato závada poškodila konkrétní návrh.

## 3. P2 — „Elite“ se bez důkazu mění na konkrétní věk i údaj pro vyhledávače

`src/lib/birth-years.ts:20,32–44,53–58` a `src/components/seo/event-json-ld.tsx:78`: označení Elite automaticky znamená 19+, v roce 2027 „2008 a starší“. Totéž dostává vyhledávač jako `typicalAgeRange: 19-`. Na veřejném JBC je toto skutečně vidět, přestože podklad UCI pro ročník 2027 potvrzuje jména kategorií, nikoliv takovou věkovou hranici. Aktuální pravidla UCI pro 4X (verze 1. 1. 2026, článek 4.1.007) naopak připouštějí 17+. Nelze z toho automaticky tvrdit přesné podmínky 2027; rozhodně však nelze ze samotného slova Elite tvrdit 19+.

Primární podklad: https://assets.ctfassets.net/761l7gh5x5an/6qYIYIddcAPjN248n7tVDI/952938d168fc58dff91242d076230446/4-MTB-20260101-E.pdf

Řešení: věkové hranice a ročníky čerpat z doložených kategorií konkrétního závodu; obecná kategorie ani `age_confidence=explicit` samy nedokládají univerzální věkovou hranici. U širokých štítků přesný věk vynechat, případně výslovně oddělit orientační pravidlo od propozic. Stejný problém má tvrzení o nejmladším účastníkovi odvozené pouze z obecných `kids`/`youth`.

## 4. P2 — Devadesátidenní mezera chybně rozděluje jeden ročník seriálu

`src/lib/series-rounds.ts:15–20`: hranice sezóny je jen mezera přes 90 dní. Skutečný Pražský MTB pohár 2027 má v katalogu kola 26.–27. 3. a 25.–26. 9. Se stejnými skutečnými údaji vrací funkce pro závod pojmenovaný „3. kolo“ výsledek `{n:1,of:2}`. Ověřeno proti veřejnému `/api/series/prazsky-mtb-pohar` i databázi. Nejde o hypotetický kalendář.

Řešení: přednost má doložené číslo kola a příslušnost k ročníku; zimní seriály potřebují výslovné pravidlo sezóny. Pokud je kalendář neúplný nebo příslušnost nejistá, netvrdit přesné pořadí ani celkový počet.

## 5. P2 — Limit historie počasí počítá místa, ne skutečná volání a celkový čas

`src/lib/weather.ts:193–229`, `src/lib/weather-history.ts:66–80`, `supabase/migrations/20261102163438_weather_history_capacity.sql:11`: nové čtení načítá každý rok samostatně. Reprodukce `archiveWindows` dává 10 požadavků pro jediné datum, 20 pro dvě oddělená data na stejném místě. Databázový limit 1 000 přitom počítá jen místa. Předpověď a výška přidávají další volání. Není tedy pravda tvrzení v komentáři migrace „one location is one call“.

Každý požadavek má vlastní časový limit, ale celý archivní průchod ho nemá a nepřebírá zbývající čas serverového běhu. Kontrola času probíhá až před dalším místem. Při mnoha termínech nebo pomalých odpovědích tak může rozdělané místo překročit délku běhu; následná záloha přidává svůj čas. V databázi už jsou i chyby `visual_crossing_http_429`; jejich příčinu samotná existence chyby neprokazuje.

Řešení: společný rozpočet skutečných volání pro každého poskytovatele, řízení tempa a předání jednoho celkového časového limitu do obou čteček. Menší rozsah načítaných dnů je dobrá změna, zvýšení počtu míst samo spolehlivost nedokazuje.

## Další konkrétní omezení

- `routeSummary` počítá různé vzdálenosti, ale nazývá je počtem tras. Road Stage má tři pojmenované varianty, ale funkce vytváří „2 trasy 69–138 km“. Ze dvou délek nelze dokázat počet různých tras ani formátů; bezpečnější je zatím uvádět samotný rozsah vzdáleností.
- `useSeriesRound` (`event-detail-body.tsx:206–222`) nedrží výsledek pod ID závodu ani ho při změně závodu nevynuluje. Během nového čtení, a při jeho chybě trvale, může tooltip ukazovat pořadí předchozího otevřeného závodu.
- Výška je odečtená v uloženém mapovém bodě; řada závodů má pouze bod obce. Text „výška startu“ je přesnější tvrzení, než tato data dovolují. Lepší „nadmořská výška místa“ do doby ověření startu.

## Provozní kontrola mimo samotný diff

- 1 393 testů ve 211 souborech prošlo; kontrola typů prošla. Dvě další izolované reprodukce potvrzují popsané chyby zápisu. Zelené testy neposkytují záruku správnosti závodních údajů.
- Ve frontě zveřejnění bylo při kontrole 477 čekajících položek a vyčerpaných 60 denních pokusů. To je omezení současné pipeline, nikoliv důkaz, že všechny nové commity způsobily chybu. Limit jsem během review nezvyšoval ani neobcházel.
- JBC a Road Stage již mají úlohy zveřejnění dokončené a správné veřejné detaily. Běžný společný seznam pro mapu/kalendář ale ještě vracel starou obec Kikirikiii a neobsahoval JBC. Dokončení dříve autorizované opravy proto zahrnovalo jednorázovou obnovu označených dat a CDN. Následný skutečný seznam obsahuje oba závody se správnými místy. Toto není vydáváno za automaticky vyřešené zveřejňování celého katalogu.

V tomto review nebyl nový kód úprav, věků, pořadí kol ani počasí přepsán. Jejich opravy zůstávají konkrétními následujícími kroky; původní změny uživatele byly zachovány.

## Následné zadání

Uživatel následně zadal opravu Elite, kol, limitů počasí, tooltipu a rozsahu vzdáleností a odstranění výšky a časů slunce. Výsledek je vedený v [navazujícím reportu](../review-fixes-2026-11-02/RESULT.md). Body 1–2 tohoto review zůstávají neopravené; veřejný formulář je nyní stažený.
