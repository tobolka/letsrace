# Co zbývá udělat v pipeline (stav 20. 11. 2026)

Čísla jsou z místní kopie katalogu na Macu, pokud není uvedeno jinak. Sloupec **Kdo** říká, kdo rozhoduje nebo co musí být hotové dřív.

## Hotové v této relaci (nic z toho není commitnuté ani nasazené)

| Co | Kde |
| --- | --- |
| Změna data a zrušení s důkazem jsou rozlišené podle rizika (zatím bez odesílání) | `scripts/local-sync.cjs` (`separateForReview`, `provenChange`) |
| Čtečky ukládají citaci data (okno textu kolem názvu s celým datem, i rozsah „12.–13. 6. 2027“) | `src/lib/watcher/date-evidence.ts`, verze čtečky `pipeline-v9` |
| Zahazování nových závodů, které jsou jen po termínu nebo jen „jízda“ | `scripts/local-review-new.ts` → `dropped-races.ndjson` |
| Místní stránka pro rozhodnutí o zadržených (Zahodit / Pustit) | `scripts/held-decisions.cjs`, port 54341 |
| Náhled změn data a zrušení, které by šlo odeslat | `scripts/date-proposals.cjs`, v cyklu každých 6 h |
| Stáří backlogu, pokrytí ročníků a nabídka kalendářů v `pipeline:status` | `scripts/pipeline-status.ts`, `scripts/held-backlog.cjs` |
| Týdenní měření „co kalendáře nabízejí a katalog nemá“ | `scripts/audit-source-yield.ts --rotate` |
| Pevná sada dvojic pro duplicity | `src/lib/__tests__/dedup-golden.test.ts` |
| Brave vypnutý (zapnutí `LETSRACE_BRAVE=1`), měsíční limit AI 10 USD | `scripts/local-cycle.cjs`, `budget-ledger.ts` |
| Útrata AI se zapisuje po krocích (`LETSRACE_STEP`) a status ji ukazuje | `src/lib/llm/budget-ledger.ts` |

## Zbývá

| # | Úkol | Proč (důkaz) | Kdo / závislost | Velikost |
| --- | --- | --- | --- | --- |
| 1 | Commit a nasazení změn z relace, obnovení kopie správce Macu (`install-local-runner.cjs`) | Bez toho se nové kroky v cyklu nespustí | ty (commit), pak Mac | malá |
| 2 | Počkat pár dní a změřit, kolik změn data dostalo citaci | Dnes 1 z 69 má citaci (`date-proposals`), `pipeline-v9` se šíří postupně | čas | žádná |
| 3 | Odesílání změn data a zrušení přes bránu (`pipeline_apply_proposal` pro `start_date`, `end_date`, stav `cancelled`) | Změny existujících závodů se dnes na server neposílají (`--only-new-races`) | ty: souhlas s migrací produkční databáze; závisí na č. 2 | střední |
| 4 | Vyzkoušet a otestovat `held-decisions.cjs` naživo | Je jen syntakticky ověřená, rozhodnutí nemá vlastní test | já | malá |
| 5 | Pořadí důvěryhodnosti zdrojů dotáhnout u pole **místo, název, harmonogram** | V kódu je jen u věku, odkazu na web a data s citací | já, pak ověřit dopady | velká |
| 6 | Rozhodnout 28 skupin se stejným webem a dnem (jedna akce s tratěmi, nebo samostatné závody) a „50 km × 100 km“, „hlavní × dětský“ | Katalog má 28 takových skupin jako samostatné závody, scorer by je sloučil | ty, po dvojicích, ne plošně | produktové rozhodnutí |
| 7 | Sjednotit zapisovače slučování | Slučování volá 9 souborů; 435 ze 456 sloučení nemá záznam pro vrácení | já | velká |
| 8 | První běh `audit-source-yield` a propojení mezer s existujícím discovery (`discover-races.ts --sources`) | Měření poroste od prvního týdenního běhu | čas, pak já | střední |
| 9 | Referenční kalendáře pro SK, DE, AT, PL (CZ má 51 řádků v `docs/fixtures`) | Chybí ověření, kolik závodů nenacházíme | já nebo ty (výběr zdrojů) | střední |
| 10 | Hledání nových webů bez Brave: čtečka odkazů z kalendářů, sérií a portálů | Brave: 977 dotazů dalo 64 odkazů, vypnutý | já | střední |
| 11 | Itálie: nepsat adaptér na portál přihlášek. Zobrazit okno přihlášek a kontakt na pořadatele z detailu FCI | Přihláška je u 51 z 215 (24 %). Přes `endu.net` jen asi 10, ostatní roztříštěně. Detail FCI má „Iscrizioni“ jen jako data a e-mail a telefon pořadatele | ty (produkt), pak já | malá až střední |
| 12 | Itálie: web pořadatele chybí u 130 z 215 (80 bez webu, 50 jen `rideandrest.net`) | Bez webu není propozice ani přihláška | závisí na č. 10 | střední |
| 13 | Denní strop AI odvozovat ze zbytku měsíce | Strop 0,50 USD × 30 > měsíční limit, AI stála od 15. 11. | já, po týdnu měření útraty po krocích | malá |
| 14 | Anthropic Console: nastavit tvrdý měsíční limit o něco vyšší než projektový | Projektový limit je jen vlastní pojistka | ty | malá |
| 15 | rad-net (Německo): ručně uložená stránka jako vstup, nebo se zeptat BDR na export | Rad-net je od 11. 11. za kontrolou robotem Anubis, kterou obejít nesmím | ty | odloženo |
| 16 | Odstranit nebo skrýt nárok pořadatele (`organizer_claims`, `organizer_edits`) | Použito 0×, nikdo ho nenaplní | ty, vrátíme se k tomu | odloženo |
| 17 | Zjistit, zda server drží stejná čísla jako místní kopie | Všechna měření jsou z místní kopie | já | malá |
| 18 | Ověřit `revalidateTag` v `organizer-publish.ts` na Cloudflare | Hosting nemá tag purge (`docs/hosting.md`) | já | malá |
| 19 | Opravit staré dokumenty (interval správce 12 h → 1 h, AI dny úterý a pátek) | Dokumentace se rozchází s kódem | já | malá |
| 20 | Neověřeno: používá Chrome nějaký krok GitHub Actions; přesná hranice předpověď × klima u počasí | Nečteno v kódu | já | malá |

## Vědomě nedělat

- **Přesun čtení do cloudu:** Mac běží přes 90 průchodů denně, sběrače nemají dostávat produkční klíče.
- **E-maily pořadatelům:** tvé dřívější rozhodnutí neoslovovat pořadatele.
- **Obcházení kontroly robotem** (rad-net): zakázáno v `AGENTS.md`.
