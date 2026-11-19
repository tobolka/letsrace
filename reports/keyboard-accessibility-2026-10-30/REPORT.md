# Ovládání klávesnicí — 30. 10. 2026

Změny jsou v místní aplikaci; produkční nasazení nebylo součástí této kontroly.

## Opravené příčiny

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `src/components/ui/drawer.tsx:10`, `src/components/explore/mobile-sheets.tsx:197` | Trvale otevřený mobilní seznam používal modální kontext a zadržoval Tab. Otevírané panely nepřebíraly fokus. | Skutečně nemodální kontext pro mapové panely, průchod přes jejich oba okraje, automatický fokus ostatních panelů a návrat po zavření. | Klávesnice musí dosáhnout mapy, navigace i obsahu otevřeného panelu. |
| HIGH | `src/app/globals.css:145`, `src/components/seo/site-index.tsx:31`, skryté náhledy mapy/seznamu/kalendáře | Odkazy se dostaly do pořadí Tab, ale zůstaly vizuálně skryté. | Skupina se při vstupu fokusu zobrazí jako čitelný posuvný panel; Escape vrátí fokus do hlavního obsahu. | Fokus nesmí zmizet z dohledu. |
| MEDIUM | `src/components/explore/event-rows.tsx:76`, `src/components/shell/race-table.tsx:167`, `src/components/shell/keyboard-navigation.tsx:16` | Závody vyžadovaly opakovaný Tab a Enter, šipky je nepřepínaly. | Nahoru/dolů a Home/End procházejí viditelné pořadí a v mapě/seznamu otevírají příslušný detail. Tab z vybraného řádku vstoupí do detailu, Shift+Tab se vrátí. | Předvídatelný pohyb v seznamu bez ovlivnění psaní, filtrů nebo pohybu mapy. |
| MEDIUM | `src/components/shell/race-table.tsx:242` | Interaktivní tabulkový řádek s neplatným stavem výběru v běžné tabulce. | Nativní tlačítko pro závod, při skrytém sloupci názvu je ve prvním viditelném sloupci. | Nativní Enter/mezerník a srozumitelná role ovládacího prvku. |
| MEDIUM | `src/components/calendar/month-calendar.tsx:153` | Chyběl pohyb šipkami; tlačítka dne měla roli buňky bez odpovídající mřížky. | Vlevo/vpravo o den, nahoru/dolů o týden, Home/End v týdnu; nativní tlačítka se skutečným datem; pojmenovaná denní okna. | Kalendář má předvídatelné klávesy a zachovává sémantiku tlačítek. |
| MEDIUM | `src/components/explore/event-detail-panel.tsx:91`, `src/components/ui/dialog.tsx:70`, `src/components/ui/drawer.tsx:163`, `src/components/calendar/month-calendar.tsx:368` | Po zavření nebo výměně obsahu mohl fokus skončit na těle stránky; plovoucímu detailu chyběl Escape. | Escape pro plovoucí kartu, fokus nově otevřeného kalendářového detailu a návrat na závod, datum či otevírací tlačítko. | Uživatel neztratí místo po práci s oknem. |
| MEDIUM | `src/app/globals.css:119`, `src/app/[locale]/(shell)/layout.tsx:33` a vnořené dokumentové stránky | Nestejně viditelný fokus, více vnořených hlavních oblastí a chybějící společný přeskok na obsah. | Dvoubarevné ohraničení, přeskok na obsah, jediný hlavní obsah a fokus po změně podstránky. | Viditelnost fokusu a orientace napříč veřejným webem i účtem. |

## Ověřeno

- Ručně v prohlížeči: mapa a tabulka — šipka přepne otevřený závod, fokus zůstává na závodu; Tab vstoupí do detailu; Escape po případném zavření tooltipu zavře kartu a vrátí fokus.
- Kalendář na desktopu i při šířce 390 px — pohyb o den/týden, Home/End, Enter otevře den, šipky v denním seznamu, otevření detailu a jeho fokus.
- Dialog nahlášení závodu — otevření Enterem, fokus uvnitř, zavření Escape a návrat na tlačítko v navigaci; formulář nebyl odeslán.
- Mobilní mapový panel — mapa a spodní navigace zůstávají v přístupnostním stromu; Tab i Shift+Tab opustí panel; otevření a zavření závodu obnoví fokus na jeho řádku.
- Mobilní okno závodu — fokus vstoupí na jeho ovládání, Tab pokračuje uvnitř.
- Skrytý index — při fokusu se zobrazí a Escape vrátí hlavní obsah.
- Procházení závodů — nativní odkazy a jediná hlavní oblast po přechodu z navigace.
- Ohraničení `#2563eb`: kontrast 5,17:1 vůči bílé, 3,38:1 vůči stone-900, 4,75:1 vůči blue-50 a 4,24:1 vůči blue-100. Vnitřní světlý pruh má vůči červenému dnešku 5,74:1. Režim vynucených barev používá systémové Highlight.
- Kontrola typů samotné aplikace a kontrola stylu celého `src` prošly.
- 22 existujících testů ve 4 souvisejících sadách prošlo (měsíční kalendář, viditelné závody, stránkování a stavy seznamu).
- `git diff --check` prošel.

## Neověřeno / omezení

- **Not verified:** skutečný průchod s VoiceOver/NVDA, Windows High Contrast a všechny kombinace prohlížeče a operačního systému. Přístupnostní strom byl kontrolován v prohlížeči, plná shoda s WCAG se tím nepotvrzuje.
- **Not verified:** přihlášené rodinné účty a jejich konkrétní data; kontrola těchto obrazovek proběhla ve zdrojích, sdílený kalendář, prvky a dialogy byly ověřeny veřejnými cestami.
- **Not verified:** přesouvání plovoucí karty a dotyková gesta. Tato změna nemění systém přetahování.
- Běžné `npm run typecheck` blokuje dřívější neúplná kopie `reports/search-console-2026-10-29/release-source/.../e/[slug]/page.tsx`, které chybí `race-skeleton`. Samotné `src` bylo zkontrolováno se stejným nastavením TypeScriptu a vyloučením reportů.
- Horní/dolní okraj seznamu ani hranice zobrazeného kalendáře automaticky nepřecházejí na jinou stránku či měsíc; příslušná tlačítka zůstávají dostupná Tabem.

Východisko: [W3C APG — Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/).

**Approve — pouze pro výše popsané a ověřené klávesnicové cesty; nejde o certifikaci celého webu ani neověřených obrazovek.**
