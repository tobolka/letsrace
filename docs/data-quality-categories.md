# Kategorie závodů: stav dat a jak je zlepšit

*Stav k 30. 9. 2026*

## Co jsme zjistili

- Za příštích 180 dní je 862 veřejných závodů. **320 z nich (37 %) nemá kategorie vůbec.**
- Na domácím trhu je to nejhorší: **v Česku 69 % závodů bez kategorií** (75 ze 109). Portál ČSC 29 z 35, radsport-events.de 78 ze 188, odjazd.pl 30 z 51.
- Z 5 430 závodů, které kategorie mají, je **jen 1 843 (34 %) ze zdroje**:
  - 670 z tokenu v názvu („Dětský pohár“, „U11“),
  - 1 173 ze seznamu kategorií na stránce závodu.

  Zbylých **3 587 (66 %) je odhad**: 3 507 z výchozího pravidla podle disciplíny (gravel, silnice, maraton → „amatéři, masters“) a 80 převzatých ze seriálu.
- Dřív se odhad ukládal stejně jako fakt, takže filtr podle něj závody vyřazoval. Navíc databázový dotaz nepočítal s kategoriemi převzatými ze seriálu.

## Co je hotové (tento commit)

1. **Původ kategorií** se ukládá do nového sloupce `events.age_confidence`: `explicit` (ze zdroje), `default` (odhad), prázdné (nevíme). U všech 5 430 závodů je doplněný (`scripts/backfill-age-confidence.ts`). Watcher i doplňovací úlohy ho při každém zápisu nastavují. Odhad už nikdy nerozšíří ani nepřepíše kategorie, které uvedl zdroj.
2. **Filtr hledá, nezahazuje.** Závod skryje jen tehdy, když pořadatel kategorie uvedl a zvolená mezi nimi není. Všechno nejisté zůstane v seznamu s označením „Kategorie neověřené“ a řazení je:
   1. potvrzené,
   2. odhad sedí,
   3. nevíme,
   4. odhad říká něco jiného.

   Přepínač **„Jen ověřené“** v menu Kategorie vrátí přísný režim.
3. **Detail závodu** u odhadnutých kategorií píše „odhad“ a štítky mají čárkovaný rámeček.

Příklad z tohoto víkendu (Praha a okolí do 130 km, Děti a mládež): dřív 1 závod, teď 9, z toho 1 potvrzený.

## Mechanismy, jak data zlepšit

Seřazené podle poměru přínos / práce.

### 1. Kategorie přímo ze zdrojů (největší přínos, jde o práci na extraktorech)

- **Portál ČSC:** detail závodu je aplikace v Blazoru. Stávající `csc-render.ts` umí stránku vykreslit, stačí z detailu přečíst seznam kategorií. Pokryje většinu českých oficiálních závodů.
- **Registrační systémy:** sportsoft (`csc.sportsoft.cz/startreg`), RaceResult (už částečně přes `raceresult-ages.ts`), dostartu.pl, odjazd.pl. Přihláška vždy obsahuje kategorie, takže jde o nejspolehlivější zdroj.
- **radsport-events.de:** detail akce má pole *Klassen*.

### 2. Čtení propozic jazykovým modelem

Většina pořadatelů má kategorie v propozicích (PDF nebo web), které už máme v `regulations_url` a `website_url`. Noční úloha by pro nadcházející závody bez kategorií ze zdroje:
- stáhla propozice,
- nechala model vrátit kategorie **i s doslovnou citací**,
- uložila je jako `explicit`, jen když citace v dokumentu opravdu je; jinak nechá závod beze změny.

Náklady jsou jednotky korun za stovky závodů. Pokryje i malé místní závody, které nemají žádný strukturovaný zdroj.

### 3. Potvrzení od uživatelů

V detailu závodu s neověřenými kategoriemi otázka „Pojede tu Jonáš (U11)? Mají děti svou kategorii?“ s odpověďmi *Ano / Ne / Nevím*. Tři shodné odpovědi, nebo jedna od pořadatele, kategorie potvrdí. Zároveň je to přirozený důvod se přihlásit.

### 4. Kategorie po seriálech

Rozšířit spolehlivé kategorie seriálu na všechna jeho kola. Když má Dětský MTB Cup ve 3 kolech potvrzené U9–U13, platí to i pro zbylá kola, jako `explicit` se zdrojem „seriál“. Dnes se ze seriálu kopíruje jen odhad.

### 5. Kontrolní fronta v adminu

Stránka „Kategorie k ověření“: nadcházející závody bez ověřených kategorií, seřazené podle toho, kolik lidí si je prohlíží nebo ukládá do plánu. U každého odkaz na propozice a rychlá volba kategorií jedním klikem (uloží `explicit`). Deset minut týdně pokryje závody, které lidi opravdu zajímají.

### 6. Měření

Do přehledu kvality dat v adminu přidat podíl `explicit` / `default` / prázdné pro každý zdroj a zemi a sledovat, jestli roste.

## Další chyby, které vyplavalo hledání závodu na tento víkend

- **„#02 – Hannover“** je v datech jako Česko, 74 km od Prahy. Místo je zjevně špatně geokódované (STEVENS Cup je německý seriál).
- **„Cyklokros, MTB a parta na kole — Cykloklub Chýnov“** má jako obec „Cyklokros“. Pravděpodobně jde o duplicitu JANEV CUP Chýnov ze stejného dne.
- **Ostrov – PARKBIKE OSTROV** nemá disciplínu.
