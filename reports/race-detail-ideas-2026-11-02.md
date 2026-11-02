# Co dalšího na detail závodu (2. 11. 2026)

Nápady, pro které už data máme nebo je spočítáme zadarmo. Seřazeno podle toho, kolik dají jezdcům a rodičům a kolik unikátního obsahu přidají stránce pro Google a AI vyhledávače.

Data z produkce: 1 346 nadcházejících závodů, 830 (62 %) s potvrzenými věkovými kategoriemi, 768 sdílí web s jiným závodem, 274 vícedenních, 79 s uzávěrkou přihlášek, 13 s výsledky.

## 1. Ročníky narození místo „U11" (nejsilnější)

**Co:** U závodu s kategoriemi ukázat, pro které **ročníky narození** je: „U11 · ročníky 2016–2017", „Junioři · 2009–2010". Rodiče hledají „závod pro děti ročník 2016", ne „U11".
**Data:** věkové kategorie (62 % závodů) + rok sezóny → ročníky se spočítají. Pravidla UCI/svazů (U11 = 9–10 let v roce závodu) jsou jednoznačná.
**SEO:** unikátní text na každé stránce, přesně v jazyce dotazů; navíc `typicalAgeRange` / `audience.suggestedMinAge` ve strukturovaných datech (vlastnosti schema.org; Google je v návodu pro Event neuvádí, ale čtou je jiné vyhledávače a AI).
**Navazuje:** u přihlášeného rodiče s dětmi v profilu „Ema (2016) pojede U11" – zatím jen 3 jezdci s ročníkem, takže až později.

## 2. „Krátce o závodě" – odpovědi na otázky

**Co:** Blok 4–6 krátkých odpovědí z dat: Kdy a kde? Kdo může startovat? Jaké jsou trasy? Kdy končí přihlášky? Je to kolo seriálu? Jaké bývá počasí?
**Data:** vše už máme (termín, místo, kategorie, trasy, uzávěrka, kolo seriálu, počasí).
**SEO:** AI Overviews, ChatGPT a Perplexity citují krátké věcné odpovědi; Google FAQ rich results už nedává, ale jako obsah to pomáhá. Pozor: žádný vatový text, jen věty z dat.

## 3. Další závody stejného pořadatele

**Co:** „Pořadatel pořádá i…" – závody se stejným webem pořadatele (mimo agregátory jako sumator.cz nebo maraton.cz).
**Data:** 768 závodů sdílí web s jiným závodem; vyřadit hostitele, které máme jako kalendáře (`event_sources.kind = aggregator`).
**SEO:** silné interní prolinkování mezi příbuznými stránkami; pro jezdce „kde dalšího tenhle klub pořádá".

## 4. Východ a západ slunce, nadmořská výška startu

**Co:** „Slunce vychází 7:02, zapadá 16:24" (cyklokros v listopadu, maratony, brevety) a „Start ve 640 m n. m.".
**Data:** východ/západ se spočítá z polohy a data bez jakéhokoli API; výšku vrátí Open-Meteo (už ho voláme, odpověď výšku obsahuje) – uložit k místu.
**SEO:** malý, ale unikátní fakt na každé stránce.

## 5. Prázdniny a svátky

**Co:** „Termín je ve státní svátek / v podzimních prázdninách / v prodlouženém víkendu" – pro rodiny a cestování za závody.
**Data:** státní svátky všech zemí (statický seznam nebo Nager.Date), české školní prázdniny (MŠMT, statická tabulka podle okresů).
**SEO:** unikátní kontext; dotazy typu „závody o prázdninách".

## 6. Shrnutí tras v hlavičce

**Co:** „3 trasy 70–210 km" hned pod názvem, „nejmladší kategorie od 6 let".
**Data:** trasy a kategorie (20 % závodů má délky), věky (62 %).
**SEO:** do meta description – lepší proklik z výsledků vyhledávání.

## 7. Odpočet a uzávěrka

**Co:** „Za 12 dní" a „Přihlášky končí za 5 dní" (jen kde je uzávěrka, 79 závodů).
**Data:** máme.
**SEO:** neutrální, pro jezdce užitečné; zvyšuje návratnost.

## 8. Přidat do kalendáře

**Co:** Tlačítko „Přidat do Google/Apple kalendáře" pro jeden závod (.ics už generujeme pro plán).
**Data:** nic nového.
**SEO:** neutrální; konverze a návratnost.

## 9. Kontext víkendu

**Co:** „Ten víkend v Česku: 14 závodů, z toho 5 cyklokrosů" s odkazem na kolekci „tento víkend".
**Data:** máme.
**SEO:** prolinkování na kolekce, které cílí na časté dotazy („závody tento víkend").

## Strukturovaná data navíc (rychlé)

- `typicalAgeRange` a `audience` (PeopleAudience, `suggestedMinAge`/`suggestedMaxAge`) z věkových kategorií.
- `superEvent` už máme; doplnit `position` kola v seriálu.
- `previousStartDate` u přesunutých závodů (Google ho doporučuje).

## Co zatím ne

- Sociální důkaz („12 lidí má závod v plánu"): dnes jen 22 účastí celkem – bylo by to spíš prázdné.
- Výsledky předchozích ročníků: odkaz má jen 13 závodů.
- Dojezd autem: odloženo (potřeba routovací klíč).

## Doporučené pořadí

1 → 6 → 4 → 3 → 2 → 9 → 5 → 7 → 8. První tři kroky jsou jen výpočty z dat, bez nových zdrojů.
