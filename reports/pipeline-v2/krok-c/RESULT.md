# Krok C: jeden průchod celou cestou (běží ostře od 11. 11.)

11. 11. 2026. Zadání: [docs/pipeline-v2.md](../../../docs/pipeline-v2.md), krok C. Hotové jsou body 1 až 6. Bod 7 (ostrý rozsah a měření) čeká na spuštění dvou migrací na produkci.

**Na produkci se nic nezměnilo.** Migrace leží v `supabase/unapplied/`. Cyklus na Macu běží beze změny; nový kód do něj není zapojený.

## Co je napsané

| Část | Kde |
| --- | --- |
| Mapa zapisujících cest | [docs/pipeline-write-paths.md](../../../docs/pipeline-write-paths.md) |
| Tabulka návrhů, odevzdání, brána | `supabase/unapplied/20261111160000_pipeline_proposals.sql` |
| Úloha na web, výběr závodů, dokončení úlohy spolu s návrhy | `supabase/unapplied/20261111170000_find_documents_tasks.sql` |
| Důvody, odklady, kontrola výstupu čtečky | `src/lib/pipeline2/queue.ts` |
| Čtečka jedné úlohy, bez klíčů | `scripts/find-documents-task.ts` |
| Výdej práce | `scripts/pipeline2-find-documents.ts`, `src/lib/pipeline2/find-documents-db.ts` |

Jednotka práce je **web, ne závod**: dokumenty webu se vypíšou jednou pro všechny jeho závody.

## Kdo má klíč

- Výdej drží přístup k databázi a nečte žádný cizí web.
- Čtečku spouští s prostředím, které pro ni sestaví: cesta, domovská složka, jazyk a `local-guard.cjs`, který zastaví proces při pokusu o spojení s naším serverem, poštou nebo hostingem. Žádný klíč, žádné načítání `.env.local`.
- Co čtečka vrátí, je jen soubor s daty. Výdej ho celý odmítne, když návrh jmenuje závod, který úloha nedostala, jiné pole než odkaz na propozice, hodnotu nebo zdroj, které nejsou odkaz, nebo chybí citace.
- **Co oddělené není:** čtečka běží pod stejným uživatelem macOS a ve stejné složce jako projekt, takže soubor `.env.local` by přečíst mohla, kdyby to její kód udělal. Oddělené je prostředí a síť, ne souborový systém.

## Testy

- `node scripts/test-pipeline-proposals.mjs` (6 skupin): brána.
- `node scripts/test-find-documents-tasks.mjs` (7 skupin), se skutečnou migrací fronty:
  - dva pracovníci chtějí tutéž úlohu, druhý nedostane nic;
  - pracovník zmizí, pronájem vyprší, převezme ji jiný;
  - starý pracovník se vrátí po vypršení pronájmu a nezanechá nic;
  - pád mezi odevzdáním a rozhodnutím nic neztratí a opakované rozhodnutí zapíše jednou;
  - vstup se změní během práce, výsledek se zahodí a úloha se vezme znovu;
  - jeden vadný návrh odmítne celé odevzdání.
- `pipeline2-queue.test.ts`: odklady a kontrola výstupu čtečky.
- `npm test`: 255 souborů, 1 855 testů, vše prošlo.

Souběh je v testu simulovaný po sobě na jednom spojení. Skutečně současné převzetí dvěma spojeními test nezkouší; opírá se o `for update skip locked` ve stávající funkci fronty.

## Stín

Na pracovní kopii katalogu z Macu (9 863 závodů) v jeho vlastní databázi, s oběma migracemi. Čtečka četla skutečné weby. Kopie je po běhu smazaná.

**1. Najde verze 2 totéž co verze 1?** Verze 1 našla odkaz touto cestou u 9 budoucích závodů na 7 webech. V kopii jsem je vymazal a nechal projít celou cestou.

| | Výsledek |
| --- | --- |
| Nalezeno znovu | 9 z 9, stejná adresa jako u verze 1 |
| Zapsáno s historií (`site_documents`, verze 2) | 9 |
| Žádost o obnovu webu pro novou revizi | 9 z 9 |
| Doba na web | 2,5 až 78 s, celkem 2 min 35 s na 7 webů |

Podrobnosti: `shadow-v1-finds.json`.

**2. Česko a Slovensko, 90 dní.** 14 závodů bez propozic má vlastní web, na 5 webech. Žádný dokument nenalezen, 9 sekund.

**3. Všechny země, 90 dní.** 106 závodů na 46 webech. 40 úloh (6 webů bylo přečtených v předchozích bězích a správně se nezařadily znovu): 39× žádný dokument, 1× web neodpověděl a úloha se odložila o hodinu. Medián 2,4 s na web, nejdelší 30 s, celkem 3 minuty. Podrobnosti: `shadow-all-90.json`.

## Co stín říká

- Cesta funguje od úlohy po žádost o obnovu a dává stejné výsledky jako verze 1.
- **Rozsah „Česko a Slovensko, 90 dní“ je na ostré měření malý:** 5 webů a nula nálezů. Přínos brány by na něm nebyl vidět. Ostrý běh navrhuji pro všechny země.
- Úzké hrdlo není tahle cesta, ale to, že závody nemají známý vlastní web: z 961 závodů bez propozic jich ve výběru 90 dní zbylo 106 s použitelným webem. To odpovídá [systému doplňování](../../../docs/race-completion-system.md).
- Stín neměří správnost odkazů (závod a ročník). Čtečka používá stejná pravidla jako verze 1, takže dědí i její chyby. To je práce pro ruční vzorek.

## Ostrý běh, 11. 11. večer

Obě migrace jsou na produkci (`supabase/migrations/20261111153755_pipeline_proposals.sql`, `20261111153805_find_documents_tasks.sql`). Práva ověřena: nepřihlášený ani přihlášený návštěvník návrhy nečte a bránu nevolá.

Hledání propozic na webech závodů je krokem cyklu `findDocuments` místo `siteDocuments` (návrat: `LOCAL_SITE_DOCUMENTS=1`). První průchod z nainstalované cesty:

| | |
| --- | --- |
| Závodů bez propozic s webem | 895 |
| Úloh (webů) v průchodu | 70 |
| Bez dokumentu | 67 |
| Selhání, odložená | 2 |
| Nový odkaz přijatý branou | 1 |
| Doba | 5 min 36 s celý průchod |

Přijaté odkazy se doplňují do kopie katalogu na Macu, aby je čtečka propozic viděla.

## Zbývá

1. Ruční vzorek 30 závodů na správnost odkazů.
2. Převést zbylých pět cest k odkazu na propozice (kalendáře, rad-net, pzkol, federciclismo, hledání) na návrhy.
3. Další pole přes bránu.
