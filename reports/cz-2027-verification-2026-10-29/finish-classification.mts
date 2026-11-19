import {readFile} from 'node:fs/promises';import {parse} from 'dotenv';import {createServerSupabase} from '../../src/lib/supabase/server';import {recordFacts} from '../../src/lib/catalog/facts';
Object.assign(process.env,parse(await readFile('.env.local','utf8')));const db=createServerSupabase();const id='2cea23e1-d7ce-4606-84c3-7533bebd087c';
const {data:b,error}=await db.from('events').select('audience,age_categories,age_confidence,overrides:event_overrides(*)').eq('id',id).single();if(error)throw error;
const fields={audience:'mixed',age_categories:['elite','junior','youth'],age_confidence:'explicit'};
const {error:e}=await db.from('events').update(fields).eq('id',id);if(e)throw e;
const o=b.overrides;const {error:oe}=await db.from('event_overrides').upsert({event_id:id,fields:{...(o?.fields as object??{}),...fields},locked_fields:[...new Set([...(o?.locked_fields??[]),...Object.keys(fields)])],updated_by:o?.updated_by??'admin'},{onConflict:'event_id'});if(oe)throw oe;
await recordFacts(db,id,Object.entries(fields).map(([field,value])=>({field,value,previous:(b as any)[field],sourceUrl:'https://emtboc2027.cz/en/programme/',quote:'Mixed relay race (EMTBOC) | Relay race (EJMTBOC, EYMTBOC) | Bulletin2: WOMEN, MEN; W17,M17;W20,M20'})),{method:'manual_verified_official',version:'cz-2027-2026-10-29'});
