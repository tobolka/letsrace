# Podněty od race-finderu, 12. 11. 2026

Pět věcí, které agent nahlásil po delším běhu nad frontou (78 odpovědí za den). U každé: co jsem zjistil, co jsem opravil a co zůstává.

## 1. Nocny Rajd Rowerowy: chybné „různé akce“

- **Do katalogu se nic nepromítlo.** Odpovědi `pair-e947b759` a `pair-d898d230` ještě neprošly ověřením a ty tři položky (Wągrowiec, Czerwonak, Murowana Goślina) jsou jen v kopii na Macu, vedené jako vyjížďky. Na server neodešly.
- Obě odpovědi jsem opravil na „nevím“ s poznámkou a původním verdiktem v poli `corrected`.
- **Příčina ve frontě:** dvojice se skládaly i z vyjížděk. Teď se dvojice staví jen ze závodů (ne `ride`, ne skryté, ne názvy jako rajd, brevet, RTF).
- **Zadání:** agent má výslovně napsáno, že jedna akce s několika startovními místy a společným cílem je jedna akce, a že má před rozhodnutím přečíst propozice.

## 2. Kolo pro život: „Partneři závodu“ a datum 1. 5. 2026

- **Není to nový import.** Sedm položek vzniklo 13. 8. 2026 starým obecným čtením stránek `kolopro.cz/zavody`, které bralo nadpisy jako závody a nemělo datum. Zdroje kolopro jsou dnes pozastavené.
- Skutečné závody série (Beroun, Mladá Boleslav, Oderská mlýnice…) mají správná data z jiných zdrojů. Datum 1. 5. nesou jen ty zbytky.
- Do fronty se dostaly, protože měly stav „skryto“, ale viditelnost „veřejné“. Sedm jsem jich skryl úplně.
- **Pravidlo:** názvy „Partneři závodu …“, „Partnerská akce - …“ a název končící „Proběhl“ se nepovažují za závod (`isNonRaceEventName`, s testem na těchto stránkách). Fronta termínů takové názvy přeskakuje.
- Zůstává 8 skutečných závodů se stavem „skryto“ a viditelností „veřejné“ (například VC Losiny, XCO ŠKODALAND). Nesahal jsem na ně: někdo je skryl stavem a nevím proč.

## 3. Nesoutěžní akce v katalogu

- Fronta propozic teď položku, která je vedená jako vyjížďka nebo se tak jmenuje (brevet, BRM, RTF, CTF, rajd, randonnée…), nejdřív pošle jako otázku „vyjížďka, nebo závod“. Propozice se hledají jen pro závody.
- Název to neřekne vždy (Antoniana Gravel). Proto může agent při hledání propozic odpovědět „není to závod“ s citací stránky.
- Časovaný maraton a gran fondo podle názvu za vyjížďku nepovažujeme (test `pipeline2-rides.test.ts`: Bikemaraton Drásal, UCI Gran Fondo Burgenland, Schleizer Dreieck Jedermann zůstávají).
- **Co se s výsledkem stane:** ověřené vyjížďky se ukládají do seznamu `agent/rides.json`. Z katalogu se zatím samy neskrývají.

## 4. Čtečky

| Zdroj | Co je pravda | Co jsem udělal |
| --- | --- | --- |
| ČSC | Čtečka funguje (poslední čtení 12. 11., přes Chrome). Agent stránku nenačte, protože ji kreslí skript v prohlížeči. | Portál ČSC se agentovi už nezadává. |
| Sumator | 33 adres `sumator.cz/cup/<série>-2027` je odvozených z roku a **neexistují** (HTTP 404). Vedly se jako „mimo sezónu“ a četly se každé dva dny. | Stránka, která neexistuje, se tak zapíše (`page does not exist`) a zkouší se jednou týdně. Agentovi se nezadává. |
| Swiss Cycling | Kalendář ukazuje jeden rok. Rok 2027 je pod `y=2027` a čtečka se na něj neptala, takže celý podzim viděla prázdnou tabulku. | Čtečka od září čte i příští rok. Naživo: 21 závodů 2027 včetně pěti kol CKW-Cupu, které agent našel. |

Porovnání s katalogem napříč zdroji dělá stávající kontrola totožnosti při zápisu; agentovi se k porovnání dává jen seznam závodů z téhož zdroje, proto u Swiss Cycling viděl „nemáme nic“.

## 5. Brianza a Monastir

- **Monastir, VI Trofeo Ciclocross Santa Lucia:** stránka svazu teď uvádí 20. 12. 2026, my jsme měli 13. 12. Opraveno přes `apply-reviewed-fixes.ts` (soubor `fixes.json` vedle).
- **Brianza Gravel Ice Edition:** pořadatel uvádí Cassago Brianza, my máme Inverigo z kalendáře, který to převzal odjinud. **Neopraveno:** změnu místa u existujícího závodu žádný nástroj neumí. Kalendář ji navíc vede jako „gravel cicloturistica“, takže půjde nejdřív otázkou „vyjížďka, nebo závod“.
- **Změna ve zdroji existující záznam neaktualizuje.** Přesunutý termín se zadrží a nikdo ho nerozhodne. Čtečka italského svazu teď aspoň rozdíl pozná a zapíše ho do `federation-date-differences.json`; samotná oprava je dál ruční. Tohle je díra, kterou má zavřít převod změn existujících závodů přes bránu.

## Co nebylo ověřeno

- Nová pravidla fronty se projeví až při dalším sestavení případů (do 6 hodin).
- Oprava stavu u neexistujících stránek Sumatoru se projeví při jejich dalším čtení.
- 76 zbylých dnešních odpovědí agenta jsem nečetl; projdou ověřením citací při dalším běhu.
