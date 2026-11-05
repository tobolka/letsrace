# Další ročníky závodů

Minulý ověřený ročník je výchozí základ nového záznamu. Pro rok 2027 běžně čerpáme z roku 2026: závod nemusíme znovu poznávat od nuly a nemusíme čekat na nové propozice, když pořadatel už oznámil termín. Nové ověřené informace postupně nahrazují převzaté údaje.

## Postup

1. Ověř totožnost závodu, místo a případné kolo seriálu. Nový ročník zakládej samostatně; starý zůstává v historii.
2. Najdi výslovně oznámené datum včetně nového roku. Datum neposouvej odhadem o rok ani podle stejné soboty. Čti i hlavní stránku: nový termín může být v poděkování za minulý ročník, zatímco propozice zůstávají staré.
3. Převezmi stabilní údaje: název, disciplínu, obecné zařazení, dosavadní místo a web pořadatele bez odkazu na konkrétní starý rok. Ulož původ v minulém ročníku. Nově oznámené změny mají přednost.
4. Věkové kategorie převezmi orientačně s `age_confidence = previous`; stránka už umí zobrazit „podle minulého ročníku“. Staré podrobné kategorie, ročníky narození, trasy, vzdálenosti a harmonogram nejsou potvrzené pro nový rok. Pokud je nelze na stránce zřetelně označit jako historické, ponech je jen v podkladech.
5. Nepřenášej dokončený/zrušený stav, výsledky, otevřenou registraci, její termíny, startovné ani staré propozice jako aktuální. Odkaz na registraci ověř pro nový ročník i tehdy, když v adrese nemá rok.
6. Nové informace doplňuj po jednotlivých údajích s odkazem na zdroj. Potvrzené údaje mají přednost před předpoklady; respektuj ručně uzamčené hodnoty. Nejasnou shodu nebo protichůdné zdroje předej k ověření.

Při kontrole sezóny projdi weby všech veřejných nesloučených závodů minulého roku. Společné adresy načti jednou a termín přiřaď konkrétnímu závodu. Zmínka roku 2027, copyright, termín registrace nebo datum jiné akce nejsou samy o sobě oznámením nového ročníku. Nedostupný web vykazuj jako neověřený, nikoli jako web bez nového termínu.

## Co automatizace už dělá

`src/lib/catalog/previous-edition.ts` doplňuje chybějící údaje do **již existujícího** nového záznamu. Hledá jednoznačnou shodu názvu nebo kola seriálu ve stejné zemi a poblíž stejného místa, 300–430 dní po předchozím ročníku. Přenáší výslovné věkové kategorie jako `previous`, chybějící disciplínu, třídu a vhodný web; respektuje ruční zámky.

Tento krok sám nezakládá nové ročníky a nedokládá, že prošel všechny weby minulého roku. Obecné pokyny výše platí i při ruční kontrole a při dalších úpravách sběru; nejsou tvrzením, že všechny kroky už běží automaticky.

Nové ročníky z webů pořadatelů zakládá pravidelný průchod na Macu (`scripts/local-cycle.cjs`). Pokračuje v uloženém čtení (`organiser-check-<rok>` v soukromých datech), posoudí uložený text bez AI (`src/lib/catalog/next-edition-literal.ts`) a stejnými branami jako dřív (`decideEdition`, `validateReviewSource`, `ingestReviewedCandidate`) zapíše jen do místní kopie. Na server jde závod až po kontrole proti čerstvému katalogu včetně skrytých a sloučených záznamů. Doslovné čtení je úmyslně užší než model: chce jedno datum závodu nebo řádek, který závod jmenuje, dostatečnou shodu názvu a datum blízko loňského. Co nesplní, čeká a nic neztrácí; placená AI v tomto kroku neběží.

## Jednorázová kontrola webů minulé sezóny

`node scripts/with-node.cjs tsx scripts/audit-next-edition-websites.ts 2026` projde webové odkazy všech veřejných nesloučených závodů 2026. Adresy sjednotí, u pořadatelů doplní hlavní stránku a následuje nejvýše tři výslovné odkazy na nový rok z každé výchozí stránky. Respektuje omezení požadavků na stejný web. Po třech po sobě jdoucích odmítnutích kvůli počtu požadavků, oddělených minutovými pauzami, zbylé adresy daného webu odloží a výslovně je označí jako nenačtené. Pokračování používá uložené výsledky; `--retry-errors` znovu zkusí síťová selhání, omezení požadavků a chyby serveru. Již potvrzenou blokaci lze při pokračování respektovat pomocí `--defer-host=my.raceresult.com`.

Výstupy jsou v datovaném adresáři `reports/next-edition-websites-*`: souhrn pokrytí, texty zdrojů, historie pokusů, nálezy a seznam jednotlivých závodů v JSON/CSV. Záznam „stránka obsahuje datum 2027“ je podnět k ověření totožnosti závodu, nikoli potvrzený termín. Podobnost názvu s existujícím ročníkem je jen pomůcka. Nečitelný web je uveden zvlášť a absence zachyceného data není důkazem, že pořadatel nic neoznámil. Data v obrázcích a obsah vyžadující prohlížeč potřebují další kontrolu.

Samotné čtení nepoužívá placenou AI a nic nezapisuje do katalogu; to dělá až posouzení popsané výše.

Existující audit lze přepočítat bez databáze i bez stahování stránek pomocí `node scripts/with-node.cjs tsx scripts/audit-next-edition-websites.ts --replay=CESTA_K_ARCHIVU`. Vstup tvoří snímek `races.json`, záznamy `pages.jsonl` a uložené texty `pages/`. Výsledky se ukládají do podadresáře `replay/`. Zachycený rozsah, například „19–20. června 2027“, zůstává v přehledu celý. Datum z neúspěšného požadavku se mezi kandidáty nedostane. U krátkých stránek vyžadujících další kontrolu zůstává nalezený text viditelný s příslušným označením.

## Ověřený příklad: Rožmitálský cyklokros

Dne 30. 10. 2026 pořadatel na https://rozmitalskycyklokros.cz/ oznamuje 16. 10. 2027. Založen samostatný veřejný ročník `rozmitalsky-cyklokros-2027`, s místem a disciplínou z roku 2026 a kategoriemi označenými jako převzaté. Registrace a propozice pro 2026 nejsou vydávány za platné pro 2027. Oficiální web je přidaný ke sledování. Historie a zdroje jsou v `event_facts`; provedený zápis je v `reports/rozmital-next-edition-2026-10-30/apply.sql`.
