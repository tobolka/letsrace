# Kontrola prvního AI běhu a oprava pipeline — 23. 10. 2026

Kontrolovaný běh: 21:33:58–22:19:04 CEST. Všech 144 nově vytvořených záznamů má rozhodnutí v `records.json`. Zdrojové stránky byly znovu načtené a porovnané s názvem a datem; u kalendářů a API byl porovnán i výsledek jejich čtečky s původním externím identifikátorem. To je kontrola proti zdrojům, nikoliv nezávislé potvrzení všech údajů od pořadatelů.

## Výsledek kontroly dat

- 97 veřejných nesloučených záznamů, z toho 75 nadcházejících.
- 31 skrytých: 22 již bylo skrytých a 9 chybných veřejných položek bylo nově skryto a uzamčeno proti automatickému znovuzveřejnění.
- 16 z původních 144 záznamů je sloučeno do jiných závodů.
- Devět chybných položek zahrnovalo obecný „Rozpis“, indexy kalendářů a staré články, kterým čtečka přiřadila datum z aktuální patičky webu. Nejde o smazání důkazů: zdroje zůstaly zachované a rozhodnutí je v `event_facts`.
- Čtyři další duplicity byly po kontrole zdrojů sloučeny: dvě kopie Sobótky, jedna kopie Seibersdorfu a jedna kopie silničního ME. Všechna sloučení mají databázový audit.
- Chybné sloučení **RSV Wenigumstadt Gravel Day / Volksradfahren Wenigumstadt** bylo opraveno. Jsou to různé gravelové a silniční vyjížďky. Obě jsou znovu samostatné, s původními zdroji, kategoriemi a důkazy; dvojice je evidována jako neslučovatelná. Později doplněný přihlašovací odkaz u gravelové vyjížďky byl zachován. Původní podmíněná obnova správně odmítla změněný stav, proto proběhlo cílené transakční narovnání s kontrolou nezměněných vazeb a samostatnou evidencí.
- Pozastaveno 36 nově objevených archivních podstránek BAWÜ. Hlavní kalendář zůstává aktivní.
- Pozastaveny čtyři nadbytečné varianty PZKol, jejichž čtečka vždy vracela celý stejný kalendář. Aktivní zůstává `https://pzkol.pl/kalendarz`; původní zdrojové vazby se nemažou.

## Opravy v kódu

- PZKol: země explicitně uvedeného místa a gazetteeru má přednost před sloupcem „POL“, který často označuje publikující federaci. Kontrolní případy Konya → TR, Cottbus → DE, Ramales de la Victoria → ES.
- Země explicitně uvedená v uloženém názvu místa, např. „Monte Tamaro (SUI)“, pomáhá opravit historicky chybný kód země bez vytvoření dalšího závodu. Jedna kopie vzniklá při prvním kontrolním opakování byla sloučena do původního záznamu a jeho místo opraveno.
- Při aktualizaci již spárovaného závodu kolize unikátního fingerprintu zachová jeho původní klíč a zapíše ostatní údaje. Nepřepisuje cizí závod a automaticky ho neslučuje. Ostatní databázové chyby se nezamlčují.
- Známé odlišné rodiny disciplín blokují sloučení i při shodném místě, datu či URL. MTB/XCO zůstávají kompatibilní.
- Generický parser nepublikuje vlastní slabé odhady; ignoruje archivy výsledků, obecné nadpisy a rozporné ročníky. Slučování s doloženým AI nálezem může důvěru zvýšit. Skryté dětské závody se automaticky neodkrývají.
- Objevování nepřidává tagy, výsledkové archivy a historické URL jako nové závody. PZKol je označený jako čtečka celého kalendáře, takže nevznikají další stejné kalendářové monitory.
- Dílčí rozpočet kalendářů je 1.25 USD a dalších sledovaných zdrojů 1.00 USD. Společný místní limit zůstává **2.50 USD denně / 25 USD měsíčně**; dílčí limity ho neobcházejí.
- Odložení kvůli AI/časovému limitu se vykazuje odděleně, ukončí aktuální proces a naplánuje pozdější pokus. Neopakuje stejnou práci v rychlé smyčce a neoznačí zdroj za kompletně přečtený. Nečitelný dynamický dokument má delší interval pro kontrolu.
- Skripty sledování vracejí nenulový stav při chybách a samostatný stav při odložené práci. Odložený denní krok nedostane značku „hotovo“.

## Ověření

- 161 testovacích souborů / 1 112 testů úspěšných; typová kontrola, lint změněných souborů, shellová syntaxe a produkční build prošly.
- Čtyři dříve chybující zdroje: 223 extrahovaných záznamů, 222 úspěšných zápisů, 1 vědomě odmítnutý záznam, **0 chyb zápisu**. Podrobnosti v `replay.json`.
- Následné opakování samotného PZKol: 198 extrahovaných, 197 aktualizovaných, 1 odmítnutý, **0 vytvořených a 0 chyb zápisu**.
- Skrytí devíti chybných položek a obnovení obou odlišných vyjížděk ověřeno následným databázovým dotazem.

Zbývající nedostupné/dynamické či příliš velké dokumenty nejsou prohlášené za přečtené. Opravy nezaručují, že všechny weby půjde načíst, a z dřívějšího `failed steps: 0` nedělají důkaz kompletního pokrytí.
