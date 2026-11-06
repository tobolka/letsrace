# Proč se cyklus na Macu zasekával · 6. 11. 2026

Měřeno ze záznamů cyklů a čtení od 5. 11. 20:00 do 6. 11. 5:35 UTC.

## Co se stalo v noci
- 249 cyklů, z toho přes 200 do minuty. Doručení jen v 2 cyklech: 7 nových závodů, 35 doplněných.
- Oba doručující cykly skončily stavem „čeká na zobrazení“ a tento stav se už nikdy neuzavřel.
- Ranní kontrola se zastavila na prvním příkazu, protože čekala na schválení. Nic nezapsala.

## Příčiny
1. **Zápis po přečtení neměl čas.** Stránky jednoho webu sdílí jeden časový limit a čekají ve frontě. Přečtená stránka Cycling Austria pak uložila 0 z 30 řádků a čtení přišlo vniveč, až 8 pokusů na stránku. Samotná stránka se přitom uloží za 26 s.
2. **Falešný pokrok.** Pět závodů, které server odmítal, se počítalo jako pokrok, a tři pomocné stránky jako čekající práce. Cyklus se proto ptal na další běh každou minutu.
3. **Stav, který nikdo neuzavře.** Kontrola stránek je serverová fronta (372 čekajících, zhruba 40 denně). Každý cyklus, který doručil závod, se tím hlásil jako nedokončený.
4. **Jedna stránka, jeden cyklus.** Weby pořadatelů dozrávají po jedné, takže na každou běžel celý cyklus včetně posouzení.
5. **Přerušené zveřejnění se nikdy nedokončilo.** Krok pro jeho obnovu v cyklu na Macu chyběl.

## Opravy
- Na Macu dostane přečtená stránka aspoň 90 s na uložení. Server má limit beze změny.
- Pokračuje se jen tehdy, když další cyklus opravdu může něco posunout.
- Čekání na kontrolu stránek už cyklus neoznačuje za nedokončený; počet zůstává v `pagesAwaitingCheck`.
- Weby pořadatelů se čtou v dávkách nejvýš jednou za 30 minut.
- Pomocné stránky se odloží o 90 dní.
- Přerušená zveřejnění se zkouší dokončit každých 6 hodin.
- Další den vícedenního závodu už není „jiný závod“. Stránka proto nekončí chybou a datum závodu se nemění.

## Ostrá zkouška na Macu
Dva skutečné cykly po instalaci, ráno 6. 11. Čtení se týkalo 16 stránek Cycling Austria, které v noci selhávaly.

| | V noci | Po opravách |
| --- | --- | --- |
| Nedostatek času na uložení | 31 výskytů v záznamech | 0 ze 16 stránek |
| Čekající zdroje po cyklu | 3 stále dokola | 0 |
| Další běh hned poté | každou minutu | ne, až na další práci |
| Stav cyklu | 2 doručující cykly „nedokončeno“ | oba „hotovo“ (nic nedoručovaly) |

První zkouška: 11 ze 16 stránek v pořádku, 5 selhalo na 3 řádcích. Čtyři z nich způsobily dva vícedenní závody; po opravě prošly všechny čtyři a data závodů zůstala 14.–15. 11. a 9.–10. 7. Pátá stránka (`kalender?view=events&page=4`) se znovu nečetla a její řádek zůstává otevřený, viz níže.

## Co zkouška nedokazuje
- Jde o dva cykly a 20 čtení. Celonoční běh a cyklus, který opravdu doručuje, s opravami ještě neproběhl.
- Stránky Cycling Austria teď trvaly 84 až 227 s. Web je pomalý nebo vrací chyby, to se opravou nemění.

## Co zůstává otevřené
- Řádek 6. 6. 2027 z Cycling Austria (`oerv-2B07205C…`) naráží na záznam jiného závodu se stejnými údaji. Cycling Cup Thaur má dva záznamy.
- Lesák CUP a OchsenkopfGravel se nedají dokončit: u prvního byl zdroj dříve odmítnut, u druhého se plán zveřejnění liší od schváleného. Nebrzdí už cyklus, ale závody chybí.
- Odmítnutí kvůli jinému datu postihlo za 7 dní 22 zdrojů. Oprava řeší jen vícedenní závody, ostatní zůstávají (např. `sumator-malevil`).
- Fronta kontroly stránek má 372 položek a ubývá jí zhruba 40 denně. Ve vzorku 12 čekajících stránek bylo 11 vidět a 12. je skrytý závod, takže návštěvníky nebrzdí.

## Veřejný web ráno
Kontrola: `check.cjs`, výsledek `public-check.json`.
- 11 skrytých závodů CUBE Cupu: všech 11 vrací 404.
- 7 opravených dat: všech 7 sedí na stránce.
- 13 sloučených adres: 11 přesměrovává. 2 vrací 404, protože zachovaný závod je z Nizozemska a Dánska, které se na webu nezobrazují.
- 20 závodů s údaji z propozic: u všech 20 je sekce na stránce vidět.
