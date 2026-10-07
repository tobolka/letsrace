# Local deep refresh

From the LetsRace folder, run:

```sh
bash scripts/keep-fresh.sh --deep --hours=6
```

This extends the existing refresh loop. It imports calendars, enriches the
catalogue using its existing per-race readers, and collects documents from all
sources of every upcoming public race. The deep collection includes all
countries in the catalogue; the regular refresh keeps the existing
`CATALOG_COUNTRIES` priorities (CZ, SK, AT, DE, PL, CH by default).

The Mac stays awake. Progress is printed and saved in `tmp/refresh-*.log`.
The time limit stops new steps and new document requests; an in-progress step
finishes before exit. Stop with Ctrl+C and use the same command to resume.

Results:

- `tmp/source-dossiers/<event-id>.json`: full source snapshots, document text,
  rules and entry URLs, and edition-validated positive category evidence.
- `tmp/source-dossiers/documents/`: shared persistent document cache.
- `tmp/source-dossiers/summary.json`: completed, cached, pending and failed work.
- `tmp/source-dossiers/progress.json`: the most recent completed race.
- `tmp/data-goal-audit-latest.json`: catalogue completeness after the refresh.

Successful downloads and completed race batches are reused for 24 hours.
Failed and unfinished races remain retryable; old race files are kept.
Each source/explicit URL receives its own budget of up to 16 documents. Shared
URLs are read once and requests are paced per host. PDFs and office documents
are read; script-only pages can use the existing local Chrome renderer.
A completed collection batch does not mean the race data is exhaustive.

The collector itself only reads the database and writes local files. The
existing refresh steps still update production data from validated evidence.
The category reader reuses local dossiers, revisits already known classes,
and adds confirmed classes without removing existing confirmed evidence.
Conflicting or incomplete source material remains available for later reading;
deterministic category clues are not treated as a complete admission list.

Existing model ceilings remain $2.50/day and $25/month across all steps. Deep
document collection does not call a model and continues when that budget is
exhausted. `.env.local` needs the same Supabase credentials as keep-fresh;
paid readers additionally require the existing model key.

For a short, read-only check without the production refresh:

```sh
node scripts/with-node.cjs tsx scripts/collect-source-dossiers.ts --country=CZ --max=3 --hours=0.1
```

Collector options: `--ids=id,id`, `--country=CZ,SK`, `--country=all`, `--docs=16`,
`--concurrency=3`, `--out=tmp/source-dossiers`, `--render`, `--again` (rebuild
race dossiers while retaining fresh shared document reads).

Without `--hours`, keep-fresh retains its ongoing loop. A positional number
remains the interval between runs, e.g. `bash scripts/keep-fresh.sh 2 --deep`.
