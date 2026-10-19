# LetsRace: kontrola indexace Google, 18. 10. 2026

## Závěr

Hlavní doložený problém je velmi nízký rozsah procházení a indexace katalogu. Plošnou technickou blokaci kontrola nepotvrdila. Příčinu nízkého zájmu Googlebotu nelze ze samotného reportu určit; kvalita obsahu, odkazy a rozsah katalogu jsou hypotézy k další práci, nikoliv potvrzená diagnóza.

## Živě ověřená data

Search Console, doménová služba `sc-domain:letsrace.cz`:

- Přehled indexace aktualizovaný 12. 10. 2026: 2 indexované URL, 10 389 neindexovaných.
- Objeveno, momentálně neindexováno: 10 372 URL, ověřování již zahájeno.
- Procházeno, momentálně neindexováno: 15 URL. Příklady: `/cs`, `/de`, `/cs/zavody`, `/cs/zavody/cz`, `/cs/zavody/cz/road`, `/cs/zavody/cz/mtb`, `/pl/wyscigi/pl`, `/de/radrennen/de`, závod a seriál Pražského MTB poháru.
- Stránka s přesměrováním: 2 URL. Konkrétní adresy nebyly v této kontrole otevřeny, správnost obou nelze potvrdit.
- Duplicitní stránka, Google zvolil jinou kanonickou: 0 URL, ověření úspěšné.
- Kontrola `/cs`: poslední crawl 10. 10. 2026 18:05:30; Googlebot smartphone; crawl povolen; načtení úspěšné; indexace povolena; deklarovaná i Googlem vybraná kanonická URL `/cs`.
- Živý test `/cs` dokončen 18. 10. 2026 21:04: „URL is available to Google“, „Page can be indexed“. Dostupnost není potvrzení indexace.
- Inspekce URL u sitemap zobrazila „Temporary processing error“. Samostatný přehled a detail sitemapy však potvrzují „Success / Sitemap processed successfully“. Poslední čtení 7. 10. 2026, 10 385 objevených URL. Není doložena současná nefunkčnost sitemapy.
- Crawl stats aktualizované 17. 10. 2026: 868 požadavků za posledních 90 dní; 18,4 MB; průměr 175 ms. letsrace.cz 864 požadavků, www 4, oba hostitelé „No problems“.
- Typ souboru: JavaScript 74 %, obrázky 12 %, HTML 5 %, jiné 3 %, CSS 2 %. Účel: refresh 99 %, discovery méně než 1 %. Jde o požadavky včetně prostředků, nikoli 868 různých stránek.
- Odpovědi: 200 95 %, 301 2 %, 404 1 %, 302 1 %. Procenta jsou zaokrouhlená.

## Současný veřejný web

- robots.txt: 200, veřejné stránky povoleny, zákaz pouze admin/API, sitemap deklarována.
- sitemap.xml: 200, XML parsovatelné; 9 350 URL = 1 870 na každý z pěti jazyků. Bez duplicitních loc. Každý záznam má 6 jazykových alternativ včetně x-default; všechny cíle alternativ jsou v sitemapě.
- V české části: 1 746 závodů, 64 seriálů, 58 přehledů/kolekcí, homepage a about. Počet URL v reportu není počet různých závodů.
- 25 náhodných URL ze sitemapy: všechny 200, self-canonical, bez meta noindex.
- Dodatečně kontrolovány všechny jazykové homepage a hlavní příklady z reportu včetně zemí, disciplín, závodu a seriálu: všechny 200 a self-canonical, bez zjištěného zákazu indexace.
- Rozdíl mezi 10 385 URL ze čtení 7. října a dnešními 9 350 URL není důkaz chyby. Katalog se mění; zdroj sitemapy u závodů používá datum od dneška minus 30 dní.
- U dvou kontrolovaných závodů byl obsah velmi stručný: přibližně 518 a 600 znaků textu včetně navigace. To je podnět ke zlepšení užitečnosti, nikoli prokázaná příčina vyloučení celého webu.

## Konkrétní drobné chyby / staré adresy

V crawl stats je 12 historických požadavků s odpovědí 404. Viditelné příklady jsou převážně favicon a staré cesty k OG obrázkům:

- `/favicon.ico` stále vrací 404. HTML ale deklaruje SVG ikonu a apple-touch-icon, takže to není důkaz chybějící ikony v prohlížeči. Doplnit fallback ICO je nízká priorita.
- `/cs/zavod/prazsky-mtb-pohar-1-kolo-motol-xcc-mistrovstvi-prahy-xcc-2027/opengraph-image` stále 404.
- `/cs/e/ct-author-2026-10-10/opengraph-image` stále 404.
- `/en/e/peklo-severu-road-n-1-2027-04-25/opengraph-image` stále 404.
- Současný závod Pražského MTB poháru odkazuje na `/race-card/cs/prazsky-mtb-pohar-1-kolo-motol-xcc-mistrovstvi-prahy-xcc-2027`, který vrací 200 image/png. Historické 404 tedy neprokazují současně rozbité sociální náhledy.

## Doporučené pořadí práce

1. Soustředit indexační práci na českou homepage, český kalendář, české disciplíny a kvalitně vyplněné nadcházející závody. Doplnit skutečná užitečná fakta: kategorie, vzdálenosti, přihlášky, pořadatel, zdroj, propozice, související kola. Nevymýšlet text pouze kvůli délce.
2. Získat relevantní odkazy od pořadatelů, klubů a partnerů a zachovat přímé HTML odkazy na důležité stránky. Dopad odkazů nebyl v této kontrole změřen.
3. Rozdělit sitemapu podle typu obsahu a případně jazyků, při zachování funkční hlavní sitemap adresy. Přínos je přesnější diagnostika, nikoliv zaručené zrychlení indexace. Současný soubor není nad limitem.
4. Zkontrolovat rozsah pěti jazykových verzí vůči jejich skutečné užitečnosti a práci s proběhlými závody bez výsledků. Plošně nevypínat jazyky ani nezavádět noindex bez podrobnějšího rozboru.
5. Doplnit favicon.ico jako fallback. Staré OG adresy řešit pouze tam, kde existuje jednoznačný odpovídající aktuální obrázek nebo současný interní odkaz na nefunkční cestu.
6. Po změnách znovu porovnat indexaci a HTML discovery; opakované žádosti samy o sobě nezaručují přijetí do indexu.

## Rozsah a omezení

Provedena kontrola reportu indexace, příkladů vyloučených URL, inspekce české homepage a její živý test, report/detail sitemapy, crawl stats a příklady 404, veřejné robots/sitemap/HTML a vzorkování 25 URL. Nejde o kontrolu HTTP stavu všech 9 350 URL ani audit všech částí Search Console. Ruční zásahy a bezpečnostní reporty nebyly otevřeny. Zdrojový kód ani nastavení Search Console nebyly změněny, žádosti o indexaci nebyly odeslány. API runtime seo-google nebyl připraven; data Search Console byla přečtena přímo v přihlášeném Safari.

Zdroje:
- https://search.google.com/search-console/index?resource_id=sc-domain%3Aletsrace.cz
- https://search.google.com/search-console/settings/crawl-stats?resource_id=sc-domain%3Aletsrace.cz
- https://letsrace.cz/sitemap.xml
- https://letsrace.cz/robots.txt
- https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors
- https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview
