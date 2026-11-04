# Obnova pokrytí: Fullgaz a Ötztaler

- [Fullgaz Race 2027](https://letsrace.cz/cs/zavod/15-fullgaz-race-2027), ID `0a594422-6e84-4090-90bc-6535831c28cd`: nový samostatný ročník 3.–4. dubna podle [pořadatele](https://www.fullgazrace.de/) a [UCI](https://www.uci.org/competition-details/2027/MTB/81087). XCO, XCC, Continental Series, Junior, U23 a Elite. Historické trasy, ceny a registrace se nepřenesly. Opraven bod obce podle [OSM](https://www.openstreetmap.org/node/451951070); nejde o přesný bod startu.
- [Ötztaler 2027](https://letsrace.cz/cs/zavod/otztaler-mountainbike-festival-2027), ID `66cedec4-25e7-4a64-b387-fa0ad88e62b0`: Continental Series podle [UCI](https://www.uci.org/competition-details/2027/MTB/80741), zachovaný záznam a termín.
- Opakované načtení pořadatele Fullgaz po doplnění UCI nezaložilo ani nezměnilo závod. Obecné údaje již nepřepisují konkrétní disciplínu a zařazení. Změna metadat seriálu se připravuje před načtením revize závodu; plná transakce metadat seriálu zůstává otevřená.
- Starý token odloženého kandidáta nesmí zapisovat; cíleně schválené opakování dostává nový token. Ověřeno SQL testy a vratnou produkční zkouškou.
- Původní kontrolní sada se nemění. Fullgaz a Ötztaler po cílené opravě slouží jako regresní případy; Windhaag zůstává nedotčená kontrola. Výsledek 3/3 nedokládá plošnou kvalitu katalogu.
