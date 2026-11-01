# Skenování, administrace, duplicity a SEO — 1. 11. 2026

Výchozí větev: main, b2a64e11. Přiložené zadání oprav Sudet/L’Etape/Grizzlyman je historický podklad: opravy už obsahuje 6601a914; nynější veřejné stránky znovu potvrzují správné termíny. Staré ani jiné ročníky se neměnily.

## Skenování na Macu

- Poslední běh uváděl 172 selhání, ale všech 172 byly doložené limity čtečky. Nový souhrn odděluje skutečné chyby, odloženou práci a nepodporované čtení; neúspěšné zápisy nezamaskuje. Staré výsledky přepočítá jen podle zachovaných konkrétních důvodů, neúplnou historii nevydává za bezchybnou.
- Panel a soukromý runtime jsou aktualizované. Kontrolní bezplatný sken ČSC 23:12 přečetl 424 záznamů, provedl 250 zápisů (1 změněný závod, 0 nových) a skončil `ok`, bez staré chyby csc-1695. Týdenní shell už nepřepisuje podrobný výsledek prázdným stavem.
- Eventiv vrací u všech šesti cyklistických filtrů HTTP 401. Adaptér nově vyhlásí konkrétní chybu místo úspěšného prázdného kalendáře; vadný formát odpovědi také odmítá. Uložené závody se tím nemažou. Opětovné čtení zdroje uložilo skutečný důvod chyby.
- TJ Sokol Chotěbuz: Node vrací `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`, i se systémovými certifikáty. Nově se tato příčina uchovává v diagnostice a panel ji vysvětluje. Ověření certifikátu ani přihlášení Eventivu se neobchází; tyto dvě vnější překážky trvají.
- AI ani placené hledání se při práci nespouštěly; rozpočet se nezvýšil ani nevymazal. Screenshot nového panelu: monitor.png.

## Administrace a discovery prompt

- Dashboard a postranní počítadlo zahrnují podklady ke konkrétním závodům i nové weby. Dosud ukazovaly jen weby, takže 20 čekajících podkladů nebylo v administraci vůbec vidět.
- Discovery queue nyní ukazuje název, navržené datum (výslovně nepotvrzené), důvod čekání a bezpečný odkaz na zdroj. Nezavádí automatické publikování ani nové hromadné schvalování. Výpadek čtení fronty se nevydává za nulu.
- Souhrn zpráv od uživatelů zahrnuje i zaslané závody; nevyřízené zprávy ani podání v době kontroly nejsou.
- Čerstvé nepodporované čtení se nevydává za porouchaný kalendář, ostatní chyby a dlouho nečtené zdroje zůstávají vidět.
- Prošlo všech 14 čekajících URL: 13 odpovídá HTTP 200, 4bikes-festival.de vrací HTTP 500. Dostupnost není potvrzená kvalita kalendáře ani souhlas s přijetím zdroje; rozhodnutí zůstávají k ověření.
- Lesák CUP 2027 už v katalogu je, včetně sloučeného staršího duplikátu. Nadbytečný čekající návrh je uzavřen standardním postupem podle uloženého otisku a s odkazem na existující ID. Žádný další nový závod se nezveřejnil.
- ROAD STAGE zůstává k ověření: návrh obsahuje den kanceláře 5. 6., uložený závod má 6. 6.; není bezpečné tyto údaje automaticky zaměnit. Další čekající položky zahrnují slovenské agregátorové termíny, neúplné termíny a rozpory identity. Podrobnosti: admin-audit.json.
- Společný prompt pro oba poskytovatele doplňuje web předchozího ročníku, jeho homepage, novinky a přihlášky. Zakazuje přenášet starý termín či staré podrobnosti jako potvrzené nové údaje. Nehádá dny, nerozděluje délky jednoho závodu a nezveřejňuje modelové návrhy.

## Ověřené duplicity NRW Cross Cup

Důkaz: https://www.dsergebnis.de/nrw-cross-cup-2026/ uvádí jednotlivá kola, jejich dny, místa a návazné přihlášky. Oba záznamy Kendenich odkazovaly i na totožné RaceHub UUID v různých záložkách.

| Závod | Zachované ID | Sloučené ID |
|---|---|---|
| Die Mauer von Kendenich, 7. 11. | a55944aa-c6ac-4428-bfcd-eba0a897582d | 3a64d3b6-b9c8-4d82-a29e-1ec3b1df6ce9 |
| Frank Oxenfart Campus Cross, 5. 12. | 93a4f5d5-7043-41e4-b834-069df9fd1105 | 9f255e7a-a446-4f95-a11b-3226fc4b39a1 |
| Donkey Creek Cyclocross, 21. 11. | 38b83324-c9e0-4603-8fa5-a42b50de7a87 | 1a94a41a-b49e-4941-98aa-8b653ca59ecc |

Použita existující transakční funkce `app_merge_events` s úplnými neveřejnými obnovovacími snímky. Záznamy se nemažou. Kontrola potvrzuje zachování všech 17 zdrojových řádků a 2 kategorií. Po obnovení veřejných dat se všechny tři původní adresy přesměrovávají HTTP 308 na zachované závody. Členství v obou variantách seriálu zůstalo zachované; samostatné hromadné slučování seriálů nebylo provedeno.

Deduplikace nyní rozpoznává záložky info/participants/results téhož RaceHub UUID jako jednu adresu závodu. Různá UUID a konfliktní ročníky zůstávají oddělené. Zdroje sloučených závodů nadále odkazují na zachovaná ID.

## SEO

- Živé HTML zkontrolované pro homepage, seznam, kalendář, české huby, MTB hub a jeho druhou stranu, detail závodu, přesměrování i neexistující závod. Canonical a všech pět jazyků + x-default jsou přítomné. Neexistující detail vrací 404/noindex. Homepage, seznam i kalendář obsahují odkazy na závody už v HTML.
- Sitemap před opravou: HTTP 200, 9 590 URL, cca 8,37 MB, jazykové alternativy. robots.txt povoluje veřejné stránky, chrání admin/API a správně odkazuje sitemap.
- Filtry na seznamu sdílejí canonical bez parametrů. Druhá strana MTB hubu má vlastní stránkovanou canonical a odlišné odkazy na závody. Nevytvářely se nové tenké regionální stránky ani kopie filtrů.
- SportsEvent obsahuje skutečný den, místo, disciplínu, odkazy a navázaný seriál. Opravené tvrzení: existence registračního odkazu neznamená volnou kapacitu; odstraněno automatické `InStock`. U uzavřených, proběhlých, zrušených či odložených závodů se nabídka přihlášky nevytváří.
- Nová veřejná informace o odstraněných duplicitách má ručně psanou českou i anglickou poznámku k vydání.
- PageSpeed Insights vrací HTTP 429 (vyčerpaná kvóta služby). Core Web Vitals a aktuální indexace/pořadí v Search Console nebyly změřené; nejsou označené za splněné. Důkaz: pagespeed.json.

## Kontroly a rozsah

1 269 testů ve 186 souborech prochází, včetně nových regresí pro chyby Eventivu, rozlišení nepodporovaného čtení, TLS diagnostiku, počítání práce v administraci, RaceHub identitu a údaje přihlášek. TypeScript, kontrola zdrojů a produkční build procházejí. Samostatné testy správce sběru a jeho restartu procházejí; Swift panel se sestavil a jeho zobrazení je vizuálně zkontrolované.

TypeScript nově vynechává archivní reporty stejně jako tmp: staré neúplné kopie zdrojových souborů v reportech předtím rozbíjely kontrolu aktuální aplikace. Ostatní původní rozpracované reporty a úpravy AGENTS.md nebyly přidány do tohoto commitu. Ostatní návrhy nezávislého auditu se nerealizovaly.
