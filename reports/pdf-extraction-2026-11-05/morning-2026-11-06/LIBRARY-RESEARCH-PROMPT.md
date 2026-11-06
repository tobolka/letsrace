Udělej hloubkový průzkum open-source knihoven a nástrojů (hlavně GitHub) pro níže popsaný systém. Nechci obecný přehled ani „top 10 nástrojů“. Chci podklad k rozhodnutí, co nasadit, co vyzkoušet a co vynechat.

# Produkt
Let's Race je katalog cyklistických závodů pro jezdce a rodiče: Česko, Slovensko, Německo, Rakousko, Švýcarsko, Itálie, Polsko. Dnes asi 1 500 budoucích závodů z 732 webů, cíl jsou tisíce závodů. Weby jsou různorodé: kluby na WordPressu, seriály, svazy, časomíry, kalendáře, PDF, skeny a plakáty jako obrázky. Jazyky: čeština, slovenština, němčina, polština, italština, francouzština, angličtina.

# Cíl
U každého známého závodu postupně dohledat a udržovat: odkaz na propozice daného ročníku, organizační pokyny, pravidla série, kategorie s ročníky narození, pořadatele a kontakt, startovné, tratě, harmonogram, čas startu a délku podle kategorie, prezentaci, uzávěrku přihlášek, kdo smí startovat (licence, příchozí), parkování, adresu nebo GPS, odkaz na registraci a výsledky. Každý údaj musí mít dohledatelný důkaz: zdrojová adresa a doslovná citace. Radši žádný údaj než špatný.

# Technické prostředí
- TypeScript, Node.js 22, Next.js, Postgres (Supabase). Čtení běží na jednom Macu s Apple Silicon v launchd, ne v cloudu.
- Python je přijatelný jako samostatný místní nástroj ve vlastním prostředí, pokud přinese doložený užitek.
- Placená AI: Anthropic Claude, hlavně Haiku, rozpočet 0,50 USD denně a 5 USD měsíčně. Jeden závod s modelem dnes stojí zhruba 0,2 až 0,5 centu.
- Hledání: Brave Search API, 1 000 dotazů měsíčně zdarma.
- Zakázané: obcházení captcha a ochrany proti botům, přihlašování na cizí weby, nezákonné použití dat. Placenou službu navrhni jen s konkrétní cenou pro 5 000 závodů a jasně ji odděl od open source.

# Co už máme a jak to dopadlo
- Vlastní čtečka: stažení stránek, `unpdf` pro text z PDF, macOS Vision pro skeny, Playwright pro stránky v JavaScriptu, Haiku se strukturovaným výstupem a ověřením, že citace je opravdu v dokumentu.
- Docling jsme změřili a odmítli: po opravě našeho vykreslení nepřinesl žádný správný údaj navíc a na plakátech byl horší.
- Vlastní pravidla pro totožnost závodu, duplicity (pg_trgm a vlastní pravidla) a JSON-LD.
- Poslední měření na 38 nejbližších závodech: 55 údajů u 19 závodů za 0,06 USD. U ostatních nejčastěji chyběl dokument nebo měl závod v katalogu jen stránku cizího kalendáře.

# Skutečné chyby, které mají řešit
1. Najít dokument: z 44 nejbližších závodů v CZ a SK má odkaz na propozice jen 12. Web pořadatele často neznáme a katalogový název („TBC — Hůrka“) se liší od skutečného („Hůrecký krpál“).
2. Záměna závodu: hledání vracelo kasino ve stejném městě, atletický závod nebo jiné kolo téže série.
3. Slučování: kalendáře si přepisovaly hodnoty podle toho, kdo se četl poslední, až tlačítko vedlo na cizí kalendář nebo jiný závod. Rozlišit stejný závod od jiného kola série je těžké.
4. Spolehlivost běhu: sdílené časové limity po webech, přerušené úlohy, běh naprázdno.
5. Škálování: chceme platit za každý web jednou, ne za každý závod opakovaně.
6. Chyby ve smyslu: vstupenky pro diváky uložené jako startovné, ředitel seriálu jako pořadatel kola, slovo „Statut závodu“ čtené jako stanovy spolku.

# Oblasti průzkumu
Ke každé oblasti najdi nejlepší kandidáty, i ty, které tu nejmenuji. Jména níže jsou jen tipy, ověř, že existují a jsou živé.

A. **Procházení webů a hledání dokumentů**: pokračování po pádu, rozestupy po doménách, sitemap, stránky v JavaScriptu, nalezení PDF. Tipy: Crawlee, Scrapy, Katana, Crawl4AI, Scrapling.

B. **Naučené postupy po webech** (wrapper induction, samoopravné scrapery): AI jednou vytvoří postup pro web a další čtení jsou bez AI. Toto je nejdůležitější oblast, protože rozhoduje o ceně na tisíce závodů. Tipy: generování schématu v Crawl4AI, ScrapeGraphAI, AutoScraper, Scrapling, Stagehand, LLM Scraper.

C. **PDF, tabulky a skeny**: české znaky, tabulky startovného a harmonogramu, plakáty, vícesloupcové sazby. Srovnej s `unpdf` a macOS Vision. Tipy: Marker, MinerU, Surya, PaddleOCR, pdfplumber, Camelot, OCRmyPDF, Unstructured, LiteParse.

D. **Vytěžování s důkazem**: ke každé hodnotě přesné místo ve zdroji, opravy při neplatné odpovědi, možnost zdržet se odpovědi. Tipy: Google LangExtract, Instructor, BAML, Outlines, DSPy, pydantic-ai, knihovny pro TypeScript.

E. **Normalizace**: vícejazyčná data včetně rozsahů („14.–15. 11.“), ceny, telefony, adresy, časy. Tipy: chrono-node, dateparser, price-parser, libphonenumber, libpostal.

F. **Hotové struktury na webu**: JSON-LD, Microdata, iCal, The Events Calendar, Open Graph, metadata PDF. Kolik to reálně pokryje u malých klubových webů? Tipy: extruct, metascraper, htmldate, trafilatura.

G. **Totožnost a slučování**: hledání duplicit, rozlišení kol série, ročníků a závodů stejného dne ve stejném městě, výběr hodnoty po polích (survivorship, truth discovery), historie rozhodnutí. Tipy: Splink, dedupe, recordlinkage, Zingg, GoldenMatch. Zvlášť napiš, jestli existuje použitelná open-source implementace výběru hodnoty po polích.

H. **Hledání bez placených limitů**: SearXNG, Common Crawl index, Mojeek, Marginalia, Web Data Commons (schema.org Event). Co je legální, stabilní a použitelné na hledání webu závodu a PDF?

I. **Kvalita dat bez ruční kontroly**: kontrola hodnot, sledování změn v rozložení, regresní sady pro AI. Tipy: Great Expectations, Soda, Pandera, promptfoo, Langfuse.

J. **Běh na jednom stroji**: trvalé úlohy, opakování, fronta po doménách, přehled. Tipy: pg-boss, Graphile Worker, DBOS, Prefect, Dagster. Uveď, kdy je to zbytečné.

K. **Podobné projekty**: otevřené agregátory závodů a akcí a oficiální zdroje dat, ze kterých se dá učit nebo převzít kód: cyklistické a běžecké kalendáře, API svazů a časomír, typická struktura propozic.

# Testovací dokumenty k ověření
Pokud můžeš, zkus nástroje přímo na nich a uveď, co vyšlo:
- https://spsvd.cz/wp-content/uploads/2026/10/2026_Hurecky_krpal_cyklokros_propozice.pdf (textové PDF s tabulkami)
- https://www.cyklokros.cz/files/rozpis-janev-cup-2026-cyklokros-v22.pdf (dokument celé série s více závody)
- https://tbcserie.cz/kalendar-2026/zavod-203/ (stránka závodu na webu série)
- https://tbcserie.cz/kalendar-2026 (kalendář, ze kterého vedou stránky závodů)
- https://mtbteam.cyklokyjovsky.cz/akce/cyklokros-slavkov-u-brna-2026/ (klubový web)
- https://www.ucicyclocrossworldcup.com/en/calendar/2026-2027/tabor-5 (obsahuje vstupenky pro diváky, past pro startovné)

# Pravidla průzkumu
- Každý projekt skutečně otevři. Uveď datum posledního commitu nebo vydání zjištěné dnes, licenci, jazyk a počet hvězd. Nic nevymýšlej, a co nejde ověřit, tak označ.
- Odděl nezávislá měření od tvrzení autora nebo prodejce. README není důkaz přesnosti.
- Hledej i slabiny: otevřené problémy s češtinou a diakritikou, chyby, opuštěnost, závislost na GPU nebo Linuxu, změny licence.
- U každého doporučení napiš, jaký náš konkrétní problém řeší a co z vlastního kódu by nahradilo.
- Pokud pro nějakou oblast nic vhodného není, napiš to rovnou. Vlastní kód je správná odpověď, když je to pravda.

# Výstup
1. **Shrnutí:** 5 nejpřínosnějších věcí seřazených podle dopadu na počet správných údajů u závodů a na cenu, s jednou větou proč.
2. **Tabulka ke každé oblasti:** projekt, odkaz, poslední aktivita, licence, jazyk, běh na Macu bez GPU, cena na 5 000 závodů, co řeší, důkaz přesnosti a jeho autor, hlavní riziko, verdikt (nasadit, vyzkoušet, nepoužít).
3. **Pokus na jeden den** ke každému „vyzkoušet“: přesný postup, vstup a měřitelné kritérium úspěchu, například „ze 30 ručně ověřených propozic přečte aspoň X polí správně a méně než Y špatně, proti našemu současnému výsledku“.
4. **Doporučená architektura** pro 5 000 závodů z 1 000 webů s odhadem nákladů za měsíc: co je z knihoven, co zůstává vlastní a v jakém pořadí to zavádět.
5. **Co nedělat:** nástroje, které vypadají dobře, ale na tento případ se nehodí, a proč.
6. **Zdroje:** odkaz ke každému tvrzení.
