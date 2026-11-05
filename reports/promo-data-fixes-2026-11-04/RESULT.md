# Opravy údajů před oslovením pořadatelů, 4. 11. 2026

Zapsáno do produkční databáze. Publikace na veřejné stránky čeká na běh `/api/cron/publication` (denně 5:40 UTC); při zápisu fronta nevydala žádnou úlohu (`waiting`) a veřejné stránky ještě ukazovaly staré údaje.

## Peklo Severu Road 2027

Zdroje: [RoadCup 2027](https://www.roadcycling.cz/roadcup/rocnik-2027) uvádí „Peklo Severu Road N°2 RR 50,8 km, 25.04.2027“. [Web pořadatele](https://www.pekloseveruroad.cz/cz/) popisuje No.2 jako okruh 25,4 km v okolí České Kamenice; dvě kola dají 50,8 km. Místo je převzaté z tohoto popisu, samostatné potvrzení pro 2027 chybí. Web pořadatele zatím ukazuje jen ročník 2026.

| Záznam | Před | Po |
|---|---|---|
| `a020209a…` (`peklo-severu-road-n-2-2027`) | 26. 4. 2027 (pondělí), místo „Severu“, web `/cz/vysledky/`, přihláška `/cz/registrace/` | 25. 4. 2027, Česká Kamenice, web `/cz/`, bez přihlášky |
| `3c3cf7c9…` (`peklo-severu-road-n-1-2027`) | „Peklo Severu Road N°2 RR 50,8 km“, 25. 4. 2027, „Severu“ | sloučeno do `a020209a…` |

Stránka přihlášek pořadatele ukazuje jen rok 2026, proto se odkaz odstranil a nezamkl; nová přihláška se může doplnit.

Smazán automatický verdikt `duplicate_reviews` `0757a1d8-9596-413d-aa3c-6d94a55b754c` („model: Rounds N°1 and N°2 are separate races on different days.“, 4. 10. 2026). Záznam „N°1“ se mezitím přepsal na N°2, takže verdikt přestal platit. Závod N°1 pro 2027 nikde doložený není a nepřidal se.

Vrácení sloučení: `scripts/restore-event-merge.ts`, stav je v `pipeline_merge_history`; verdikt pak znovu vložit.

## Road Stage

Zdroj: [roadstage.cz](https://www.roadstage.cz/) („Jedna série, tři zážitky“): Orlické hory 5. 6., Hradec Králové 11. 9., Grande Finale 12. 9. 2027. Slogany jsou z [firemních akcí](https://www.roadstage.cz/firemni-akce) a [Stage Security](https://www.roadstage.cz/stage-security).

- Všechny tři závody jsou v seriálu `road-stage`; ten má web `https://www.roadstage.cz/`.
- „RoadStage — Deštné v Orlických horách“ je teď „Road Stage Orlické hory“.
- „MĚSTO, SPORT A RODINY — Road Stage Grande Finale“ je teď „Road Stage Grande Finale“; web byl `…/grande-finale/kancelar-zavodu#kalkulacka`, teď `…/grande-finale`.
- Skryté seriály, členství odstraněna: `roadstage`, `bezpecnost-v-pohybu`, `mesto-sport-a-rodiny`, `spolecny-den-na-silnici`.
- Pozastavené zdroje, ze kterých slogany vznikly: `https://www.roadstage.cz/firemni-akce`, `https://www.roadstage.cz/stage-security#uzavirky`.
- Zamčeno `series_id` na všech třech závodech, název a web podle tabulky výše. Hodnoty ruční správy u Hradce Králové se neměnily, přidal se jen zámek seriálu.

## L'Etape Czech Republic

Zdroj: [letapeczech.cz](https://www.letapeczech.cz/) uvádí Pardubice 3. 10. 2026 a Prahu 19. 6. 2027 pod jedním názvem. Oba závody jsou v `letape-czech-republic-by-tour-de-france`, `series_id` je zamčené a `l-etape-czech-republic` je skrytý.

## Popisy seriálů

Interní poznámka odstraněna. Dětský MTB Cup podle [jeho webu](https://www.detskymtbcup.cz/); u ostatních se jen odstranila poznámka.

| Seriál | Dřív | Teď |
|---|---|---|
| `detsky-mtb-cup` | Specializovaný mládežnický seriál; zahrnut kvůli úplnosti. | Cyklistický seriál pro děti a mládež od 2 do 16 let v Libereckém kraji. |
| `arbo-karnten-sport-nachwuchscup-stra-e` | Korutanský zemský silniční pohár; zahrnut kvůli úplnosti. | Korutanský zemský silniční pohár. |
| `kaferle-kids-cup` | Dvoudílný regionální seriál; zahrnut kvůli úplnosti katalogu. | Dvoudílný regionální seriál. |
| `allgauer-alpenwasser-mtb-kids-cup` | Regionální série; jedna zastávka v Reutte v Rakousku. Zahrnuto kvůli úplnosti katalogu. | Regionální série; jedna zastávka v Reutte v Rakousku. |
| `austrian-youngsters-cup` | Národní MTB seriál mládeže; zahrnut kvůli úplnosti katalogu. | Národní MTB seriál mládeže. |
| `liga-mtb-junior` | Jerzmanowa, Ścinawa, Obiszów, Jakubów a Wilków; zahrnuto bez věkového filtru kvůli úplnosti katalogu. | Jerzmanowa, Ścinawa, Obiszów, Jakubów a Wilków. |
| `detska-liga-adriana-babica` | Dvanásť kôl v kalendári SZC; zahrnuté kvôli úplnosti katalógu bez vekového filtra. | Dvanásť kôl v kalendári SZC. |
| `detska-povazska-cykloliga` | Dohňany, Dolná Maríková a Súľov; zahrnuté kvôli úplnosti katalógu. | Dohňany, Dolná Maríková a Súľov. |

## Přihlášky Dětského MTB Cupu 2027

Všech 8 závodů 2027 vedlo na stránky ročníku 2026 na nazavody.cz. Odkazy jsou odstraněné, předchozí hodnoty jsou v `event_facts` (`field = registration_url`, `method = manual_source_review`).

Stránky jednotlivých kol na webu pořadatele stále odkazují na ročník 2026 a sběr dat je čte, proto je `registration_url` zamčené. **Až pořadatel zveřejní přihlášky 2027, je potřeba pole odemknout a odkaz doplnit.** Zámek brání i automatickému doplnění.

## Nalezeno a neopraveno

- Závody L'Etape v Praze mají místo „Prague“ i v české verzi.
- Slug skrytých seriálů vrací po publikaci 404, přesměrování na hlavní seriál neexistuje.
