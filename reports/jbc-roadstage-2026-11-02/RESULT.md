# JBC 4X a Road Stage — 2. listopadu 2026

## Skutečně uložené změny

- JBC 2027 vytvořen jako `4a99a311-023a-4b88-8a78-ad8e954eb926`, slug `jbc-4x-revelations-2027`, veřejný, 9.–10. 7. 2027, MTB + 4X, UCI C3, Men Elite a Women Elite. Seriál 4X Pro Tour. Ročník 2026 zůstal beze změny.
- Areál Dobrá Voda: `50.70933, 15.1610825`, cílový bod z navigace odkazované oficiálním kontaktem; ne střed náhledu mapy. Liberecký kraj, `CZ-51`.
- Registrace JBC 2027 nepotvrzena, odkaz i termíny prázdné. Oficiální dětská stránka stále výslovně uvádí 2026; samostatný dětský závod 2027 nevytvořen.
- Road Stage opraven na původním ID `26c164f6-fd6a-4be5-83ca-fa7ed9f4ce3b`, slug `road-stage-orlicke-hory-2027`. Registrace Sportsoft `e=3630`, datum, seriál a staré zdroje zachovány.
- Road Stage používá existující obec Deštné v Orlických horách `85cdbe7d-f4ec-44af-b7fe-0689040f313b`, `50.304743,16.350751`. Souřadnice nezávisle porovnány s OSM obcí relation 439909 (`50.3049142,16.3505997`); jde o obec, ne tvrzení o přesném startu. Kraj Královéhradecký, `CZ-52`.
- Doplněny doložené varianty StageRALLY 69 km, Stage69 69 km, Stage138 138 km.

## Příčina a ochrana

Web Road Stage má v JSON-LD `location.name = Kikirikiii`, zatímco viditelný text i `location.address.addressLocality` uvádějí Deštné. Obecná čtečka upřednostňovala název místa před obcí a geokódovala označení místa jako obec. Nyní preferuje výslovnou obec v adrese. Původní chybný záznam místa se nemaže: zachovává se dohledatelnost. Opravené přiřazení závodu je navíc zamčeno proti přepisu automatikou; předchozí zámky zůstaly zachované.

4X je samostatná podporovaná disciplína pod MTB v taxonomii, filtrech, CSV, klasifikaci, Sumatoru a dokládání údajů AI. UCI detail má vlastní čtečku skutečných vložených dat, takže nepotřebuje AI ani Chrome. Výslovná UCI třída se předává do společného importu. Prázdný UCI detail nesmí stahovat dříve uložené závody. Verze čtečky se zvyšuje, aby staré výsledky nezůstaly přes opravu přeskočené.

Datové změny byly provedeny atomicky skriptem [apply.sql](apply.sql). [before.json](before.json) uchovává původní hodnoty, [after.json](after.json) kontrolu skutečně uložených hodnot. Termín, místo a 4X klasifikace JBC mají dohledatelné zdroje a ochranu před přepsáním nekvalitnějším importem.

## Zdroje

- UCI: https://www.uci.org/competition-details/2027/MTB/80678 — skutečná tabulka i vložené údaje: 9.–10. 7. 2027, Class 3, Men Elite a Women Elite.
- Místo: https://www.jbc4xrevelations.com/en/contact — adresa a vlastní odkaz na navigaci.
- Děti: https://www.jbc4xrevelations.com/en/kids-race — stále 2026, bez potvrzení 2027.
- Road Stage: https://www.roadstage.cz/orlicke-hory — místo, termín, varianty, původ chyby ve strukturovaných údajích.
- Kontrola: https://www.roadstage.cz/registrace a https://www.roadstage.cz/stage-security.

## Ověření a hranice

- Databázový zápis i zpětné čtení: dokončeno, včetně kategorií, souřadnic a jejich prostorové reprezentace.
- Testy: celá sada 1 374 prošla; následný test zapojení UCI do skutečné cesty sběrače také prošel. Kontrola typů, sestavení a kontrola stylu prošly.
- Nasazení `bc8a710e` READY, pozdější uživatelské nasazení `f8a2ab30` rovněž READY. Oba publikační úkoly dokončené. Ověřeno 8 skutečných veřejných odpovědí: české a anglické detaily, společný seznam, hledání, MTB/4X, země a opravené prostorové filtrování. [Důkaz](public-checks.json). Starý společný seznam vyžadoval jednorázovou obnovu dat a CDN; samotný detail tuto závadu neodhalil. Limity publikace se nenavyšovaly.
- Samostatný uživatelský filtr krajů současná aplikace nemá. Kraje jsou správně uložené, ale nelze tvrdit, že byl otestován neexistující výběr kraje. Ověřují se existující země, disciplíny, hledání a prostorové filtrování.

Ostatní zadání a velká příloha nových závodů zůstávají v [pracovním přehledu](../../docs/work-tracker-2026-11-02.md).
