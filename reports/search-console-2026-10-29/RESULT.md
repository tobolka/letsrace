> Aktualizace: lokální oprava popsaná níže již byla rozšířena a nasazena. Aktuální stav je v [RELEASE.md](RELEASE.md). Níže je původní diagnostický záznam.

# LetsRace: diagnostika indexace, 29. 10. 2026

## Přímo ověřeno v přihlášené Google Search Console

Přehled indexace (aktualizace 23. 10. 2026):
- Indexováno: 2 URL, /en a /sk. V příkladech poslední procházení 16. 9. 2026.
- Objeveno, aktuálně neindexováno: 10 372 URL.
- Procházeno, aktuálně neindexováno: 15 URL.
- Přesměrování: 2 URL. Dřívější problém odlišného canonicalu: 0 URL.
- /cs: procházeno 10. 10. 2026 18:05:30, načtení úspěšné, crawling i indexace povoleny. Deklarovaný i vybraný canonical /cs. Živý test 29. 10. úspěšný, ale screenshot ukazuje mapu a 0 závodů.
- /cs/zavody/cz: procházeno 10. 10. 2026 18:05:28; načtení úspěšné, indexace povolena, canonical odpovídá kontrolované URL; procházeno, aktuálně neindexováno.
- Sitemap před zásahem: úspěch, odeslána i naposledy načtena 7. 10., tehdy 10 385 objevených URL.
- Crawl stats (aktualizace 28. 10.): 868 požadavků za posledních 90 dní, průměrná odezva 175 ms; oba hosty bez problémů. 95 % odpovědí HTTP 200. 99 % refresh, discovery <1 %. HTML 5 %, JavaScript 74 %, obrázky 12 %. To nejsou počty unikátních stránek.

## Živý web

robots.txt a sitemap.xml vracejí HTTP 200. robots.txt povoluje veřejný web a odkazuje na sitemapu. Kontrolované hlavní stránky a český hub mají index, follow a odpovídající canonical. Aktuální sitemap má 9 250 unikátních URL (~8,1 MB): 1 711 závodů × 5 jazyků, 84 seriálů × 5, 53 přehledů × 5 a 10 dalších stránek. Velikost sama o sobě nepřekračuje limity běžné sitemapy a není prokázanou příčinou problému.

HTML /cs i /en obsahuje jen navigaci a načítací kostru: 12 odkazů, žádný h1 a žádný odkaz na detail závodu. Český hub /cs/zavody/cz obsahuje závody i serverové odkazy. U příčiny odmítání indexace je nutné rozlišit tento prokázaný technický nedostatek od rozhodnutí Googlu, které není plně vysvětlené.

## Provedené akce v Search Console

1. Živý test /cs: URL is available to Google.
2. Požadavek na indexaci /cs/zavody/cz: Indexing requested; Google potvrdil přidání do prioritní fronty.
3. Jednorázové opětovné odeslání https://letsrace.cz/sitemap.xml: Sitemap submitted successfully. Tabulka potvrzuje odeslání 29. 10.; poslední přečtení zatím stále 7. 10. Nové zpracování ani indexace zatím nejsou potvrzeny.

## Lokální oprava, zatím NENASAZENÁ

Soubor src/components/explore/explore-page.tsx: samostatná Suspense hranice kolem mapové aplikace, jejíž nuqs/useSearchParams při statickém sestavení převádí obsah k nejbližší hranici na klientské vykreslení. Před opravou tím zmizel i sousední serverový SiteIndex do načítacího stavu celé stránky. Nová hranice ponechává SiteIndex v HTML; fallback mapy poskytuje přeložený nadpis, existující popis a funkční odkaz na procházení závodů.

Ověření: produkční build úspěšný včetně TypeScriptu; vygenerované HTML všech pěti hlavních stránek má h1, 114 odkazů a 40 odkazů na detail závodu. ESLint změněného souboru a git diff --check úspěšné. Dva související testovací soubory: 11 testů úspěšných. Podrobnosti v local-html-verification.json a build.log. Pole visible_text_length v JSON počítá textové uzly HTML včetně již existující sr-only navigace; neznamená všechen text vizuálně zobrazený na mapě.

Žádný commit, push ani deployment. Pracovní kopie už obsahovala mnoho souběžných změn v pipeline i stránkách; nebyly přepsány.

## Další postup

1. Nasadit samostatně ověřenou opravu hlavní stránky.
2. Zopakovat živý test /cs po nasazení, ověřit obsah a serverové odkazy; následně požádat o indexaci /cs.
3. Postupně ověřit a požádat o indexaci malého reprezentativního výběru kvalitních přehledů a detailů, ne tisíců URL.
4. Posílit skutečně viditelné propojení hlavní stránky s katalogem a získat relevantní odkazy od pořadatelů/klubů. Samotný sitemap ani sr-only index nezaručuje indexaci.
5. Po novém procházení porovnat crawl stats a jednotlivé URL Inspection. Nečekat, že přehled indexace okamžitě odrazí dnešní akce.

Google dokumentace: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics ; https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors
