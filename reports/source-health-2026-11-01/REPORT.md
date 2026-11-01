# Zdravotní kontrola zdrojů · 2026-11-01

Panel LetsRace Monitor ukazoval 401 zdrojů s problémem, 1320 změn za 24 h a oranžové karty.

## Co se ukázalo
- **1320 změn** byly dvě jednorázové dávky (722 z velkého průchodu v 08:55, 208 z ČSC po úpravě extrakce), ne trvalé přepisování.
- **401 zdrojů**: ~300 bylo bez jediného závodu (archivy, výsledky, propozice, PDF, přihlášení, nefunkční weby); ~50 stránek závodů zdarma nepřečteme (čekají na AI čtečku); ~25 sbíralo `identity_review_required` u závodů, které už v katalogu jsou.
- **ČSC `csc-1695`**: portál uvádí konec závodu o rok před začátkem. Zdroj byl kvůli tomu pořád „čeká na ověření" a zápis start/konec se mezi běhy převracel.

## Co se opravilo
| Oblast | Změna |
|---|---|
| Čtečka ČSC | Konec před začátkem se ignoruje (`extractors/csc.ts`, test v `csc.test.ts`). |
| Závod SEVEROČESKÝ PUMPTRACKOVÝ POHÁR (Sobotka) | Datum 26. 4. 2026 (jednodenní), zveřejněn; fakt zapsán s odůvodněním. |
| Fronta k ověření | 35 duplicit odmítnuto s odkazem na existující závod (`decisions*.json`); 2 vyřešené ČSC podklady odmítnuty. Zbývá 22 záměrně čekajících (viz níže). |
| Zápis | Už odmítnutý podklad nezpůsobí, že je celý zdroj při každém dotazu „s chybou" (`discovery/review.ts`, `watcher/run.ts`, test). |
| Zdroje | 163 stránek bez závodů pozastaveno (`retire.json`, poznámka ve zdroji; vrátit lze `status='active'`). |
| Panel | Rozděleno „s chybou" × „nepřečteno zdarma, čeká na AI"; karta Mac už není oranžová jen kvůli neúspěšným čtením za 24 h. |

## Co zůstává (záměrně)
- 22 podkladů čeká na pořadatele: 12 slovenských 2027 z bikepoint.sk (agregátor, ne oficiální zdroj), 6 s neoznámeným termínem 2027, Hintersee, Bohemian Border Bash, Jesenický Ultrasurovec.
- Zdroje bez závodů, které zdarma nepřečteme (homepage pořadatelů): čekají na AI kontrolu (limit 0,50 USD/den, dosud 0 USD).
