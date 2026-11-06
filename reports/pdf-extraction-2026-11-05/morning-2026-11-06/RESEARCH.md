# Jak to dělají jiní a co z toho vzít · 6. 11. 2026

Hledal jsem hotové postupy a knihovny místo dalších vlastních oprav. Inženýrské popisy velkých agregátorů (Songkick, Ahotu, Eventbrite) jsem nenašel, takže pro tento typ produktu vycházím z menších projektů a obecných postupů. Srovnání knihoven pochází často od jejich autorů nebo prodejců. Bez měření na našich datech z nich nic neberu jako fakt.

## Hlavní závěr
Nejhorší chyby tohoto týdne nezpůsobila chybějící knihovna, ale naše pravidla. Odkaz přepsal poslední přečtený zdroj, čas na zápis se sdílel napříč webem a dohledávání bylo vypnuté. Výměna nástrojů by je neopravila. Knihovny dávají smysl tam, kde píšeme něco, co už existuje.

## Co z toho plyne

| Postup | Co dělá | Rozhodnutí |
| --- | --- | --- |
| **Výběr hodnoty po polích** (survivorship z oboru master data) | Pro každé pole platí pořadí zdrojů, ne „kdo přišel poslední“. | **Bereme, je to přesně naše chyba.** U odkazu na web hotové. Další krok: stejná tabulka pořadí pro datum, místo a registraci, ať si zdroje nepřepisují hodnoty. Hotovou otevřenou knihovnu jsem nenašel, je to malá tabulka u nás. |
| **Crawlee** | Trvalá fronta požadavků, rozestupy po doménách, pokračování po pádu; je pro Node.js. | **Vyzkoušet na jednom webu.** Hodí se na naši první příčinu. Celý čtecí kód ale teď neměnit, přínos není doložený. |
| **pg-boss / DBOS** | Fronta úloh v Postgresu s opakováním a odloženými chybami. | **Zatím ne.** Teď fronta přirozeně vzniká z toho, co závodu chybí. Vrátit se k tomu, pokud se cyklus bude dál zasekávat. Temporal je na jeden Mac zbytečně těžký. |
| **Splink** | Hledání duplicit bez ručního učení, umí Postgres, je v Pythonu. | **Změřit.** Máme 104 ručně posouzených dvojic, takže jde porovnat přímo. Jedno srovnání, psané autorem konkurence, ukazuje horší výsledek u údajů, které nejsou o lidech (například názvy), a to je náš případ. Proto až po měření. |
| **extruct** (JSON-LD a mikroformáty) | Čte strukturované údaje ze stránek. | **Ne teď.** JSON-LD už čteme vlastním kódem. Má smysl, jen pokud se ukáže, že vlastní čtení něco míjí. |
| **trafilatura** | Odstraní z textu stránky balast. | **Možná později.** Ušetřilo by to placenou AI, ale je v Pythonu a úspora není změřená. |
| **Firecrawl, Diffbot a podobné služby** | Placené čtení webu. | **Ne.** Stojí peníze a vážou nás na dodavatele. Na Macu umíme číst sami. |
| **Docling** | Čtení PDF. | **Ne.** Na našich datech už změřeno, viz [výsledek](../ocr-render-fix/RESULT.md). |
| **Regresní sada z ostrého provozu** | Každý ručně ověřený závod zůstane jako trvalý test. | **Bereme.** Zdroje shodně říkají, že platný JSON neznamená správný údaj. Rozšířit naše ručně ověřené vzorky tak, aby každá změna čtečky běžela proti nim. |

## Hledání na webu
Brave Search stojí podle [ceníku](https://brave.com/search/api/) 5 USD za 1 000 dotazů a dává 5 USD kreditu měsíčně. Limit jsem nastavil na 60 dotazů denně a 1 000 měsíčně, aby se držel v bezplatném kreditu. V hlavním provozu byl dosud vypnutý nastavením `BRAVE_SEARCH_LIMIT=0`.

Google z automatizovaného prohlížeče neodpovídá spolehlivě a captcha se obcházet nebude. Pokud 1 000 dotazů přestane stačit, je to rozhodnutí o penězích pro vlastníka.

## Zdroje
- [Výběr hodnoty po polích: Profisee](https://profisee.com/blog/mdm-survivorship/), [pořadí pravidel: Informatica](https://onlinehelp.informatica.com/IICS/dev/b360/en/gg-b360-configure-survivorship/Order_of_execution_for_survivorship_configuration.html)
- [Crawlee: volby crawleru](https://crawlee.dev/api/basic-crawler/interface/BasicCrawlerOptions), [diskuse o pokračování po restartu](https://github.com/apify/crawlee/discussions/2058)
- [pg-boss: fronty](https://raw.githubusercontent.com/timgit/pg-boss/master/docs/api/queues.md), [DBOS a Temporal, psáno autory DBOS](https://docs.dbos.dev/explanations/comparing-temporal)
- [Splink](https://pypi.org/pypi/splink/), [srovnání od autora konkurenčního nástroje](https://dev.to/benzsevern/goldenmatch-vs-splink-vs-dedupe-vs-recordlinkage-a-practical-comparison-1akf)
- [extruct](https://pypi.org/project/extruct/), [hodnocení trafilatura od autorů](https://trafilatura.readthedocs.io/en/latest/evaluation.html)
- [Spolehlivost strukturovaných výstupů LLM](https://tianpan.co/blog/2026/04/17/schema-problem-llm-output-production)
- [Zkušenost provozovatele velké databáze závodů](https://forums.trainerday.com/t/new-the-largest-event-run-ride-race-database-in-the-world/72466)
