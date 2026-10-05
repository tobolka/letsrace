# Audit a úpravy dat — 5. 10. 2026

Cíl: více závodů s vlastním webem, propozicemi, lokací, disciplínou a kategoriemi, bez falešného vyřazování při filtrování pro děti a s kontrolou ceny.

## Změřený stav

Veřejné, nesloučené závody s aktivním stavem na následujících 365 dní:

| Ukazatel | Počet |
|---|---:|
| Závody | 1 080 |
| Všech pět údajů, včetně vlastního webu | 202 |
| Chybí vlastní web, nebo je uložen agregátor | 149 |
| Chybí propozice | 801 |
| Chybí souřadnice | 36 |
| Chybí disciplína | 1 |
| Kategorie chybí nebo nejsou explicitně doložené | 396 |

Jde o vyplněnost, nikoli o důkaz správnosti každého údaje. Audit integrity má mírně odlišnou populaci: všechny budoucí veřejné záznamy, včetně neaktivních stavů.

Konzervativní kontrola duplicit nenavrhla žádné automatické sloučení. Audit integrity našel 28 skupin stejného místa a dne; mohou to být samostatné závody. Není to důkaz, že katalog je bez duplicit. Zachytil také 30 neúspěšných ingest běhů za posledních 24 hodin, 46 aktivních zdrojů ve stavu `needs_review` a 22 členství seriálu navázaných na sloučené záznamy. Tyto nálezy nebyly automaticky opravovány.

## Opravené cesty

- Filtr pro děti propouští neznámé kategorie, odhady i údaje z minulého ročníku. Chybějící větev pro minulý ročník v databázovém dotazu je doplněná. Ve výsledcích se nejistota označuje. Popisek už nepřipisuje chybějící data pořadateli.
- Potvrzené společné kategorie seriálu se doplňují před čtením závodů modely. Přenos zachovává vlastní doložené kategorie jednotlivých závodů a ručně zamčená pole. Přenos ukládá původ a předchozí hodnoty. Aktuálně je potvrzených 9 seriálů; suchý běh nenavrhl žádný další přenos.
- 34 skupin seriál/sezóna má mezery v kategoriích. Přehled v `tmp/data-goal-audit-2026-10-05.json` řadí tyto skupiny podle počtu neúplných závodů. Kategorie nelze automaticky prohlásit za společné jen proto, že je uvádí jeden závod. Výrazně rozdílné seznamy například u Cycling Austria Cyclocross Cup vyžadují kontrolu výjimek.
- Vyhledávání nejdřív čte odkazy ze známého webu. Brave hledá chybějící pole místními termíny; po nalezení webu čte jeho odkazy a zbytečné dotazy přeskočí. Má nejvýše čtyři dotazy na závod a výchozí limit 40 požadavků na proces. Oznámení na webu pořadatele už nevyřazuje jen podle adresy `/news/` nebo `/events/`.
- Paměť modelového doplňování rozlišuje jednotlivé závody sdílející web. Ukládá se až po dokončeném ověření a zápisech. Citace se přiřazují k dokumentu podle textu, ne podle nesprávně přeneseného normalizovaného offsetu. Nové verze čteček mají vlastní historii pokusů.
- Čtení kalendáře ověřuje název a celé datum v citovaném řádku. Nepřebírá místo, disciplínu či kategorie z jiného závodu na stránce. Tituly s různým číslem kola, vzdáleností nebo věkovou skupinou už nestačí ke sloučení bez dalšího důkazu.
- Chyby při ukládání důkazů nebo při čtení cílových záznamů se hlásí místo tichého úspěchu.

## Cena

Obnovovací skripty sdílejí lokální rozpočtový soubor `tmp/llm-budget.json`. Výchozí limity jsou **0,50 USD denně a 5 USD měsíčně za modely**. Měsíční limit vychází z `docs/llm-data-plan.md`; denní limit byl zvýšen po revizi konzervativních rezervací, aby první krok neblokoval navazující práci. Denní strop umožňuje nárazové doplňování a není cílovou denní útratou. Při vyčerpání měsíčních 5 USD se další placená volání pozastaví do dalšího měsíce, i když zbývá denní rozpočet. Rezervace před voláním započítávají souběžné požadavky. Restart procesu ani další krok obnovy limit neresetuje. Pokud volání skončí timeoutem, započítá se konzervativně rezervovaná částka. Starší čtečka kategorií také používá společnou cestu.

Platí pro skripty používající tento rozpočtový soubor; nejde o limit celého účtu Anthropic. Historická útrata před vytvořením souboru není automaticky započítaná. Brave se řídí samostatným počtem dotazů, jeho cena není součástí dolarového stropu modelů. Samostatně spuštěné čtečky mají procesový limit; sdílený limit aktivuje `LLM_LEDGER_PATH`. Příliš malý zbývající rozpočet může odmítnout celý požadavek, i když by skutečná odpověď nakonec byla levnější.

Opravená cena Sonnet 5.5 a nastavení krátkých auditních odpovědí vycházejí z [oficiální dokumentace Anthropic](https://platform.claude.com/docs/en/models/sonnet-5-5/overview) a [změn API](https://platform.claude.com/docs/en/models/sonnet-5-5/whats-new-sonnet-5-5). Doplněné úryvky Brave vycházejí z [dokumentace API](https://api-dashboard.search.brave.com/app/documentation/web-search/codes).

## Ověření a hranice

Živé volání Sonnetu 5.5 potvrdilo, že `thinking.type = between_tools` API přijímá. Test s limitem 60 tokenů skončil `max_tokens` a neúplným JSON, s limitem 400 tokenů vrátil platný JSON. Následný test skutečné funkce nad živým webem `https://www.perlcross.de` vrátil kladný verdikt za 0,00296 USD. Nízký limit ve `isTheRacesPage` je zvýšený na 800. Uříznutý nebo neplatný JSON se hlásí jako chyba, nikoli jako negativní verdikt; útrata se přesto započítává.

Všech 697 testů prošlo, stejně jako kontrola TypeScriptu a lint změněných souborů. Regresní testy kontrolují dětský filtr včetně databázového dotazu, levné dohledání odkazů bez modelu a Brave, důkazy v kalendáři, výjimky seriálů a sdílené denní/měsíční rozpočty.

Živý suchý test dvou obtížných italských závodů: 7 vyhledávání, 0 ověřených nových odkazů, 0,025 USD za modelové výběry. Není doložené plošné zlepšení výtěžnosti Brave; širší hledání samo nestačí. Oficiální detailové stránky a propozice seriálů mají přednost před navyšováním počtu dotazů.

Po autorizaci uživatele byly změny commitnuté a obnova spuštěná proti katalogu. Push ani deployment nebyly provedeny. Zlatá sada 50 ručně ověřených závodů a naměřená přesnost jednotlivých polí z původního plánu zatím nejsou hotové; nelze tvrdit 95% přesnost. Mezi následnými kontrolami zůstává také interpretace lokálních časů uzávěrek, které nynější zápis ukládá s UTC offsetem.


## Ostrý běh po commitu (09:40–09:54)

Pravidelný šestihodinový proces během ověřování spustil celý refresh a doběhl v 09:52. Nové modelové čtečky byly navíc spuštěné samostatně, protože dnešní značka by jejich denní blok přeskočila. Výchozí měření vzniklo již během prvního kola obnovy, takže nejde o izolovaný experiment.

| Ukazatel (aktivní veřejné závody, následujících 365 dní) | Před | Po |
|---|---:|---:|
| Závody | 1 086 | 1 080 |
| Všech pět údajů, vlastní web | 203 | 203 |
| Doložené kategorie | 687 | 687 |
| Odkaz na propozice | 279 | 273 |
| Souřadnice | 1 050 | 1 043 |
| Chybí vlastní web | 150 | 148 |

Populace se při obnově měnila, zejména německá část. Snížení počtu chybějících kategorií není jejich doplnění: počet doložených kategorií zůstal stejný. Příčinu každého odchodu z této populace nelze doložit z uloženého souhrnu; předchozí kompletní seznam ID nebyl uložen. Nelze tedy tvrdit plošné zvýšení úplnosti katalogu.

- Načteno 300 oficiálních zdrojů (3 776 upsertů, žádné hlášené selhání) a dalších 59 zdrojů (411 upsertů). Upsert není nový závod.
- Deterministické duplicity: 0 kandidátů, 0 sloučení. Audit stejného místa a dne: 29 skupin k prověření, nikoli potvrzené duplicity.
- Modelové dohledání ponechalo 4 nové či lepší odkazy: Trofeo Parco del Ticino, Local Series of Downhill ve Wisłe, detail FCI pro Coppa Citta di San Daniele a VELO Kladno. FCI detail není vlastní web pořadatele.
- Kontrola odhalila záměnu Mini Giro s hlavním Il Lombardia a obecný rakouský svazový řád vydávaný za propozice závodu. Oba nové zápisy byly vráceny přes jejich předchozí hodnoty; pozdější změny jsou chráněné porovnáním aktuální hodnoty. Byla doplněná kontrola variant mini/kids/junior a samostatný modelový audit propozic. Živý test nového auditu odmítl rakouský obecný řád.
- První pokusy měly uříznuté odpovědi. Limit výběru výsledků zvýšen na 400, limit Sonnetových kontrol stránky na 800. Poslední opakování přijalo VELO Kladno bez chyby uříznutí; druhý závod zastavil procesový rozpočet. Nejde o důkaz, že se uříznutí již nikdy neobjeví.
- Z deterministických čteček přibyla jedna přihláška. Modelový čtenář kategorií nové doložené kategorie nepřidal, čtečka dokumentů měla 4 cíle bez výsledku. Přenos kategorií potvrzených seriálů nenavrhl změnu.
- Sdílený denní a měsíční účet po běhu: 0,432391 USD, bez otevřených rezervací. Před kontrolou byl 0,058431 USD; přírůstek je 0,373960 USD za modely. Brave se účtuje samostatně. Jedno selhání geokódování a zastavení placených kroků kvůli jejich procesovým rozpočtům zůstávají v logu viditelné.

Lokální důkazy: `tmp/refresh-2026-10-05-0940.log`, `tmp/research-committed-run.log`, `tmp/research-committed-retry.log`, `tmp/research-final-verification.log`, `tmp/all-model-facts-committed-run.json`, `tmp/rules-verdict-committed-run.log`, `tmp/data-goal-before-committed-run.json`, `tmp/data-goal-after-committed-run.json`, `tmp/integrity-after-committed-run.log`. Tyto dočasné soubory nejsou verzované.
