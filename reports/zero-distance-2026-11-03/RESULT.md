# Michaelis-Schanze: neznámá délka není 0 km

3. listopadu 2026. Závod `48a83a57-c5ff-4606-8293-8edc408e8d68`, adresa `mtb-rennen-um-die-michaelis-schanze-2026`.

## Příčina a oprava

Zdrojová vazba ukazuje na radsport-events záznam 26670. Čtečka přijímala každý nenulový (`!= null`) údaj `distanceKm`, tedy i numerickou nulu, a bez názvu kategorie vytvořila název `0 km`. Databáze obsahovala právě takovou jedinou kategorii: `b98e3594-c16a-4633-8acc-a930bea6c41d`, délka 0, žádný věk ani převýšení.

- Čtečka nyní přijímá jen kladnou konečnou délku. Bez délky zachovává skutečné názvy kategorií, například Elite nebo U15; nevytvoří bezejmennou trasu 0 km.
- Společné skládání kategorií převádí neplatné délky na neznámé, nevyplní jimi známou délku a nepřidává nulové zástupné položky.
- Veřejné zpracování i detail filtrují historické zástupné názvy jako `0 km` nebo `0,0 km`. Skutečné krátké tratě zůstávají zachované.
- U tohoto konkrétního závodu byla prázdná zástupná kategorie odstraněna v chráněné transakci po kontrole nezměněného obsahu a ručních zámků. Celý původní řádek je uložen v `event_facts.previous`, metoda `invalid_distance_repair`; oprava je dohledatelná a umožňuje cílenou obnovu. ID závodu, zdroje a ostatní vazby zůstaly zachované. Žádné hromadné mazání dalších kategorií.

Skutečnou délku tato oprava nezjišťuje ani neodhaduje. Když po odstranění nepravdivé položky nejsou žádné doložené kategorie, prázdná sekce se nezobrazuje.

## Ověření

**1 480 testů / 227 souborů prošlo**, sestavení a cílená kontrola kódu prošly. Nové testy pokrývají nulu, záporné/nečíselné/nekonečné délky, chybějící vzdálenost u pojmenované kategorie, zachování tratě 0,2 km a ochranu dříve známé délky před přepsáním nulou.

Produkční databáze potvrdila odstranění právě jedné zástupné kategorie a zachování jejího původního řádku v historii opravy. Logy: `tmp/zero-distance-all-tests.log`, `tmp/zero-distance-build.log`, `tmp/zero-distance-lint.log`.

Nasazeno `cc142868`, Vercel `dpl_7P2Fhvzdx3bEcR16mYBzMgygYbT7` READY s produkční doménou. Mac je aktualizovaný; nainstalovaná čtečka radsport-events se shoduje se zdrojovým kódem. Na skutečném veřejném detailu po nasazení ověřeno: žádný text `0 km` a žádná prázdná sekce „Trasy a kategorie“. [Veřejný snímek](production.jpg).
