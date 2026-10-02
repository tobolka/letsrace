# Data z jazykového modelu: postup

*2. 10. 2026. Cíl: lepší data a víc závodů. Rozpočet: jednorázově do 15 $, provoz do 5 $ měsíčně.*

## Co se dnes ukázalo

- **Model umí číst.** Kalendář cyklokros.cz přečetl stejně jako ruční parser (26 z 26), plus 2 závody navíc. Za 2 centy. U ~80 zdrojů, které žádný parser nečetl, našel 53 závodů.
- **Model si vymýšlí.** Citace byla na stránce, ale hodnota z ní neplynula:
  - „M2 1997–2007 (19–29 let)“ → U13/U15,
  - „G-Cyclocross“ jako doklad kategorií,
  - stránka „harmonogram“ jako registrace,
  - stránka „ergebnisse“ jako propozice.
- Kontrola 183 zápisů z dnešních běhů: **115 obstálo, 68 má aspoň jedno pole podezřelé.** Nejvíc kategorie (43) a registrace (24).

## Zásada: model ukazuje, kód rozhoduje

Model nikdy nezapíše hodnotu. Vrátí jen **důkaz**: doslovnou citaci a odkaz, kde na stránce je. Hodnotu z důkazu odvodí náš kód, stejným způsobem pro každý závod:

| Pole | Co vrací model | Co z toho udělá kód |
|---|---|---|
| Kategorie | citace řádků s kategoriemi | věkové skupiny z textu citace (`age-bands`), nikdy z popisku modelu |
| Disciplína | citace | slovník slov (cyklokros, přespolní, Querfeldein, XCO…). Bez slova v citaci se nic nezapíše |
| Registrace / propozice | odkaz ze seznamu na stránce | jen když odkaz vede na registrační platformu nebo text odkazu zní „přihláška / Anmeldung / regulamin…“ a nejde o harmonogram či výsledky |
| Uzávěrka | citace s datem | datum musí být v citaci a citace musí mluvit o přihláškách |
| Závod z kalendáře | citace řádku | název i den musí být v citaci a odkaz musí být na stránce |

Část toho už je v kódu (dnes odpoledne). Zbytek je v kroku 1.

## Každý zápis s původem

Nová tabulka `event_facts`: závod, pole, hodnota, citace, URL, metoda (parser, model, člověk), model, čas. Do `events` se propisuje nejlepší fakt podle pořadí:

1. člověk,
2. oficiální zdroj,
3. model s důkazem,
4. agregátor,
5. odhad.

Díky tomu jde:
- kdykoli zjistit, odkud hodnota je, a ukázat to v detailu závodu („zdroj: propozice, str. 2“),
- vrátit jedním příkazem všechno, co zapsala jedna metoda nebo jedna verze promptu,
- měřit přesnost po metodách.

## Kontrola kvality, ne jen víra

1. **Zlatá sada:** 50 závodů napříč zeměmi, u kterých ručně ověříme správné hodnoty. Před každým hromadným během se na ní nová verze otestuje. Hromadný běh pustíme, jen když má každé pole **přesnost aspoň 95 %**. Stránky se uloží, takže opakovaný test stojí jen volání modelu (asi 0,25 $).
2. **Průběžný auditor:** každý den se 2 % nových zápisů znovu ověří silnějším modelem otázkou „podporuje tahle citace tuhle hodnotu?“. Když metoda u nějakého pole klesne pod 95 %, sama se vypne a ozve se.
3. **Nejisté případy do adminu**, ne do dat.

## Platit jen za změny

- U každé stránky se uloží otisk jejího textu. Model se volá jen na novou nebo změněnou stránku.
- Levný model (Haiku) hledá důkazy. Silnější (Sonnet) jen soudí, například duplicity, a to po dávkách.
- Každý běh má tvrdý strop. Denní provoz má strop 0,45 $, reálně kolem 0,10–0,20 $ denně.

## Víc závodů

- Obecná čtečka kalendářů přes model nahradí parsery dlouhého chvostu. Velké strukturované zdroje (FCI, ČSC, PZKol, cyclingaustria, odjazd, rideandrest) zůstávají na parserech, protože jsou levné a přesné.
- **Stínový režim:** u každého zdroje s parserem se jednou porovná výsledek parseru a modelu. Parser se vypne, až když model na tom zdroji vyjde stejně nebo lépe.
- Nové zdroje: odkazy na „kalendář / termíny / seriál“ ze stránek závodů a seriálů jdou do fronty kandidátů. Model řekne, jestli je to kalendář. Zařadí se jen ty, ze kterých projdou ověřené závody.

## Admin

Místo dnešních obrazovek dvě:
- **Fronta k rozhodnutí:** nejisté duplicity, rozpory (zdroj A říká X, zdroj B Y) a hodnoty pod hranicí jistoty. Vždy s citací a odkazem, rozhodnutí jedním klikem. Rozhodnutí se ukládá jako fakt od člověka a má přednost.
- **Zdraví dat:** pokrytí a přesnost po zemích a polích, stav zdrojů, útrata za den a měsíc.

## Kroky a cena

| Krok | Co | Cena |
|---|---|---|
| 0 | Hotovo dnes: model zastaven, přísnější ověřování v kódu, audit dnešních zápisů | 0 $ |
| 1 | Tabulka `event_facts`, odvození hodnot jen z důkazů, otisky stránek, vrácení 68 podezřelých zápisů | 0 $ |
| 2 | Zlatá sada 50 závodů a změření přesnosti. Ruční kontrolu sady udělám já, ty projdeš sporné | ~0,50 $ |
| 3 | Hromadné doplnění nadcházejících závodů, jen když krok 2 dá ≥ 95 % | ~3 $ |
| 4 | Duplicity silnějším modelem, nejisté do adminu | ~1 $ |
| 5 | Minulá sezóna kvůli přenosu do letošních ročníků | ~2 $ |
| 6 | Stínový režim parserů, nové zdroje | ~1–2 $ |
| 7 | Nový admin | 0 $ |
| Později | Program a tratě závodu: shrnutí z propozic s citacemi, až poběží kroky 1–3 | odhadem 2 $ jednorázově |

Celkem asi 9 $ k dnešním přibližně 3 $. Provoz pak 3–5 $ měsíčně.
