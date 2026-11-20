# Odkazy na Let's Race bez oslovování pořadatelů

Stav k 16. 11. 2026. Nahrazuje dřívější plán s e-maily (smazaný `PLAN.md`, v historii gitu): pořadatelům nikdo nepíše. Hotové texty jsou v [TEXTY.md](TEXTY.md).

## Proč Google zatím neindexuje

Technicky je web v pořádku. Kontrola 16. 11.:

- Sitemapy fungují (680 přehledů, 1 688 českých stránek závodů, anglické zvlášť), domovská stránka má správný canonical a jazykové verze.
- Domovská stránka odkazuje přímo na přehledy *Závody v Česku 2027*, *MTB Česko 2027* a *Dětské závody 2027*.
- Web je ověřený pro Google, Seznam i Bing.
- Hledání „letsrace.cz“ nevrací ani jednu stránku webu.

Google o webu ví, ale nemá důvod mu věřit, protože na něj skoro nic neodkazuje. Nová doména bez odkazů zůstává ve stavu *Objeveno – neindexováno* klidně měsíce. **Pomůže jedině to, aby se o webu objevily zmínky na místech, kam Google chodí často.**

Neplatí, že musí jít o „dofollow“ odkazy z velkých webů. Google používá i odkazy z profilů a diskusí jako nápovědu, kudy jít. Navíc přivádějí lidi, a lidé, kteří web hledají jménem, jsou pro Google další signál.

## Kam mají odkazy vést

Ne na jednotlivé závody. Na tyto čtyři stránky, protože odtud se Google dostane ke všemu ostatnímu:

| Stránka | Komu se hodí |
|---|---|
| https://letsrace.cz/cs | obecně, do profilů |
| https://letsrace.cz/cs/zavody/cesko-2027 | dospělí závodníci, sezóna 2027 |
| https://letsrace.cz/cs/zavody/mtb-cesko-2027 | MTB skupiny a fóra |
| https://letsrace.cz/cs/zavody/deti-2027 | rodiče, dětské kluby |

## Impact score

Můj odhad, ne měření. Body 1–10 za dvě věci: jak pomůže Googlu web zařadit a kolik přivede lidí. Celkové skóre je jejich průměr vážený tím, kolik práce to stojí.

| # | Kanál | Google | Lidé | Práce | **Skóre** | Proč |
|---|---|---|---|---|---|---|
| 5 | Měsíční přehled 2027 | 6 | 8 | 1 h/měsíc | **8** | Opakovaně přivádí rodiče a závodníky, ze skupin se sdílí dál. |
| 4 | Odpovědi na otázky | 5 | 7 | 10 min/týden | **7** | Odkaz přijde přesně ve chvíli, kdy ho někdo hledá; vlákna na fórech Google čte. |
| 6 | Známí a vlastní klub | 7 | 5 | 1 h jednou | **7** | Odkaz z klubového webu je pro Google nejrelevantnější, co bez oslovování dostanete. |
| 3 | Příběh na LinkedInu | 4 | 6 | 2 h jednou | **6** | Jednorázová vlna; může ji někdo převzít a napsat o ní. |
| 2 | Katalogy (AlternativeTo, Indie Hackers, Reddit) | 5 | 3 | 1 h jednou | **5** | Trvalé odkazy z webů, které Google prochází denně; málo cílových uživatelů. |
| 2b | Show HN / Product Hunt | 6 | 4 | 3 h jednou | **5** | Když se ujme, přinese odkazy z blogů; častěji se neujme. Pozor na CPU. |
| 1 | Vlastní profily (Strava, FB, …) | 3 | 2 | hotovo | **4** | Google díky nim pozná, že jde o značku; samy návštěvy nepřivedou. |
| 7 | Tip pro redakci | 8 | 6 | 1 h | **6** (na jaře 8) | Článek na cyklistickém webu je nejsilnější odkaz ze všech; teď je málo termínů 2027. |

**Kde začít:** 6 a 5 tento týden, 4 průběžně, 2 a 3 jednou o víkendu, 7 v březnu.

**Hotovo 16. 11.:** Strava klub a facebooková stránka; obě jsou propojené s webem (stránka O projektu a údaje pro vyhledávače), na web se to dostane s příštím nasazením.

## Sedm kanálů, ve kterých nikoho neotravujete

Seřazeno od nejjednoduššího. Nic z toho není studené oslovování: buď jde o vaše vlastní profily, o místa určená k představení projektů, o odpovědi na otázky, které někdo položil, nebo o lidi, které znáte.

### 1. Vlastní profily (jednorázově, asi hodina)

Na každém profilu vyplňte web a krátký popis z [TEXTY.md § 1](TEXTY.md#1-popisy-do-profilů).

- **Strava klub** „Let's Race – kalendář cyklozávodů“. Stránky klubů jsou veřejné a Google je prochází. Do klubu můžete jednou měsíčně dát příspěvek z kanálu 5.
- **Facebooková stránka** jen s vyplněným webem a popisem. Nemusíte na ni pravidelně psát.
- **Instagram** odkaz v profilu, pokud účet máte.
- **LinkedIn**: projekt do sekce *Doporučené* a web do kontaktních údajů.
- **Komoot** a **GitHub** profil, pokud je máte: web do profilu.

### 2. Místa, kam se projekty představují samy (jednorázově)

Na těchto webech se očekává, že autor svůj projekt přidá sám. Nikoho to neobtěžuje. Texty jsou v [TEXTY.md § 2](TEXTY.md#2-katalogy-a-místa-pro-představení-projektu).

| Kde | Jazyk | Poznámka |
|---|---|---|
| [AlternativeTo](https://alternativeto.net) | EN | Přidat jako aplikaci, kategorie Sports. |
| [Indie Hackers](https://www.indiehackers.com) | EN | Produkt plus krátký příspěvek o vzniku. |
| Reddit r/SideProject | EN | Příspěvek „I built…“. Tam je to přesně téma. |
| [Product Hunt](https://www.producthunt.com) | EN | Spuštění v úterý až čtvrtek. Hodí se na jaře, až bude víc termínů 2027. |
| Hacker News „Show HN“ | EN | Viz upozornění níže. |

**Pozor na Show HN a Product Hunt:** úspěšný příspěvek pošle tisíce lidí během hodin. Projděte si den po zveřejnění spotřebu CPU ve Vercelu. Pokud by hrozilo překročení, je to vaše rozhodnutí, ne důvod se vyhnout.

### 3. Váš vlastní příběh (jednou, pak občas)

Tohle je nejméně trapná forma propagace, protože nic nenabízíte, jen vyprávíte, co jste postavil a proč. Na LinkedInu a v technických komunitách to lidé čtou rádi a sdílejí dál.

- **LinkedIn příspěvek** v češtině: [TEXTY.md § 3](TEXTY.md#3-příspěvek-o-vzniku-linkedin). Doplňte jen to, co je pravda.
- **Delší článek** „Jak jsem postavil kalendář cyklozávodů pro 7 zemí“: osnova tamtéž. Zveřejnit na LinkedInu jako článek nebo na Mediu. Technický úhel (agent, který sám čte propozice) zajímá vývojáře; rodičovský úhel (hledali jsme závody pro děti) zajímá všechny ostatní.

### 4. Odpovídat, když se někdo ptá (průběžně, 10 minut týdně)

Lidé se ve skupinách a na fórech pravidelně ptají „kde najdu kalendář závodů“, „jaké závody pro osmileté dítě“, „nějaký gravel na jaře?“. Odpověď s odkazem je pomoc, ne reklama.

- Nastavte si **Google Alerts** (google.com/alerts) na: `"kalendář závodů" kolo`, `"dětské závody" kolo`, `"závody MTB" 2027`, `"gravel závod" 2027`.
- Sledujte fóra a skupiny, kde už jste: MTBS.cz fórum, facebookové skupiny, kde jste psal ke spuštění, a r/czech, r/cycling, r/MTB, r/gravelcycling.
- Odpovídejte jen na skutečnou otázku. Vždy napište, že web děláte vy. Nejdřív konkrétní odpověď (dva, tři závody), pak odkaz. Šablony: [TEXTY.md § 4](TEXTY.md#4-odpovědi-na-otázky).
- Ve stejné skupině nejvýš jedna odpověď s odkazem týdně.

### 5. Měsíční přehled „Co je nového v sezóně 2027“ (jednou měsíčně)

Pravidelný důvod se ozvat, který není reklama: užitečná informace s čísly. Pořadatelé právě zveřejňují termíny 2027, takže je každý měsíc co říct.

- Jeden krátký příspěvek měsíčně: Strava klub, facebookové skupiny, kde je to vítané, případně LinkedIn.
- První vydání je připravené s dnešními čísly: [TEXTY.md § 5](TEXTY.md#5-měsíční-přehled-listopad-2026). Další měsíce stačí obměnit čísla a vybrat 3–5 nových termínů.

### 6. Lidé, které znáte (jednou)

Napsat vlastnímu klubu, oddílu dětí, kamarádovi s blogem nebo trenérovi není spam. Kluby mívají stránku „Odkazy“ nebo „Kalendář“, kam se přehled hodí, a rodiče ve skupině klubu ho ocení. Text: [TEXTY.md § 6](TEXTY.md#6-zpráva-známým-a-vlastnímu-klubu).

Jen ti, s kým se opravdu znáte. Žádné „známé“ přes třetí osobu.

### 7. Redakce, až budete chtít (volitelné, později)

Cyklistické weby (MTBS.cz, RoadCycling.cz, Kolotipy) dostávají tipy na články běžně. Tip „kolik závodů už známe na rok 2027“ jim dává hotové téma. Není to oslovování pořadatelů a nemusíte to dělat hned. Až na jaře bude víc termínů 2027, jsou čísla zajímavější. Text: [TEXTY.md § 7](TEXTY.md#7-tip-pro-redakci-volitelné).

## Search Console: co udělat teď (15 minut)

1. **Stránky → Indexování stránek**: zapište si počet indexovaných a „Objeveno – neindexováno“. To je výchozí bod.
2. **Kontrola adresy URL** a „Požádat o indexování“ pro tyto čtyři adresy: `/cs`, `/cs/zavody/cesko-2027`, `/cs/zavody/mtb-cesko-2027`, `/cs/zavody/deti-2027`. Google denně povolí jen pár žádostí; víc adres nepřidávejte, nepomůže to.
3. **Soubory Sitemap**: ověřte, že `sitemap.xml` má stav „Úspěch“ a všechny tři podřízené soubory jsou načtené.
4. To samé jednou v **Seznam Webmaster** a **Bing Webmaster Tools** (oba ověřené).

Žádost o indexování ani odkazy nic nezaručují a Google neříká, kdy. První změnu čekejte v počtu *procházených* stránek, ne hned ve výsledcích hledání.

## Co nedělat

- **Nekupovat odkazy** ani „PR články“, nepřidávat web do katalogů odkazů a do výměn odkazů. Google za to umí web stáhnout níž a z nové domény se to špatně dostává.
- **Nepsat stejný text do mnoha skupin najednou.** Každý příspěvek přizpůsobte místu.
- **Neodpovídat na otázky, které se nekladly**, a nevkládat odkazy do komentářů pod cizí příspěvky.
- **Nezakládat falešné účty** ani nepsat „náhodou jsem našel skvělý web“.

## Jak poznat, že to funguje

Jednou týdně, do jednoduché tabulky:

| Kdy | Indexované stránky (Google) | Objeveno – neindexováno | Návštěvy z odkazů (Umami) | Nová místa s odkazem |
|---|---|---|---|---|
| 16. 11. | doplnit | doplnit | doplnit | 0 |

- **Po 2 týdnech** (profily, katalogy, příběh): mají být vidět návštěvy z LinkedInu, Redditu nebo Stravy. Pokud žádné nejsou, chyba je v textu, ne v kanálu.
- **Po 4–6 týdnech**: počet procházených a indexovaných stránek by měl růst. Pokud neroste, další krok je zmenšit sitemapu jen na přehledy a české závody (návrh je v [ROADMAP.md](../ROADMAP.md), B3).
- Nejdůležitější číslo není počet odkazů, ale jestli lidé, kteří přijdou, si uloží závod nebo kliknou na přihlášku.
