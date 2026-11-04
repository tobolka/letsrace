# LetsRace — rozpracovaná práce z 2. listopadu 2026

**Historický záznam z 2. listopadu.** Aktuální úkoly, pořadí a stav jsou ve [společném seznamu priorit](operations-progress.md).

## Stav zaznamenaný 2. a 3. listopadu

| Priorita | Práce | Stav a další konkrétní krok |
|---|---|---|
| Teď | JBC 4X Revelations 2027 | Hotovo: ID `4a99a311-023a-4b88-8a78-ad8e954eb926`, termín UCI, 4X, obě Elite kategorie, areál, veřejný detail a společný seznam. Dětský program a registrace 2027 zatím nepotvrzené. |
| Teď | Road Stage Orlické hory 2027 | Hotovo: původní ID a registrace zachované; Deštné, správné souřadnice a kraj, oprava čtení JSON-LD i ochranný zámek. Detail, hledání i společný seznam opravené. |
| Potom | Dávka nových českých závodů 2027 z přílohy | Zpracováno ve vydání `d398a611` a navazujících opravách; inventura 3. listopadu našla požadované hlavní záznamy. [Výsledek importu](../reports/cz-2027-import-2026-10-31/REPORT.md). Lost Ride zůstává skrytý provizorní záznam, Oremon rekreační jízda; znovu nevytvářet stejné závody. |
| Pokračuje | Společná pipeline, schránka rozhodnutí a jednoduché ovládání | Zůstávají všechny původní etapy 0–6; konkrétní stav v [operations-progress.md](operations-progress.md). Jednoduchý přehled nasazený (`d5b8bd67`) a ověřený po přihlášení. Společná dávka seznamu/mapy nasazená (`ec8c8441`), první veřejná kontrola prošla pro 1 006 závodů. Automatické provádění rozhodnutí zbývá. |
| Pokračuje | Automatické doplňování historie počasí | Uložiště, denní serverový běh a bezplatná záloha nasazené; celé úvodní naplnění katalogu není dokončené. Limity a poslední dobrá data se zachovávají. |

Kompletní příloha pro pozdější import: [referenční seznam závodů](requests/2026-11-02-czech-races-import-reference.md). Je to podklad k ověření a provedení; číslo kandidátů v příloze není důkazem počtu nových závodů v katalogu.

## Co z dnešního zadání už žije na webu

- Čtení a předávání podrobných kategorií a doslovných popisů; nevydávat historické podrobnosti za potvrzené nové údaje.
- Společné párování ročníků pro doplňování i odkazy v detailu. Ročníky zůstávají samostatné; nejde o nový systém slučování různých závodů.
- Bezpečné společné uložení úprav pořadatele, ochranných zámků, historie a požadavku na zveřejnění. Odebraný přístup se neobnoví opětovnou žádostí.
- Označení „Spravuje pořadatel“ místo automatického tvrzení o ověření všech údajů. Návrh budoucích nastavitelných ověřovacích statusů uživatel odložil.
- Oprava neúplné sitemap a nežádoucího odhadu přesměrování známých skrytých adres. Potvrzená sloučení mají vlastní cestu.
- Počasí: trvalá historie na serveru, předpověď s půlhodinovou platností, čas načtení, viditelný zdroj, výpadky a automatické opakování. Visual Crossing funguje anonymně; nevznikl placený plán ani nový účet.
- Čtečka na Macu aktualizovaná; doložené odložení práce se nevydává za technickou poruchu.

Důkazy, provedené změny a omezení: [výsledek poslední sady oprav](../reports/detail-pipeline-2026-11-02/RESULT.md). Veřejná verze této sady: `54ecbc42`.

## Původní zadání, které stále platí

1. Minimum ruční správy: jeden přehled a pouze skutečné otázky pro vlastníka; technické nástroje zůstávají opravitelné a dohledatelné.
2. Přehledně odlišit hledání nových zdrojů, hledání závodů ve známých zdrojích, doplňování existujících závodů a řešení rozporů/duplicit.
3. Jedna trvalá práce se zámky, opakováním a rozdělením mezi server a Mac; výpadek nesmí ztratit práci.
4. Každý údaj má původ, stáří a pravidla přepisu; respektovat ruční zámky a finanční limity. AI sama není zdroj pravdy.
5. Duplicity řešit před importem i po něm, zachovat adresy, vazby a plány; nejasnosti neslučovat odhadem.
6. Další ročníky stavět na ověřeném předchozím závodu. Nové datum vyžaduje výslovný nový rok, ne výpočet z minulého ročníku.
7. Nové příležitosti pro SEO a více užitečných údajů v detailu. Nezahajovat ostatní nápady z nezávislého auditu mimo duplicity a SEO.
8. Dokončit práci na promptu a postupu hledání nových závodů; měřit skutečně nové a správné závody, ne jen načtené stránky nebo zápisy.
9. Nezávisle doložit správnost, pokrytí, chybná sloučení, cenu a čas vlastníka. Testy kódu a nasazení toto měření nenahrazují.

## Požadavky na budoucí hlášení

Uvádět odděleně lokální změnu, uložení do databáze, nasazení, veřejné ověření a zbývající práci. Nevymýšlet časové odhady, nové počty ani úspěšné importy bez skutečného zápisu a kontroly. Nežádat vlastníka, aby ručně řešil technickou chybu, kterou může opravit systém.

## Následná kontrola večerních změn

[Konkrétní review 26 nových commitů](../reports/review-2026-11-02-evening/REVIEW.md): neatomické admin úpravy, souběžné/stárnoucí návrhy, nepodložené věky, odhad pořadí kol, skutečný rozpočet a čas historie počasí. Následné opravy Elite, kol, skutečných limitů počasí, tooltipu a rozsahu vzdáleností jsou nasazené a veřejně ověřené (`32dbeb4c`); výška a časy slunce byly odstraněné. Zapisovač úprav a schvalování návrhů zůstávají stranou, veřejný formulář je stažený. Odkazy „Další ročníky“ již jsou nasazené a ověřené v obou směrech; žádné nové datum tím nevzniká.

Podrobný výsledek následných oprav: [opravy po večerním review](../reports/review-fixes-2026-11-02/RESULT.md). Původní etapy pipeline ani velký seznam dalších závodů tím nejsou označené za dokončené.

## Pokračování po nasazení adminu

- [Obnova čtení Chotěbuze, Eventiv a ochrana známých údajů](../reports/source-recovery-2026-11-02/RESULT.md). Chotěbuz skutečně zpracovaná; Eventiv stále vyžaduje přístup na straně poskytovatele, nevydává se za úspěšný prázdný kalendář.
- Další práce: inventura všech položek dodaného seznamu závodů proti aktuální databázi, doplnění skutečně chybějících doložených závodů a nezávislá kontrolní sada.
- Navazující SEO návrh je uložený v [seo-next-steps-2026-11-02.md](seo-next-steps-2026-11-02.md); návrhy vstupních stránek nejsou označené jako implementované. Zůstává nutná kvalita podkladů a kontrola skutečného indexování.

Aktuální úkoly k datům a SEO jsou ve [společném seznamu priorit](operations-progress.md).
