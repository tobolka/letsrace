# Úklid zdrojů a kontrol, 4. listopadu 2026

Rozhodnutí vlastníka: vypnout všechen balast, omezit kontroly. Vymezení balastu rozhodl provozní agent.

## Vypnuté zdroje

Pozastaveno 717 aktivních stránek (656 `auto-same-domain`, 61 `season-successor`). Seznam je v [paused-sources.json](paused-sources.json), v databázi mají značku `[balast-2026-11-04]` v `notes`.

Pozastavená stránka splňovala všechno:

- přidala ji automatika a není to hlavní stránka webu,
- nemá vazbu na závod, ani přes podřízenou stránku,
- není webem, přihláškou ani propozicemi žádného závodu,
- nemá otevřeného kandidáta ani běžící čtení,
- žádný její běh nikdy nezapsal závod.

Vědomě ponecháno: 34 stránek `sumator.cz`, 97 čitelných stránek s rokem 2027 z `season-successor` a stránky, ze kterých závod vznikl, i když jsou teď nečitelné.

Návrat:

```sql
update watched_urls
set status='active', notes=trim(replace(notes,'[balast-2026-11-04]','')), updated_at=now()
where notes like '%[balast-2026-11-04]%';
```

## Omezené kontroly

Uzavřeno 769 úloh detailu závodu a 61 úloh seriálu. Zůstává 10% vzorek, úlohy z posledních 24 hodin, opakované pokusy, úlohy bez potvrzené žádosti o obnovu a závody, které má někdo v plánu nebo oblíbených.

Uzavřené úlohy nebyly ověřené. Mají `result.verified=false` a `result.reverification='outside_sample_owner_2026-11-04'`. Žádost o obnovu stránky k nim byla zaznamenána, shoda veřejné stránky se u nich nekontrolovala.

## Filtr adres nestačí

Ze 717 stránek by stávající filtr adres zastavil 220, dalších 97 by zastavilo rozšíření o aktuality a stahování. To by ale zablokovalo i 2 ze 147 užitečných stránek, které dnešní filtr propouští, a existující test chrání oznámení typu `/novinky/terminy-2027`.

Před obnovením scanů je proto potřeba jiné pravidlo: automaticky přidaná stránka se po několika čteních bez závodu sama pozastaví.

## Skryté budoucí závody

Celkem 463, dalších 2 270 skrytých je už po termínu.

| Skupina | Počet | Význam |
| --- | ---: | --- |
| Mimo sedm podporovaných zemí, zdroj Eventiv | 279 | Nejčastěji závody mimo pokrytí |
| Mají podobný veřejný záznam | 31 | Pravděpodobně duplicity |
| Ostatní mimo podporované země nebo bez země | 32 | Převážně mimo pokrytí |
| Podporované země bez veřejného dvojníka | 121 | Tady jsou skutečné ztráty i smetí |

Ze 121 prošlo hrubým filtrem (termín, web, typ závodu) 40. Ve vzorku jsou skutečné závody jako Gran Fondo Strade Bianche, Nova Eroica, Rosenheimer Radmarathon nebo Wörthersee Gravel. Jsou tam i profesionální závody, triatlony, kurzy, řádky s termínem 31. 12. a v Česku smetí typu „Firemní akce“ a „Výsledky a média“.

Nic nebylo zveřejněno. Termíny z Eventivu nejsou ověřené a zdroj nyní vrací HTTP 401.
