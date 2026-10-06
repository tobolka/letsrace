# Collect first, combine into a complete race

This policy applies to every source handled by the shared watcher: federations,
series, aggregators, timing platforms and organisers. Each adapter must extract
as much available information as it can, including the race detail, official
website, rules and PDFs, entry links and deadlines, categories, distances,
elevation, results and series memberships. Missing values stay unknown.

The complete adapter result is retained as `event_facts.source_evidence`, with
the originating URL, watch identity and edition. Choosing one website or rules
link for display does not discard the alternatives or the original result.
Changed source results remain in the evidence history.

Identity matching establishes that sources describe the same race edition.
Shared venues, weekends or homepages alone must not combine distinct events,
formats or instalments. Uncertain identity needs resolution before merging.

Merge categories additively: preserve existing rows, add missing categories and
fill empty fields. Keep conflicting route lengths or age bounds separately.
Keep ambiguous partial categories separately rather than assigning their data
to an arbitrary route. Confirmed age classes accumulate across sources; guesses
cannot widen them. Manual category locks remain respected.

Document collection gives every source its own budget and shares reads of
identical URLs. Read event details and their linked rules, entry information and
category documents, including PDFs. Retain background documents but validate
the edition before using their contents as current race facts. A generic
calendar is not an event detail and its unrelated links must not contaminate a
race dossier. Documents that fail or require rendering remain incomplete.

`scripts/collect-source-dossiers.ts` collects all upcoming public races in a
country, or selected IDs, into local JSON dossiers without production writes.
It recovers older MTBS detail/rules URLs by exact adapter external ID.
`scripts/fill-dossier-classes.ts --all-sources` also revisits races that already
have explicit classes, gathers the shared dossier, validates admission evidence
and unions confirmed classes. It defaults to a dry run; `--apply` writes the
changes, retains their provenance and avoids overwriting a changed snapshot.

These changes do not retroactively backfill the production catalogue until
the relevant collectors run. Source-specific extraction remains the adapter's
responsibility; the preservation and additive merge policy is global.
