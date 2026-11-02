# Opravy po večerním review — 2. 11. 2026

## Zadání a výsledek

1. Úprava závodu: veřejné odkazy na formulář jsou již stažené. `ClaimRaceDialog` a jeho `RaceForm` nemají v aktuálním veřejném rozhraní volající komponentu. Obslužné cesty, administrátorská schránka a existující správa ověřeného pořadatele v účtu však zůstávají. Nejde o úplné odstranění serverového kódu; v tomto zásahu se znovu nezapíná ani nepřepisuje.
2. Schvalování návrhů: uživatel ponechal stranou. Dříve doložené nedostatky zapisovače a jednorázového schválení nejsou tímto zásahem opravené.
3. Elite: štítek sám již nedává věk 19+, ročníky narození ani `typicalAgeRange`. Nápověda odkazuje na věkové podmínky propozic. Doložené kategorie závodů zůstávají uložené.
4. Kola: číslo pochází z výslovného označení v názvu; chronologické pořadí se nevydává za číslo kola. Ročník se nerozděluje letní přestávkou. Zimní seriály používají ročník/sezónu a cyklokrosové datum. Pražský MTB pohár 25. 9. 2027 vychází jako 3. kolo, čtyři uvedená kola v kalendáři. Celkový počet se neprezentuje jako úplný oficiální kalendář. Při mezerách či nejmenovaných kolech se celkový počet vynechává.
5. Počasí: skutečné požadavky mají sdílené rezervace pro web, server i Mac, započítané i při pádu. Účtují se časové/parametrové násobky a u zálohy i načítané záznamy. Celé historické období se rezervuje najednou, nebo se nezačne načítat. Obě čtečky sdílejí konečný časový limit, při 429 se aktivuje společná pauza; při nedostupnosti rozpočtu se nevolá poskytovatel. Omezení se vykazuje jako odložení a dobré historické údaje se nemažou. Jedno místo zpracuje za průchod jedno chybějící období; ostatní zůstávají v práci.
6. Nadmořská výška a východ/západ slunce: odstraněné z detailu; dotaz na výšku se již neposílá. Převýšení jednotlivých závodních tras se nemaže — jde o jiný údaj.
7. Tooltip kola: výsledek patří ke konkrétnímu ID závodu a seriálu, jinak se okamžitě nepoužije. Starý požadavek se při přepnutí zruší; neúspěch nového nemůže ponechat číslo starého závodu.
8. Vzdálenosti: v obsahu i popisu pro vyhledávání se uvádí rozsah, např. „Vzdálenosti 69–138 km“. Počet tras ani konkrétní nejmladší věk se z pouhých vzdáleností a obecných štítků neodhaduje.

## Limity počasí

| Poskytovatel | Minuta | Hodina | 24 hodin | Měsíc |
|---|---:|---:|---:|---:|
| Open-Meteo, vážené jednotky | 500 | 4 500 | 9 000 | 270 000 |
| Visual Crossing, HTTP požadavky | 10 | 60 | 200 | 6 000 |
| Visual Crossing, načítané záznamy | — | — | 900 | 27 000 |

Historie nesmí spotřebovat více než 7 500 jednotek Open-Meteo nebo 700 záznamů Visual Crossing v denním okně; zbytek zůstává pro předpovědi. Minutové/hodinové/denní kontroly pokrývají klouzavá okna konzervativními minutovými součty. Měsíční kontrola používá kalendář UTC. Staré rezervace se uklízejí po 35 dnech, bez ztráty potřebných čítačů aktuálního měsíce.

Open-Meteo: interní stropy jsou nižší než zveřejněné limity [aktuálního bezplatného rozhraní](https://open-meteo.com/en/pricing); dlouhá období nebo více než deset veličin se nepočítají jako jeden požadavek. Záloha Visual Crossing má vlastní konzervativní stropy; nejsou tvrzením o garantované anonymní kvótě. Nezřizuje se placený plán ani klíč a měnové limity AI se nemění. Počítání nového provozu začíná aktivací těchto rezervací; dřívější skutečná spotřeba poskytovatele se nedá zpětně domýšlet.

## Ověření

- 1 405 testů ve 213 souborech prošlo, sestavení i kontrola stylu prošly.
- Regrese: skutečné termíny Pražského MTB poháru, zimní sezóna, chybějící a společná kola, přepnutí tooltipu, Elite v obsahu/SEO, stejné vzdálenosti více variant, chyba sítě, 429, nedostupný rozpočet a celkový čas obou poskytovatelů.
- Obě databázové migrace nasazené. Databázové zkoušky doložily společné rezervace, pauzu po 429, ponechanou kapacitu pro předpověď, minutový limit, úplné vrácení neúspěšné dávkové rezervace a soukromé přístupy. Zkušební zápisy byly vrácené transakcí, katalog závodů se při nich neměnil.
- Nové tabulky jsou pod RLS, bez oprávnění anonymního ani přihlášeného klienta; funkce smí volat pouze serverová role. Kontrola Supabase hlásí u nových tabulek jen očekávanou absenci veřejných politik. Stávající upozornění na PostGIS a nastavení účtu nejsou touto změnou opravovaná.
- Nasazení a veřejné ověření se doplní po vydání; samotný lokální test není důkazem změny na webu.

Návrat: předchozí verze webu je samostatný commit. Přídavné soukromé účetnictví lze ponechat; nedestruktivní migrace nemění existující závody ani uloženou historii počasí.
