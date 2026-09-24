# Kontrola kvality katalogu závodů — 24. 9. 2026

Stav byl ověřen v produkční databázi Supabase. Počty jsou okamžitý snímek po opravách 24. 9. 2026, nikoli trvalá garance správnosti každého závodu. Reprodukovatelný výpis: `scripts/audit-catalog-integrity.ts` a `scripts/audit-data-quality.ts`.

## Pokrytí a viditelnost

| Metrika | Počet | Význam |
| --- | ---: | --- |
| Všechny záznamy závodů | 8 158 | Včetně minulosti a skrytých položek. |
| Budoucí nesloučené položky | 2 283 | Kandidáti pro veřejný kalendář. |
| Veřejné budoucí položky | 1 374 | 988 v roce 2026, 386 v roce 2027. |
| Skryté budoucí položky | 909 | Z toho 404 v zemích, které katalog nabízí. |
| Veřejné budoucí položky bez místa | 109 | Nelze je zobrazit v běžném výpisu. Část názvů je nekvalitní, neodemykat hromadně. |
| Veřejné položky ze zemí mimo podporovaný výpis | 223 | Záměrné geografické omezení; není to chyba scanu. |
| Veřejné budoucí položky bez disciplíny | 27 | Vyžadují individuální kontrolu zdroje. |
| Veřejné budoucí položky bez věkové kategorie | 368 | Prázdná hodnota je lepší než vymyšlená kategorie. |

Výpis `listEvents()` měl limit 800/1 000 řádků a zahazoval pozdější závody. Upravený výpis používá stabilní stránkování. Po opravách vrátil 1 039 položek bez data od a 261 při filtru od 1. 1. 2027. Rozdíl mezi 1 374 veřejnými a 1 039 ve výpisu tvoří zejména 222 zemí mimo veřejný rozsah, 109 položek bez místa a několik záznamů se stavem nebo názvem nevhodným pro výpis.

## Zdroje a scany

- Aktivních sledovaných adres je 438. Žádná nemá termín dalšího scanu prošlý o více než 24 hodin; 120 jich je prošlých o více než hodinu. Třináct zatím nebylo načteno, z toho tři přibyly v dnešním hledání. Pět adres je stále v chybě, převážně stránky jedné nedostupné série.
- V databázi není žádný `ingest_run` otevřený déle než 30 minut. Šedesát historicky opuštěných běhů bylo uzavřeno se skutečným neúspěšným stavem; serverový watcher teď totéž dělá automaticky.
- Kalendář Českého svazu cyklistiky vyžaduje Chrome na lokálním Macu. Při ručním běhu dal 408 položek a při ověření týdenního `launchd` běhu znovu 408. Plánovaná úloha skončila s kódem 0 a zapisuje log do `~/Library/Logs/letsrace-csc.log`. Je závislá na dostupnosti tohoto Macu.
- Serverový watcher už nebude tento zdroj označovat jako chybný jen proto, že na Vercelu není prohlížeč.
- Zdroj Mazury MTB padal na neplatném datu `2026-27-09`; po opravě čtečky proběhl bez chyby a nepřidal žádný vymyšlený závod. Maraton.cz při serverovém běhu odpověděl HTTP 502, při lokálním opakování přečetl devět položek.

## Duplicity, série, věk

- Audit nenašel kolizi přesného fingerprintu budoucích veřejných závodů. Dřívější audit našel 17 dvojic se shodným názvem a datem, všechny v minulosti; bez kontroly místa a pořadatele nejde tvrdit, že jde o duplicity.
- U 74 veřejných položek se uložená úroveň liší od výrazného signálu v názvu či sérii; u 164 položek se uložený věk liší od výslovně uvedené kategorie. Jde o seznam k ověření, protože i samotný klasifikátor může chybovat.
- Primární členství v sériích je konzistentní: žádné chybějící, rozdílné ani osiřelé vazby. Osm chybných sekundárních vazeb na duplicitní sérii Světového poháru v cyklokrosu bylo odstraněno. Zbývá 25 vazeb veřejných závodů na jiné skryté série k individuální revizi.
- Dvě veřejné položky pro cyklokros v Kukli 26. 9. měly stejné souřadnice. Agregátorový název `Kukelský cyklokros` byl sloučen pod oficiálně doložený závod `Galaxy Cyklošvec cyklokros Kukle` v TBC sérii.
- Sloučené jsou také český a oficiální záznam Světového poháru v Zonhovenu a dva názvy téže kopcovité etapy L'Etape Czech Republic. Audit nyní eviduje 57 skupin veřejných akcí se stejným dnem a přibližnými souřadnicemi. Řada z nich jsou legitimní různé formáty či kategorie; ostatní vyžadují kontrolu oficiálního zdroje.
- Dvanáct kol Světového poháru v cyklokrosu 2026/27 má věkové kategorie srovnané podle [oficiálního kalendáře UCI](https://www.uci.org/pressrelease/the-uci-decides-to-consult-professional-road-cycling-stakeholders-in-order/2Rtpt5zAFeCMkSREw55k8O). Dvě neplatná obecná data zůstávají skrytá.
- Italský FCI zdroj znovu používá ID detailu: `/race/detail/181984` je nyní [6° TROFEO COLACEM](https://members.federciclismo.it/race/detail/181984) 3. 10. 2026, ale ve starším skrytém záznamu ukazuje na jiný závod 26. 9. 2026. Proto nelze 313 skrytých italských položek bezpečně hromadně zveřejnit.
- Stránka `RoadCup 2027` má nadpis s rokem 2027, ale úvodní text mluví o ročníku 2026 a vypisuje více závodů. Obecná čtečka z ní vytvořila falešný jediný závod; záznamy `RoadCup 2026` a `RoadCup 2027` jsou nyní skryté a čtečka už sezónní přehled nevydává za závod.
- Agregátor uvádí `BSK Giro Pičín (připravuje se)` na 20. 6. 2027. Termín je nyní veden jako nepotvrzený a skrytý, dokud ho nedoloží pořadatel.

## Rok 2027

V databázi už je 386 veřejných závodů v roce 2027. Existuje 56 aktivních adres výslovně zmiňujících 2027, ale 47 je označeno jako mimo sezónu, sedm ještě nebylo načteno, jedna má chybu a jedna vyžaduje revizi. Samotný počet adres proto nedokazuje úspěšný sběr.

Hledač nových závodních webů měl dotazy pouze na aktuální rok. Nově v každém běhu hledá také následující rok. Ověřovací běh 24. 9. poslal tři dotazy na 2027, našel 14 kandidátních adres, devět uložil k posouzení a tři začal sledovat. To zatím nepotvrzuje tři nové závody pro 2027. Italský FCI procházel při denním cronu opakovaně stejné měsíce; opravená rotace pokryje všech 16 měsíců od aktuálního měsíce, tedy nyní až do prosince 2027.

## Otevřená práce

1. Ověřit 109 veřejných položek bez místa, 74 rozdílů v úrovni, 164 rozdílů ve věku a zbývající chybějící disciplíny a věky proti jejich zdrojům; zjevné chybné názvy skrýt nebo opravit.
2. Italské FCI závody zpřístupňovat jen po kontrole aktuálního detailu, data a názvu; stará URL mohou ukazovat na novou akci.
3. Prověřit 25 vazeb na skryté série, 17 historických dvojic se stejným názvem a datem a 57 skupin budoucích akcí se stejným místem a dnem.
4. Sledovat výtěžnost 2027 dotazů a stav nově přidaných zdrojů; přidávat pouze ověřené závody.

Změny databáze a lokálního scanu platí hned. Změny serverového watcheru, veřejného výpisu a hledače začnou na webu platit až po nasazení upraveného kódu.
