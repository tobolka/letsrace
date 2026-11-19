# Výsledek nového promptu — jeden běh OpenAI

Nový běh úspěšně vrátil **47 návrhů závodů**. Cena je **0,231496 USD**, API evidovalo **7 webových volání**. Požadavek měl nastavený max_tool_calls=6, skutečný výstup obsahuje 7 web_search_call; výkaz i cena vycházejí ze skutečného výstupu. Všechny návrhy mají URL ze skutečných výsledků hledání. Celkem 93 různých zdrojových URL je v samostatné místní frontě.

Starý prompt přinesl také 47 návrhů, 82 URL a stál 0,213962 USD. Nový tedy v tomto běhu nepřinesl vyšší počet návrhů. Lepší přesnost ani více skutečně chybějících závodů zatím prokázané nejsou. Počty URL nejsou počty závodů.

Model označil 46 položek confirmed a jednu preliminary. Jde o jeho vyhodnocení, nikoliv nezávislé potvrzení nebo souhlas s publikací. V tomto běhu se neprovádělo čtení zdrojů ani porovnávání s DB. Žádný event nebyl zapsaný. Nový seznam zatím neobsahuje závod označený disciplínou BMX, přestože jej zadání požadovalo; úplnost kategorií tedy není doložená.

## Výsledky podle modelu

Neznámé hodnoty jsou označené —. Status ve sloupci je výhradně status vrácený modelem.

| Datum | Závod | Město | Kraj | Disciplína | Seriál | Děti | Status modelu | Zdroj |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 10 Jan 2027 | Czech National Championships | Mladá Boleslav | — | cyklokros | — | unknown | confirmed | [zdroj](https://www.eventivsport.com/events/country/Czechia/cycling) |
| pátek 26.3. | Pražský MTB pohár I. | Praha | — | MTB XCC, časovka XCC | ŠKODA Pražský MTB pohár | unknown | confirmed | [zdroj](https://prahamtb.cz/?p=7288) |
| sobota 27.3. | Pražský MTB pohár II. | Praha | — | MTB XCO | ŠKODA Pražský MTB pohár | unknown | confirmed | [zdroj](https://prahamtb.cz/?p=7288) |
| 23. dubna 2027 | Nonvabank | Kovanec | — | MTB ultra | — | unknown | confirmed | [zdroj](https://bezpodpory.cz/bikepacking-a-ultra-cyklisticke-zavody-v-cesku-a-na-slovensku-2027/) |
| 24 Apr 2027 | Czech MTB Cup | Město Touškov | — | MTB | Czech MTB Cup | unknown | confirmed | [zdroj](https://www.eventivsport.com/events/country/Czechia/cycling) |
| 24. dubna 2027 | 3-2-1 Vabank | Kovanec | — | MTB ultra | — | unknown | confirmed | [zdroj](https://bezpodpory.cz/bikepacking-a-ultra-cyklisticke-zavody-v-cesku-a-na-slovensku-2027/) |
| 29 Apr 2027 | Gracia | Orlová | — | silnice | — | unknown | confirmed | [zdroj](https://www.eventivsport.com/events/country/Czechia/cycling) |
| 1 May 2027 | Grand Prix West Bohemia | Kyšice | — | silnice | — | unknown | confirmed | [zdroj](https://www.eventivsport.com/events/country/Czechia/cycling) |
| 1.5.2027 | MAY DIVIDE | — | — | ultra MTB/gravel | — | unknown | confirmed | [zdroj](https://bike-paradise.cz/) |
| 1. 5. 2027 | RAAB FORCE Rohálovská 50ka 2027 | Prusinovice | — | MTB XCM | — | yes | confirmed | [zdroj](https://www.ambike.com/kalendar-zavodu/?zavod=25620) |
| 6 May 2027 | Course de la Paix Juniors | — | — | silnice | — | unknown | confirmed | [zdroj](https://www.eventivsport.com/events/country/Czechia/cycling) |
| 7 May 2027 | Course de la Paix Juniors Féminines | — | — | silnice | — | unknown | confirmed | [zdroj](https://www.eventivsport.com/events/country/Czechia/cycling) |
| 8 May 2027 | GP Junek Velodromes | — | — | dráha | — | unknown | confirmed | [zdroj](https://www.eventivsport.com/events/country/Czechia/cycling) |
| 8. 5. 2027 | Časovka/timetrial - DEKOM SYSTEM SUDETY TOUR 2027 | — | — | silniční časovka | DEKOM SYSTEM SUDETY TOUR 2027 | unknown | confirmed | [zdroj](https://kalendar.winspace.cz/kalendar) |
| 9. 5. 2027 | DEKOM SYSTEM SUDETY TOUR 2027 | — | — | silnice | — | unknown | confirmed | [zdroj](https://kalendar.winspace.cz/kalendar) |
| 11 May 2027 | 500+1 KOLO | — | — | dráha | — | unknown | confirmed | [zdroj](https://www.eventivsport.com/events/country/Czechia/cycling) |
| 15 May 2027 | Tessuti Sport Bike Race | Dlouhoňovice | — | MTB | — | unknown | confirmed | [zdroj](https://www.eventivsport.com/events/country/Czechia/cycling) |
| 20 May 2027 | Tour de Feminin | Krásná Lípa | — | silnice | — | unknown | confirmed | [zdroj](https://www.eventivsport.com/events/country/Czechia/cycling) |
| 21 May 2027 | UCI XCO Junior Series - Nové Město na Moravě | Nové Město na Moravě | — | MTB XCO | UCI XCO Junior Series | unknown | confirmed | [zdroj](https://www.eventivsport.com/events/country/Czechia/cycling) |
| 21. května 2027 | Oremon | Český Jiřetín | — | gravel ultra | — | unknown | confirmed | [zdroj](https://bezpodpory.cz/bikepacking-a-ultra-cyklisticke-zavody-v-cesku-a-na-slovensku-2027/) |
| 21. května 2027 | 400 Ultra | Mostek | — | MTB ultra | — | unknown | confirmed | [zdroj](https://bezpodpory.cz/bikepacking-a-ultra-cyklisticke-zavody-v-cesku-a-na-slovensku-2027/) |
| 22. 5. 2027 | Mamut Tour | Prosenice | — | silnice | — | unknown | confirmed | [zdroj](https://kalendar.winspace.cz/kalendar) |
| 27 May 2027 | Peace Race | — | — | silnice | — | unknown | confirmed | [zdroj](https://www.eventivsport.com/events/country/Czechia/cycling) |
| 29. května 2027 | Moravia Divide | — | — | MTB ultra | — | unknown | confirmed | [zdroj](https://bezpodpory.cz/bikepacking-a-ultra-cyklisticke-zavody-v-cesku-a-na-slovensku-2027/) |
| 30.5.2027 | NN KIDS RACE 2027 | Hradec Králové | — | dětský cyklistický závod | — | yes | confirmed | [zdroj](https://www.cyklomaratontour.cz/index.php) |
| 1. června 2027 | Lost Ride | — | — | MTB ultra | — | unknown | confirmed | [zdroj](https://bezpodpory.cz/bikepacking-a-ultra-cyklisticke-zavody-v-cesku-a-na-slovensku-2027/) |
| 5 Jun 2027 | Visegrad 4 Bicycle Race - GP Czech Republic | Deštné v Orlických Horách | — | silnice | Visegrad 4 Bicycle Race | unknown | confirmed | [zdroj](https://www.eventivsport.com/events/country/Czechia/cycling) |
| 5 Jun 2027 | Czech MTB Cup | Bedřichov | — | MTB | Czech MTB Cup | unknown | confirmed | [zdroj](https://www.eventivsport.com/events/country/Czechia/cycling) |
| 5. 6. 2027 | Road Stage Orlické hory | Deštné v Orlických horách | Královéhradecký kraj | silnice | Road Stage | unknown | confirmed | [zdroj](https://kalendar.winspace.cz/kalendar) |
| 11 Jun 2027 | GP Brno track cycling | Brno | — | dráha | — | unknown | confirmed | [zdroj](https://www.eventivsport.com/events/country/Czechia/cycling) |
| 11. června 2027 | DoKola! | Sedlejov | — | MTB ultra | — | unknown | confirmed | [zdroj](https://bezpodpory.cz/bikepacking-a-ultra-cyklisticke-zavody-v-cesku-a-na-slovensku-2027/) |
| 12. 6. 2027 | Krakonošův cyklomaraton | Trutnov | — | silnice | — | unknown | confirmed | [zdroj](https://kalendar.winspace.cz/kalendar) |
| 19 Jun 2027 | L'Etape Czech Republic - Hilly Stage 2027 | Praha | — | silnice | L'Etape Czech Republic | unknown | confirmed | [zdroj](https://www.eventivsport.com/events/country/Czechia/cycling) |
| 7.7.2027 | TROJMEZÍ | Dolní Bousov | — | ultra MTB/gravel | — | unknown | confirmed | [zdroj](https://bike-paradise.cz/) |
| 9-10.07 | 4X Pro Tour - JBC Revelations | Jablonec nad Nisou | — | MTB four-cross | 4X Pro Tour | unknown | confirmed | [zdroj](https://43ride.com/kalendarz-2027/) |
| 10. 7. 2027 | Ratajská 40 | Rataje nad Sázavou | — | MTB | — | unknown | confirmed | [zdroj](https://kalendar.winspace.cz/kalendar) |
| 16. – 18. červenec 2027 | Mistrovství České republiky XCC i XCO | Praha | — | MTB XCC, MTB XCO | — | unknown | confirmed | [zdroj](https://prahamtb.cz/?p=7288) |
| 1.8.2027 | V4 | Dolní Bousov | — | ultra gravel/MTB | — | unknown | confirmed | [zdroj](https://bike-paradise.cz/) |
| from 12-08-2027 | Czech Tour | — | — | silnice | — | unknown | confirmed | [zdroj](https://www.velowire.com/UCIcyclingcalendar/country/71/czech-republic.html) |
| 21.8.2027 | BIKE PARADISE | — | — | ultra MTB/gravel | — | unknown | confirmed | [zdroj](https://bike-paradise.cz/) |
| 4. 9. 2027 | Tour de Zeleňák | Rumburk | — | silnice | — | unknown | confirmed | [zdroj](https://kalendar.winspace.cz/kalendar) |
| 11. 9. 2027 | Road Stage Hradec Králové | Hradec Králové | — | silnice | ROAD STAGE SERIES | unknown | confirmed | [zdroj](https://www.roadstage.cz/) |
| 12. 9. 2027 | VCHK Hobby | Hradec Králové | — | silniční kritérium | ROAD STAGE SERIES | unknown | confirmed | [zdroj](https://www.roadstage.cz/grande-finale) |
| 12. 9. 2027 | VCHK Elite | Hradec Králové | — | silniční kritérium | ROAD STAGE SERIES | unknown | confirmed | [zdroj](https://www.roadstage.cz/grande-finale) |
| sobota 25.9. | Pražský MTB pohár III. | Praha | — | MTB XCO | ŠKODA Pražský MTB pohár | unknown | confirmed | [zdroj](https://prahamtb.cz/?p=7288) |
| neděle 26.9. | Pražský MTB pohár IV. | Praha | — | MTB XCO | ŠKODA Pražský MTB pohár | unknown | confirmed | [zdroj](https://prahamtb.cz/?p=7288) |
| 02 Oct 2027 | L'Étape Czech Republic - Flat Stage | Pardubice | — | silnice | L'Étape Czech Republic | unknown | preliminary | [zdroj](https://www.cycloworld.cc/en/gran-fondo/czech-republic/letape-czech-republic-flat-stage/46101) |

[Strojový výstup včetně rozsahů start_date/end_date](results.json)
