# Pokračování: kontrola 51 položek a OpenAI

Aktuální pokračování: [kontrola zdrojů a skutečné předání tří URL do fronty](SOURCE-REVIEW.md).


Datum: 24. 10. 2026. Změny jsou lokální, bez commitu, pushnutí a nasazení. Žádné závody ani produkční fronta nebyly tímto během změněny.

## Výsledek kontroly

Cílený audit nad 51 položkami CSV doložil konkrétní datum v textu u **37 položek**, u **dvou pouze měsíc** a u jedné předběžný termín BSK Giro. Zbývajících 11 případů bylo jednotlivě přezkoumáno a každý má závěr i odkaz na důkaz v následující tabulce. Cílený audit dostává název z CSV, proto se jeho výsledky nezapočítávají jako nezávisle objevené závody.

Příklady skutečně nalezených příčin:

- Malevil Cup: 12. 6. 2027 je na obrázku pořadatele, ačkoli okolní text ještě popisuje 2026. Obrázek byl přečten vizuálně; obecný automatický OCR/vision reader není implementovaný.
- 400 Ultra a 1000 Miles: potřebné datum je na konkrétní pořadatelské podstránce/článku; samotná homepage nestačila.
- Sudety Tour: sousední datum a název formátu se při převodu HTML slepily do 2027Časovka. Čtečka nyní obnovuje hranici roku.
- DoKola a MČR XCO/XCC: rozsahy 11. 6. – 13. 6. 2027 a 16. – 18. červenec 2027 potřebovaly rozlišit počátek a konec, včetně českých názvů měsíců.
- Cyklobraní: 24. září je datum prezence. Propozice jsou výslovně dočasně neplatné. Sobotní program míří na 25. září, ale zatím z něj nelze udělat potvrzený termín. Automatická oprava ručně zamčeného řádku nebyla provedena.

## Srovnání poskytovatelů

Je implementovaná volitelná větev OpenAI Responses API s modelem `gpt-6.1-sol`, webovým hledáním a uložením skutečně vrácených zdrojů. Dostává stejný slepý prompt a nejvýše šest webových volání jako Sonnet. Sdílí procesový i denní/měsíční rozpočtový ledger; rezerva na požadavek je odhad, skutečné účtování vychází z vrácené spotřeby.

**Aktualizace 24. 10.: po doplnění kreditu živý běh OpenAI úspěšně skončil.** Klíč ani kredit už nejsou blokující. Pro tento test byl použit uživatelem schválený denní limit 2,75 USD; konfigurace běžných limitů zůstává beze změny.

| Výsledek jednoho slepého zadání | OpenAI gpt-6.1-sol | Sonnet |
| --- | ---: | ---: |
| Webová volání | 6 | 6 |
| Návrhy s URL ze skutečného hledání | 47 | 13 |
| Různé zdrojové URL | 82 | 47 |
| Cena běhu USD | 0.21396 | 0.19978 |
| Řádky CSV se stejnou zdrojovou URL | 17 / 51 | 4 / 51 |

OpenAI přidalo **76 zdrojových URL**, které nebyly v původních výsledcích Sonnetu ani osmi dotazů Brave. Společných URL obou AI běhů je 3. Všech 82 zdrojových úloh OpenAI je uložených v místní frontě k dalšímu čtení. Čísla nejsou počty nových závodů v databázi. Jde o jediný běh každého modelu; přesnost, úplnost identity a termínů ještě nejsou porovnané. CSV bylo použité až pro vyhodnocení, model jeho seznam nedostal.

Strukturované srovnání, návrhy a nové odkazy: [openai-comparison.json](openai-comparison.json). Žádný závod nebyl z tohoto běhu zapsán do katalogu. Praktický výsledek zatím podporuje použití OpenAI jako dalšího nezávislého zdroje kandidátů ve společné frontě.

Implementace byla ověřena proti [oficiální dokumentaci webového hledání](https://developers.openai.com/api/docs/guides/tools-web-search) a [modelu](https://developers.openai.com/api/docs/models/gpt-6.1-sol). API klíč se nemá posílat do chatu ani ukládat do repozitáře.

## Provozní změny a ověření

- Fronta nejdříve zpracuje původní výsledky hledání; další úrovně odkazů mají nižší prioritu. České domény mají přednost, jiné domény zůstávají přípustné.
- Obrázky se nepředávají textovému modelu jako nesmyslně dekódované HTML. Zůstávají viditelně odložené pro vizuální čtení.
- Výsledky rozlišují přínos jednotlivých poskytovatelů i přes následné odkazy. Počet zdrojů či tvrzení se nevydává za počet ověřených nových závodů.
- Ověřování uložených odpovědí lze opakovat bez nového placeného modelového volání.
- Prošlo 1 149 testů, kontrola typů a lint změněných souborů. Ruční textové důkazy byly navíc znovu porovnány se snapshoty a datové rozsahy se společným ověřovačem.

Automatické datum není schválení identity, autority zdroje, samostatnosti závodu nebo veřejného zápisu. Celá fronta ještě není dočtená. Stav publikace všech následujících položek je neschválený.

## Všech 51 položek

| Závod | Výsledek | Zdrojový den/rozsah |
| --- | --- | --- |
| MČR v cyklokrosu | Datum doložené v textu | 2027-01-10 |
| Pražský MTB pohár I. – XCC | Datum doložené v textu | 2027-03-26 |
| Pražský MTB pohár II. – XCO | Datum doložené v textu | 2027-03-27 |
| Jízda zručnosti Průhoňáci | Pouze měsíc | — |
| Rohálovská 50ka | Datum doložené v textu | 2027-05-01 |
| May Divide | Datum doložené v textu | 2027-05-01 |
| Grand Prix West Bohemia | Datum doložené v textu | 2027-05-01 |
| Závod míru juniorů | Doložen pouze první den | 2027-05-06 |
| Zlivský cyklomaraton | Datum doložené v textu | 2027-05-08 |
| Chotěbuzský kopec | Datum doložené v textu | 2027-05-08 |
| Sudety Tour – časovka | Datum doložené v textu | 2027-05-08 |
| Sudety Tour – Mediofondo | Datum doložené v textu | 2027-05-09 |
| Sudety Tour – Granfondo | Datum doložené při kontrole zdroje | 2027-05-09 |
| 400 Ultra / 200 Hard | Datum doložené při kontrole zdroje | 2027-05-21 – 2027-05-23 |
| Mamut Tour | Čeká na potvrzení pořadatele | — |
| Gravel Epic Šternberk | Datum doložené v textu | 2027-05-22 |
| Okolo Stejskala | Datum doložené v textu | 2027-05-22 |
| Decathlon Cyklomaraton Hradec Králové | Datum doložené v textu | 2027-05-30 |
| Lost Ride | Datum doložené v textu | 2027-06-01 |
| Road Stage Orlické hory | Datum doložené při kontrole zdroje | 2027-06-05 |
| Visegrad 4 – Grand Prix Czech Republic | Datum doložené v textu | 2027-06-05 |
| DoKola! / DoKolečka! | Datum doložené v textu | 2027-06-11 – 2027-06-13 |
| Malevil Cup | Datum na obrázku pořadatele | 2027-06-12 |
| Rusavská 50 | Datum doložené v textu | 2027-06-12 |
| Krakonošův cyklomaraton | Datum doložené v textu | 2027-06-12 |
| Dětské závody na pumptracku | Datum doložené v textu | 2027-06-13 |
| WOLFman | Datum doložené v textu | 2027-06-18 |
| L’Etape Czech Republic by Tour de France | Datum doložené v textu | 2027-06-19 |
| Dolnolhotský BAJK | Datum doložené v textu | 2027-06-19 |
| BSK Giro Pičín | Předběžné | 2027-06-20 |
| Vinařská 50 | Datum doložené v textu | 2027-06-26 |
| 1000 Miles Adventure | Datum doložené při kontrole zdroje | 2027-07-04 |
| Trojmezí | Datum doložené v textu | 2027-07-07 |
| Ratajská 40 | Datum doložené v textu | 2027-07-10 |
| MČR XCO / XCC | Datum doložené při kontrole zdroje | 2027-07-16 – 2027-07-18 |
| V4 | Datum doložené v textu | 2027-08-01 |
| Czech Tour | Termín v městském kalendáři | 2027-08-12 – 2027-08-15 |
| Cyklozávod ČEZ Kolem Lipna | Datum doložené v textu | 2027-08-15 |
| HIGH POINT Galaxy MTB maraton | Čeká na potvrzení pořadatele | — |
| Bike Paradise | Datum doložené v textu | 2027-08-21 |
| Půl Paradise | Datum doložené v textu | 2027-08-21 |
| Tour de Kosová | Datum doložené v textu | 2027-08-21 |
| Junior Cup – 9. ročník | Datum doložené v textu | 2027-08-22 |
| Tour de Jedlová | Pouze měsíc | — |
| Tour de Zeleňák | Datum doložené v textu | 2027-09-04 |
| Road Stage Hradec Králové | Datum doložené v textu | 2027-09-11 |
| Road Stage Grande Finale | Datum doložené v textu | 2027-09-12 |
| Pražský MTB pohár III. – XCO | Datum doložené v textu | 2027-09-25 |
| Pražský MTB pohár IV. – XCO | Datum doložené v textu | 2027-09-26 |
| Author Valtické Cyklobraní | Dočasně neplatné propozice | — |
| ČT Author Cup | Datum doložené v textu | 2027-10-09 |

Textové snapshoty zůstávají v tmp/discovery-audit-2026-10-24, obrazový důkaz je v images/malevil-2027.jpg. Strukturované výsledky, zdrojové otisky a meze jednotlivých rozhodnutí jsou v [audit.json](audit.json).
