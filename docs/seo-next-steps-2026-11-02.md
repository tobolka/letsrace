# LetsRace: další SEO podle skutečných dat

Návrh z 2. 11. 2026, nikoliv provedené změny. Bez odhadů návštěvnosti a časů. Vychází z aktuálního kódu, veřejného HTML sedmi reprezentativních adres a živé databáze. Aktuální souhrn Google Search Console ani reálné Core Web Vitals nebyly v této kontrole načtené. Historické počty neindexovaných adres se nepovažují za dnešní stav.

## Dnešní podklady

- Ve vzorku homepage, českého hubu, MTB hubu, druhé stránky, českého/anglického JBC a filtrovaného seznamu byly odpovědi HTTP 200, odpovídající kanonické adresy a jazykové alternativy. Druhá stránka má vlastní canonical. HTML obsahuje nadpisy a skutečné odkazy na závody. Toto není potvrzení indexace ani úplný audit všech adres.
- V databázi je 117 veřejných nesloučených záznamů závodů v ČR s termínem v roce 2027: 116 má web, 61 registrační odkaz, 43 popis delší než 80 znaků, 39 alespoň jednu podrobnou kategorii, 114 souřadnice, 11 vyplněný areál a 3 kód kraje. Nejde o nezávisle ověřené pokrytí skutečných závodů ani důkaz správnosti jednotlivých polí. Registrační odkaz nepotvrzuje otevřenou registraci.
- JBC 2027 má uložený areál a ověřenou adresu v podkladech. Veřejný JSON-LD ale uvádí pouze město a zemi, bez názvu areálu, ulice a PSČ. Organizátor jako veřejná strukturovaná entita není v současném schématu závodu uložený.
- Ve frontě publikace je 477 čekajících úkolů a 48 dokončených. Je to fronta aplikace, ne přehled indexace Googlu. Dnešní oprava mapy již doložila, že detail může být aktuální, zatímco společný seznam ještě vrací starší údaje.
- Existují přehledy zemí, zemí + hlavních disciplín, seriálů a kolekce. Přehledy zemí/disciplín pracují s nejbližšími 12 měsíci; samostatný ročník 2027 potřebuje rozsah celého kalendářního roku.
- Není důvod zavádět libovolný minimální počet slov, vyplňovat chybějící čas půlnocí nebo přidávat odhadnuté ceny a věky kvůli validátoru.

## Doporučené pořadí

1. **Spolehlivá publikace a technická kontrola.** Změněná důležitá fakta musí souhlasit v detailu, seznamech, mapě, metadatech a sitemapě. Rozlišit kontrolu zdroje od skutečné změny dat; zbytečně nepřepisovat datum změny obsahu po každém čtení. Dávkovat obnovování společných přehledů a dát přednost termínům, zrušením a opravám míst. Vyřešit stávající frontu bez plošného drahého obnovování celého webu při každém závodu.
2. **Doplnit důležité údaje závodů a jejich význam.** Oddělit obec, areál, přesný start, poštovní adresu a orientační mapový bod. Přidat strukturovaného pořadatele, případně čas startu s časovým pásmem, startovné/měnu, termíny přihlášek a podklady tras. Původ každého pole zachovat; dědičné údaje z minulého ročníku neprezentovat jako nový program. AI má zpracovávat dohledatelné podklady, ne doplňovat chybějící fakta.
3. **Využít tato data v obsahu i JSON-LD.** Název skutečného areálu, dostupná adresa, doložený pořadatel, aktuální stav a skutečně známé podmínky registrace. Chybějící pole nehádat. Zveřejněný význam musí odpovídat viditelnému detailu. Ověřit reprezentativní případy validátorem a následně v Search Console, zvlášť datum, celodenní akci, přesun, zrušení, více dní a chybějící registraci.
4. **Přidat malou sadu užitečných sezónních stránek.** Nejprve „Cyklistické závody Česko 2027“, „MTB závody Česko 2027“, „Dětské cyklistické závody 2027“ podle skutečně doložené nabídky. Nad seznamem nabídnout užitečnou orientaci: rozložení měsíců, disciplíny, doložené věkové kategorie, vzdálenosti a odkazy na seriály. Každá stránka odpovídá konkrétní potřebě. Nekombinovat automaticky každé město, měsíc, věk a disciplínu do indexovatelných adres.
5. **Teprve po doplnění lokalit regionální přehledy.** Kraje doplnit kontrolovaným přiřazením obcí či bodů k administrativním hranicím; nespoléhat na název závodu. Jasně odlišit přesnost obce od přesnosti startu. Přehledy typu „Dětské závody na Moravě“ mají vzniknout až s dostatečnými údaji a skutečnou hodnotou; Morava není pouhé jiné označení jednoho kraje.
6. **Posílit vlastní přínos katalogu.** Společně ukazovat informace z kalendáře, webu pořadatele, přihlášek a propozic; návštěvník nemusí otevírat čtyři weby. Doplňovat originální srovnání podle doložených vzdáleností, věků a termínů. Nepopisovat technickou obtížnost ani vhodnost pro začátečníka jen podle délky. GPX a profil využít, pokud existuje oficiální podklad.
7. **Lépe propojit trvalou identitu a ročníky.** Zachovat samostatné adresy jednotlivých ročníků a vlastní canonical; předchozí/další ročníky už existují. Později lze přidat trvalou stránku konkrétní závodní akce s přehledem ročníků; závodní seriál a opakovaná akce jsou různé entity. Bez plošného přejmenování stávajících adres. Vyřešené duplicity mají přesměrování a zachované vztahy.
8. **Viditelný obsah, jazyky a skutečné odkazy.** Důležité vstupní přehledy mají být běžně viditelné a snadno dosažitelné z homepage i detailů; pomocný skrytý seznam není hlavní obsahová strategie. Hreflang doplnit skutečně odpovídajícím obsahem; jeden nečleněný zdrojový popis automaticky nevytváří pět překladů. Přehledy podle kraje/sezóny nenahrazovat indexací všech parametrů mapy. Nabídnout pořadatelům a klubům užitečný odkaz na jejich akce nebo kalendář; bez nevyžádaného rozesílání.

## Kde získávat další data

| Údaj | Primární podklad | Využití |
|---|---|---|
| Termín, disciplína, existence | Pořadatel, federace, oficiální seriál | Základ detailu, kalendář, správné párování ročníků |
| Areál, adresa, přesný start | Kontakt, propozice, oficiální navigace | Místo na mapě, údaje pro Google, cesta na závod |
| Kraj | Obec/adresa + kontrolované administrativní hranice | Regionální hledání a přehledy |
| Trasy, vzdálenosti, kategorie | Propozice, registrační formulář | Výběr závodu a srovnání; ne odhad počtu tras |
| Čas, startovné, uzávěrka | Aktuální program a přihlášky | Praktické plánování, aktuální registrace, podložené nabídky |
| GPX, povrch, převýšení | Oficiální soubor/mapa a popis pořadatele | Profil trasy a konkrétní praktické informace |
| Pořadatel | Výslovně uvedená organizace v oficiálním zdroji | Důvěra, propojení akcí, správná strukturovaná data |
| Historie | Oddělené staré ročníky a oficiální výsledky | Kontinuita a vlastní hodnota archivních stránek |

## Ověření přínosu

- V Search Console sledovat důležité typy stránek, zvolenou kanonickou adresu, poslední průchod a důvody nezařazení. Nezveřejňovat staré souhrny jako dnešní stav.
- Výkon rozdělit na hledání konkrétního závodu a obecnější dotazy podle země, disciplíny, věku a sezóny. Zobrazení, kliknutí a CTR vyhodnocovat se skutečným počtem dostupných závodů.
- Na webu měřit použití mapy/filtru, přechod na pořadatele/registraci a uložení do plánu. Odchozí kliknutí nepotvrzuje dokončenou přihlášku. Bez osobních údajů.
- Měřit správnost dat na nezávislém vzorku, čerstvost veřejných změn, duplicity, pokrytí důležitých polí a náklady na získání doloženého údaje.
- Core Web Vitals posoudit z dostupných reálných uživatelských dat; velikost samotného HTML není měření této metriky.

## Primární doporučení Googlu

- [Užitečný původní obsah](https://developers.google.com/search/docs/fundamentals/creating-helpful-content): agregace má přidávat vlastní hodnotu, pouhé přepsání cizího kalendáře ji nedokládá.
- [Event a jeho údaje](https://developers.google.com/search/docs/appearance/structured-data/event): jednotlivá akce má vlastní adresu, pravdivé datum a místo; datum bez známého času lze uvést bez vymyšlené půlnoci. Speciální zobrazení událostí má omezenou dostupnost zemí/jazyků; Česko v aktuálním seznamu není. To se nesmí zaměňovat s běžnou indexací nebo platností SportsEvent.
- [Zásady strukturovaných dat](https://developers.google.com/search/docs/appearance/structured-data/sd-policies): značky mají odpovídat skutečnému viditelnému obsahu, nevytvářejí záruku rozšířeného zobrazení.
- [Parametrické filtry](https://developers.google.com/crawling/docs/faceted-navigation): neřízené kombinace plýtvají procházením. Pro přínosné dotazy vytvářet vybrané stabilní přehledy; ostatní kombinace řešit konzistentní politikou canonical/indexace podle jejich účelu.
- [Procházení a indexace](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl): dostupnost stránky ani žádost o další průchod nezaručuje zařazení do výsledků.
