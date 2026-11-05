# Předání pro druhou AI: kontrola a opravy sběru · 5. listopadu 2026

Claude Code zkontroloval dnešní práci (`c83578b4`, `1ba374af`, `5b6a8eba` a neuložené změny čtečky propozic) a na žádost vlastníka opravil čtyři chyby v běhu sběru.

## Stav

- **Nic z toho není v commitu.** Změny leží v pracovní kopii spolu s tvými. HEAD je stále `5b6a8eba`.
- **Nic z toho není nasazené ani nainstalované na Macu.** Sběr je dál v pauze. Vlastník zatím commit neschválil.
- **Tvých souborů jsem se nedotkl:** `practical-enrichment.ts`, `practical-extraction.ts`, `practical-details.ts`, jejich testy ani `docs/operations-progress.md`.
- **Při commitu přidávej jen své soubory.** Moje změny neber jako součást své práce a nevracej je.

Moje soubory:

- `scripts/refresh-data.sh`
- `scripts/judge-duplicates.ts`
- `scripts/check-next-editions.ts`
- `src/lib/catalog/edition-season.ts` (nový)
- `src/lib/__tests__/edition-season.test.ts` (nový)
- `src/lib/__tests__/refresh-daily-steps.test.ts`
- `docs/keep-fresh.md`

## Co bylo špatně a co se změnilo

### 1. Kontrola duplicit pomocí AI

**Problém (`1ba374af`):** rychlá kontrola (`--newer-than-hours=12`) se změnila na `daily_step`. Značka se skládá z názvu skriptu a režimu, takže rychlá i celá kontrola sdílely `judge-duplicates-apply`. Rychlá běžela první a celá se pak přeskočila. Ve `free` režimu je denní rozpočet nula, takže krok nic neposoudil, skončil kódem 0 a den se označil jako hotový.

**Oprava:**

- Rychlá kontrola po 12 hodinách je z cyklu odstraněná. Přepínač `--newer-than-hours` ve skriptu zůstal.
- Celá kontrola (`--max=150 --apply`) běží jako první z úloh v bloku `LLM_DAILY`.
- Limit kroku je 0,20 USD místo 0,50 USD. Dřív běžela až po úlohách, které mohly vyčerpat denní limit 0,50 USD.
- `judge-duplicates.ts` vrací kód 2, když dojde rozpočet (`r.stopped`), takže se den neoznačí jako hotový.

### 2. Slučování jistých duplicit

**Problém (`1ba374af`):** `merge-duplicates.ts` se změnil na `daily_step`, čímž se bez vysvětlení vrátil záměr `c4260fda`. Vlastník chce duplicity řešit během hodin.

**Oprava:** je to znovu `step`, tedy každý cyklus. Běží první v údržbě, až po zveřejňování.

### 3. Výchozí sezóna hledání ročníků

**Problém (`c83578b4`):** `new Date().getFullYear()` by od 1. 1. 2027 začalo hledat ročníky 2028 a hledání ročníků 2027 by skončilo.

**Oprava:** nová funkce `defaultEditionSeason()`. Před říjnem vrací loňský rok, od října letošní, vždy podle pražského času. Hranice října je můj odhad, ne rozhodnutí vlastníka. `--season` funguje dál.

### 4. Časové limity

**Problém (`1ba374af`):** každý krok bez vlastního limitu měl strop 180 s a celý běh 900 s, nejvýš 3 600 s. AI kroky přitom podle logů běžely 517–4 433 s (každý měřený jen jednou) a mimo AI dny se neopakují. `--deep --hours=N` se ukončil po 180 s.

**Oprava:**

| Druh běhu | Celý běh | Výchozí limit kroku |
| --- | --- | --- |
| `free` | 900 s | 300 s |
| `ai` | 7 200 s | 7 200 s |
| hluboký sběr | výchozí hodnota režimu + `SOURCE_DEEP_HOURS` | beze změny; samotný hluboký krok má zbývající čas běhu |

Tvoje výslovné limity hlavního průchodu (`PIPELINE_STEP_SECONDS=...`) jsou beze změny. `PIPELINE_CYCLE_SECONDS` má nově strop 86 400. Limit 300 s je odhad z mediánů v logech a skutečným během ověřený není.

### Dokumentace

V `docs/keep-fresh.md` jsem opravil odstavec o duplicitách a limity AI u ročníků. `docs/operations-progress.md` jsem neměnil, protože v něm máš rozpracované změny.

## Ověření

- `bash -n`: prošlo.
- Kompletní testy včetně tvých neuložených změn: 238 souborů, 1 592 testů prošlo.
- Kontrola typů a `scripts/test-local-runner.cjs`: prošly.
- ESLint na změněných TypeScript souborech: bez nálezů.
- Nové testy spouštějí `refresh-data.sh` s falešným `node`. Ověřují pořadí kroků a limity, ne skutečnou práci.
- **Neověřeno:** skutečný běh, produkční build a chování `merge-duplicates` při ukončení v polovině.

## Co po tobě zbývá

### Rozpracovaná čtečka propozic (před dokončením)

1. **Neúplný program vypadá jako úplný.** V `wider-ready-dry.log` u Grand Prix Sereď zmizel start Masters v 9:15, protože AI vrátila štítek „Program Masters A, B, C + ženy Masters“, a chybí i Žiačky v 10:02. „Tréning na trati“ a „Nábor“ se přitom dostaly do rozpisu. Vyřazený řádek by neměl tiše vytvořit zdánlivě úplný rozpis.
2. **`decodeURIComponent` v `practicalChildLinks` může vyhodit výjimku** na odkazu se špatným procentním kódováním. Výjimku zachytí blok kolem celého závodu, takže jeden vadný odkaz by shodil čtení celého závodu.

### Další nálezy

3. **Nedostupný web hlásí chybu kroku.** `enrich-practical-details.ts` končí kódem 1 při `result.failed > 0`. Pilot proto skončil `failed steps: 1`, zatímco přehled píše „první běh doběhl“. Běžný běh tak bude často vypadat jako chyba. Rozliš nedostupný zdroj od selhání kroku a oprav přehled.
4. **Výpadky pokračují.** Za 24 hodin je aspoň 244 vypršení limitu (`public_edition_candidates`, `public_series_round_rows`), poslední v 9:49 na `dpl_H89qskyitcffBvbFghnQvPujPYL9`. Výpis je omezený na 50 skupin. Dopad na návštěvníky jsem nezjišťoval. Patří k P0.4f.
5. **CPU Vercelu je 9 h 28 min proti limitu 4 h.** Hypotéza k ověření, nezměřeno: časté nasazování (58 commitů 2. 11., 27 commitů 4. 11.) může zvyšovat počet překreslení stránek po každém vydání.
6. **Fronta `public_refresh` má 254 čekajících úloh**, nejstarší od 2. 11.

### Před zapnutím pravidelných běhů

7. Po commitu aktualizovat kopii na Macu a ověřit otisky souborů.
8. Na malém běhu zkontrolovat limity z bodu 4. Pokud některý krok pravidelně narazí na 300 s, bude se opakovat každý cyklus a nikdy se neoznačí jako hotový.
9. Doplnit do `docs/operations-progress.md` tyto opravy a otevřené body.

## Rozhodnutí vlastníka, která čekají

- **Commit a odeslání oprav:** zatím neschváleno. Bez souhlasu necommituj moje soubory.
- **AI kontrola duplicit mimo úterý a pátek:** zatím vypnutá, protože by znamenala útratu navíc. Dokud nerozhodne, AI posuzuje sporné dvojice jen v AI dny a jen do vyčerpání limitu. Jisté shody se slučují každý cyklus.
