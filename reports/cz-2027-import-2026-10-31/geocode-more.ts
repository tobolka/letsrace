import {geocodePlace} from '../../src/lib/geocode';
import {writeFileSync} from 'node:fs';
(async()=>{const results=[];for(const place of ['Klecany','Luka nad Jihlavou','Velké Losiny','Dolní Bušínov','Benešovice, okres Tachov','Střílky','Chlum, Všestary, okres Hradec Králové','Milovy, Sněžné','Střehom','Zahorčice, Strážov, okres Klatovy']){const r={place,result:await geocodePlace(place,'CZ')};results.push(r);console.log(JSON.stringify(r));}writeFileSync('reports/cz-2027-import-2026-10-31/geocodes.json',JSON.stringify(results,null,2));})();
