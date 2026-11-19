import {readFile,writeFile} from 'node:fs/promises';
import {parse} from 'dotenv';import {createServerSupabase} from '../../src/lib/supabase/server';import {geocodePlace} from '../../src/lib/geocode';
Object.assign(process.env,parse(await readFile('.env.local','utf8')));
const out:any={};for(const p of ['Krásná Lípa','Javorník, okres Jeseník','Kozovazy, Vyšehořovice','Řevnice','Chodová Planá','Břeclav','Tři Dvory, okres Kolín','Nejdek','Mariánské Lázně','Plzeň','Jedovnice','Vrchlabí','Trutnov','Český Jiřetín','Prusinovice']){out[p]=await geocodePlace(p,'CZ');console.log(p,out[p]);await writeFile('reports/cz-2027-verification-2026-10-29/geocodes.json',JSON.stringify(out,null,2));}
