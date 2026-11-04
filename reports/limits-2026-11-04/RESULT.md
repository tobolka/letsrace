# Supabase a Vercel: opakované zpracování kalendářů a veřejné dotazy

- Mac zůstává pozastavený (`paused: true`); živý firewall Vercelu má aktivní zákaz scanů i původní omezení veřejných API. Žádný plošný sběr nebyl spuštěn.
- Úplně přečtený kalendář ukládá otisky jednotlivých úspěšně zpracovaných položek. Nezměněná položka s existující vazbou se do sedmi dnů znovu nezapisuje. Změna podkladu nebo čtečky může otevřít práci okamžitě. Čtečky složené z více stránek stále kontrolují obsah, nejen úvodní URL.
- Kolize zůstává uložená u konkrétní položky. Opakuje se s odkladem 30 min, 2 h, den, potom nejvýš jednou za týden, dokud se řádek nezmění nebo nepodaří uložit. To nemění plán kontroly novinek v kalendáři. Při čekající práci nebo neúplném čtení se nezveřejněné/zmizelé řádky neskrývají na základě daného běhu.
- Zkouška na 197 simulovaných položkách: nezměněný výsledek s jednou odloženou kolizí neprovedl žádný pokus o zápis, zůstal kontrolní otisk stránky. Změna jediného termínu připravila jeden zápis. Nejde o měření produkčního provozu.
- Veřejné ročníky používají přímý databázový spoj a stránkování podle ID. Produkční porovnání pro DE (2021–2032): prvních 1 000 řádků shodných do posledního pole, dalších 455 bez překryvu. Jeden vzorek odezvy přes databázové rozhraní: 335 ms původní, 139 ms nový. Není to SLA ani důkaz zániku všech timeoutů.
- Výpis seriálu vybírá veřejné hlavní i vedlejší vazby jedním čtením. Nová produkční funkce včetně vztahů vrátila obě kola UCI XCO Junior Series (Fullgaz a Graz). Obě veřejné funkce jsou dostupné jen serverové roli.
- Po případném obnovení sběru zbývá porovnat dvě normální čtení problémových zdrojů a trend edge logů. Cíl pod 16 000 požadavků za den zatím není potvrzen; veřejná čtení a ostatní práce se do něj počítají také.
