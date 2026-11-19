import {geocodePlace} from '../../src/lib/geocode';
(async()=>{for(const place of ['Střehomský mlýn, Střehom, Dolní Bousov','Sportkemp Kralovice','Zahorčice, Strážov','Šumperk']){console.log(JSON.stringify({place,result:await geocodePlace(place,'CZ')}));}})();
