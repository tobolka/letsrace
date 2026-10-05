# Autonomous catalog completeness

Target: at least 90% of upcoming, public, active, unmerged events in **each** of CZ, SK, AT and DE, measured over the coming year. A complete event has an official/non-aggregator website, both coordinates, a discipline and nonempty source-backed (`explicit`) categories. Propositions are enriched and tracked separately; they are not required for this target. Missing or uncertain categories remain possible matches in age filtering.

The local `keep-fresh.sh` loop runs every six hours. Each refresh reports country targets and remaining gaps to `tmp/data-goal-audit-latest.json`. Model work runs daily, prioritizing the four countries, shared season documents and required fields. Calendar model fallbacks have separate small caps so they cannot consume the entire enrichment budget. Shared model ceilings remain $0.50/day and $5/month; Brave has its own query limit. A larger processing limit (500 series) does not raise those ceilings.

One verified series document can fill all applicable rounds. Discovery follows official series pages, intermediate information pages and PDF/DOCX propositions, with one search per series when needed. Exact series/season quotes and category line numbers must match the downloaded source. The verdict is cached by series, URL and text hash. Cached evidence runs every refresh without a model call, including after the paid budget is exhausted. The automated path does not require human confirmation.

A round's own explicit categories and locked fields are preserved. A partial class list, category exception, ambiguous winter birth-year list, unsupported class mapping or cup standings cannot become a complete eligibility list. Common verified propositions can still be saved without promoting category confidence. Every applied field retains its source, quote and previous value in `event_facts`.

## Verified on 2026-10-05

| Country | Complete | Goal count | Still needed |
| --- | ---: | ---: | ---: |
| CZ | 74/104 (71.2%) | 94 | 20 |
| SK | 7/16 (43.8%) | 15 | 8 |
| AT | 67/107 (62.6%) | 97 | 30 |
| DE | 171/241 (71.0%) | 217 | 46 |

The target has **not** been reached. These figures count known catalog events; they do not establish coverage of every race held in a country. Discovery/imports continue and can change the denominator.

This change's source-backed writes added 10 category lists and 32 propositions across Stevens, Weser-Ems, Krapf and Cycling Austria series. The Austrian cup standings were rejected as eligibility evidence and their three category writes restored; the nine valid proposition links remain. No duplicates were merged by this enrichment run.

On the same 1,080-event population, the four-field completeness count rose from 587 to 596. The baseline was reconstructed from the previous values recorded in active source facts; archived five-field audits separately show 203 to 229 complete including propositions. Those are different definitions and must not be compared directly. The final automatic pass examined 33 target-country series and 58 candidate documents, used one model call ($0.005944), saved nine proposition links and continued cached processing when its process budget stopped paid calls.
