# Německo a Rakousko 2027: ruční průchod a nové zdroje (16. 11. 2026)

Podnět: seznam závodů od jiné AI a pokyn rozšířit hledání mimo hlavní svazové zdroje. Vše ověřeno na stránkách pořadatelů; každá změna je v `apply.ts` s citací a odkazem, výsledek v `applied.json`.

## Nové závody
| Závod | Datum | Proč |
| --- | --- | --- |
| Münsterland Giro – Stadtwerke-Kids-Cup | 3. 10. 2027 | V předběžném programu 2027, s pořadím a poháry; kategorie 5–12 let z roku 2026 (`previous`) |
| St. Anton night:sprint | 30. 7. 2027 | Přihláška otevřená (pentek-payment) |
| Dolomitenradrundfahrt – Kinderradrennen | 12. 6. 2027 | Program 2027: 10:00 Lienzer Hauptplatz; kategorie 2027 nezveřejněny |

## Opravy
- CANYON Rhein-Hunsrück Bike Marathon: název, MTB + XCM + gravel, závod (ne vyjížďka); odstraněn odkaz na loňskou dětskou přihlášku.
- Alpentour Trophy: MTB XCM etapový závod místo silnice; skrytá jednodenní kopie sloučena.
- ARBÖ Kärnten Radmarathon a Imster Radmarathon: silnice / gran fondo místo XCM; přihláška Kärnten (racetime 1472); skrytá kopie vedená pod Českem sloučena.
- ADAC Velotour: jen 1. 5. 2027, přihláška timeto (dříve odkaz na kalendář UCI).
- Arlberg Giro Kriterium: 31. 7. 2027 podle svazu i pořadatele (dříve 19. 6.); skrytá kopie sloučena.
- Rankweil „Rund um den Liebfrauenberg“ (19. 6.) a Kirschblütenrennen Wels (2. 5.): sloučeny zastaralé kopie na starém termínu (`stale-dates.json`).
- Dolomitenradrundfahrt a SuperGiroDolomiti: propozice 2027 a přihláška racetime 1523.
- Grieskirchen: web pořadatele.
- Rohanské stezky (CZ): z propozic 2027 místo, pořadatel, parkování, kategorie s ročníky, harmonogram, startovné, tratě a přihláška.

## Nezaloženo, s důvodem
- Rund um Köln: KSK Schüler Tour je vyjížďka bez měření času, Pänz Tour je odrážedlová jízda, kde „vyhrává každý“. Münsterland Girolino stejně.
- 3RIDES Winterberg: 25.–27. 6. 2027 potvrzeno, ale soutěžní kategorie ani rozdělení závod/vyjížďka zatím nejsou. Přijde novým zdrojem endure, až budou.
- Rhens Kids-Race, Grieskirchen dětské a mládežnické závody, Süwag Nachwuchs-Cup (Eschborn): pro 2027 zatím jen loňský program.
- Arlberg Giro je vyprodaný; aplikace stav „vyprodáno“ neumí, odkaz zůstává na stránce pořadatele, která to říká.

## Systémové změny
- Čtečka rakouského svazu i raceresult četla každý „marathon“ jako MTB. „Radmarathon“ a maraton vedený pod silnicí je teď silnice / gran fondo (testy).
- Nová čtečka `events.endure-cycling.com/events.json` (celý kalendář v jednom souboru, robots povoleno). Jen cyklistika, jen potvrzená data; RTF a německé „Radmarathon“ bez znaku závodu jdou jako vyjížďky k ověření. Zdroj je přidán do sledování **pozastavený**, dokud se neobnoví běhová kopie na Macu.

## Kde je skutečná mezera
2027 proti 2026 (veřejné): DE 338 / 893, AT 213 / 466. Silnice a gravel jsou z velké části pokryté (z 91 potvrzených DE/AT akcí na endure máme 84). Chybí hlavně MTB/XCO a dětské poháry. Loňské německé MTB závody pocházely nejvíc z my.raceresult.com (122, u 89 jediný zdroj) a radsport-events.de (116); rakouské z bikeboard.at (101) a raceresult (63). Raceresult má pro DE+AT 2027 zatím jen 74 cyklistických akcí: pořadatelé ročníky 2027 zakládají v zimě, stávající čtečky je pak převezmou samy.

Další kandidáti na zdroj: racetime.pro (rakouská časomíra, ~20 akcí 2027 na úvodní stránce), radmarathon.at (Austria Top Tour), rumpelwege.com (gravel).
