# Hledání správných propozic · 5.–6. 11. 2026

Měřeno bez AI na náhodných 150 budoucích závodech z 1 220. „Dokument“ znamená, že zmiňuje tento ročník a obsahuje údaj daného druhu; je to rychlý odhad podle znaků v textu, ne ověření správnosti.

| Závody s dokumentem | Dřívější čtení | Nové čtení |
| --- | --- | --- |
| s jakýmikoli údaji tohoto ročníku | 63 % | 66 % |
| se startovným | 23 % | 29 % |
| s programem | 49 % | 56 % |
| se vzdáleností | 43 % | 41 % |

Pokles u vzdálenosti vzniká hlavně tím, že čtení končí, jakmile najde kompletní dokument, a nečte zbytečné stránky. Přínos je skromný a chyby se u čísel jednotlivých závodů mohou projevit.

## Proč zbytek chybí
- **Nejčastěji jsou to závody 2027, jejichž propozice ještě nevyšly** (123 ze 150 závodů vzorku je 2027). Mezi přečtenými dokumenty bez startovného bylo 75 z minulého ročníku. To žádné hledání nespraví; přijde to, až je pořadatelé vydají.
- **Web závodu je ve skutečnosti kalendář.** Nejčastější je odjazd.pl (141 závodů z 1 220). Odkaz na pořadatele je tam za přihlášením, ten neobcházím a účet nezakládám. Pomohlo by ho najít jinak (`find-websites`, vlastní čtení).
- **Ochrana proti robotům a stránky vyžadující JavaScript:** dostartu.pl, ultrabikers.eu, racearoundaustria.at, rsg-nordhei.de. Zatím neřešeno; na Macu je Chrome, takže zkouška čtení přes něj je možná.
- **OneDrive:** dokumenty dsergebnis na 1drv.ms se bez přihlášení stáhnout nedaly, kód jsem nenechal.

## Co se změnilo
- Odkazy se řadí podle slov v adrese i v textu odkazu. Přeskakují se stanovy, přihlášky do klubu, výsledky, galerie a dokumenty jen z minulých let.
- Z kalendáře přejde čtení na web pořadatele, když jeho adresa obsahuje jméno závodu, odkaz se tak výslovně jmenuje, nebo jde o známý agregátor. Nikdy na sociální sítě, rezervace a reklamní odkazy.
- Plakát zobrazený jen jako obrázek se přečte přes OCR.
- Až 8 přečtených adres na závod místo 5. Čtení končí u prvního kompletního dokumentu.
- **Model se nevolá, když žádný dokument nemá údaje tohoto ročníku.** Zkušební dávka 30 závodů stála 0,047 USD místo asi 0,10 USD.

## Zapojení
Krok „Čtu propozice“ běží v cyklu Macu po 6 hodinách, nejvýš 30 závodů a 8 minut. AI klíč dostane jen tento krok a platí sdílené limity 0,15 / 0,50 / 5 USD. Na server jde v rámci dosavadního limitu 60 závodů denně. Části údajů (místo, pořadatel, program, startovné, trasy) se doplňují zvlášť, jen kde jsou prázdné na Macu v kopii i na serveru a nejsou uzamčené.

## Zkušební dávka před nasazením
30 závodů v pořadí, v jakém je vezme cyklus: 15 s údaji (13× místo, 11× pořadatel, 9× program, 9× startovné, 4× trasy). Prošel jsem je a zjevnou chybu nenašel, proti dokumentům jsem ale nekontroloval každý řádek.
