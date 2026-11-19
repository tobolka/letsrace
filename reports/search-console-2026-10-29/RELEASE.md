# SEO opravy nasazené 29. 10. 2026

Produkce: https://letsrace.cz
Deployment: dpl_Bf1EWgdtwAvHnnA68eKSUYe5J3BC
Neměnná adresa: https://letsrace-6n3o530ai-tobolkas-projects.vercel.app
Předchozí deployment: dpl_6FsTSTTjAJML5kdNG3t3g5QZSqAJ

## Provedeno

- Mapa, seznam a kalendář mají použitelný serverový náhled s až 50 nadcházejícími závody a odkazy před načtením interaktivní aplikace. Stejné HTML pro běžné návštěvníky i Googlebot; žádné rozlišování obsahu podle robota.
- Oddělení Suspense kolem mapy ponechává v HTML i původní navigaci na země, disciplíny a seriály.
- Seznam a kalendář mají vlastní canonical, jazykové alternativy a odlišné popisy/názvy v pěti jazycích.
- Všech 15 vstupních stránek je v sitemapě; vstupní stránky i sitemap mají denní obnovování. Pro vstupní stránky je denní i příslušná CDN politika. Data pro náhled se čtou jednou do společné cache, ne při každé návštěvě.
- Výběr seriálů pro sitemap nyní vyžaduje veřejné kolo v publikované zemi, povolený stav a skutečný závod. Přímý ověřovací dotaz vrátil 75 seriálů; Paris–Roubaix Challenge v něm není.
- U závodů je z popisu, názvu, nadpisového údaje o místě a strukturovaných dat vynechán zjevný zástupný údaj, pokud se místo rovná názvu závodu nebo pouze disciplíně. Uložené záznamy nebyly měněny ani doplňovány.

## Ověření

Úspěšný produkční build v pracovní kopii, v izolovaném zdrojovém balíčku i na Vercelu; TypeScript a ESLint úspěšné. 13 souvisejících testů prošlo. Vygenerované HTML všech 15 hlavních vstupů obsahuje h1, nejméně 50 odkazů na závody a vlastní správný canonical. Před přepnutím domény ověřen nasazený balíček; po přepnutí ověřen letsrace.cz. production-verification.json obsahuje úspěšné HTTP 200 kontroly, včetně /cs/seznam, /cs/kalendar, /en/list, /de/kalender a sitemapy.

Zdrojový balíček byl rekonstruován podle SHA-1 všech 963 souborů předchozí produkce; přidány pouze vyjmenované SEO změny (15 souborů), aby se do nasazení nedostala novější rozpracovaná práce z jiných úkolů. Před přepnutím domény ověřeno, že nebyla vydána jiná produkční verze. Přesné nasazené soubory jsou v release-source/, seznam v release-manifest.json. V hlavní pracovní kopii zůstávají změny necommitované; nebyla měněna historie Gitu.

## Výkon

Tři GET požadavky na každou z původních a nových neměnných deployment adres přes Vercel curl, s HTTP kompresí. Nejde o úplný test Lighthouse, mobilní CPU, vykreslení ani Core Web Vitals. Test neposkytuje důkaz zrychlení. Podrobné časy v performance-comparison.json, mediány v performance-summary.json.

- /cs: komprimované HTML 31 939 → 43 266 B (+11 327 B).
- /cs/seznam: 13 632 → 20 656 B (+7 024 B).
- /cs/kalendar: 13 186 → 20 622 B (+7 436 B).
- Medián TTFB: /cs 189 → 94 ms; seznam 164 → 171 ms; kalendář 95 → 89 ms. Běžné síťové/cache rozdíly; bez významného zhoršení v tomto malém vzorku.
- Náhled nepřidává novou klientskou datovou knihovnu ani mapovou logiku; přidává HTML a jeho RSC reprezentaci.

## Search Console a zbývající nejistota

Během dnešní diagnostiky Google potvrdil prioritní frontu pro /cs/zavody/cz a přijetí opětovně odeslané sitemapy. Po nasazení byla spuštěna žádost pro /cs; kvůli přepínání aktivního okna a následnému vypršení UI nástroje se nepodařilo spolehlivě přečíst konečný stav. Přijetí této druhé žádosti proto není potvrzeno. Nové zaindexování není potvrzeno u žádné z opravovaných stránek. Technická dostupnost ani sitemap nezaručují indexaci.

Zbývá vyhodnotit další skutečné procházení Googlebotem a doplnit slabé závody z jejich ověřených zdrojů. Není vhodné vymýšlet popisy, místa či kategorie pouze pro zvětšení objemu textu. Ruční žádosti na všechny tisíce adres nejsou řešením. Zpětné odkazy vyžadují skutečné odkazy od pořadatelů a klubů; žádné oslovování ani publikování příspěvků nebylo provedeno.
