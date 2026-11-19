import json, re, unicodedata
from pathlib import Path
p=Path(__file__).parent
pairs=json.loads((p/'pairs-before.json').read_text())
details=json.loads((p/'details-before.json').read_text())
extra=json.loads((p/'extra-before.json').read_text())
events={e['id']:e for e in details['events']+extra['events']}
def q(x):return "'"+str(x).replace("'","''")+"'"
def j(x):return q(json.dumps(x,ensure_ascii=False))+'::jsonb'
def val(x):
 if x is None:return 'null'
 if isinstance(x,list):return 'array['+','.join(q(v)for v in x)+']::text[]'
 return q(x)
sql=['begin;']
def fact(id,field,value,previous,url,quote):
 sql.append(f"insert into event_facts(event_id,field,value,previous,source_url,quote,method,version,status) values ({q(id)}, {q(field)}, {j(value)}, {j(previous)}, {q(url)}, {q(quote)}, 'manual_review', 'duplicate-audit-2026-10-31', 'active');")
def update(id,values,url,quote,lock=True):
 e=events[id]
 if 'name' in values:
  base=re.sub(r'[^a-z0-9\s]', ' ', ''.join(c for c in unicodedata.normalize('NFD',values['name']).lower() if not unicodedata.combining(c)))
  values={**values,'name_normalized':' '.join(base.split())}
 for k,v in values.items():
  if e.get(k)!=v:fact(id,k,v,e.get(k),url,quote)
 sql.append(f"update events set {','.join(k+'='+val(v)for k,v in values.items())},updated_at=now() where id={q(id)} and merged_into_id is null;")
 if lock:
  sql.append(f"insert into event_overrides(event_id,fields,locked_fields,updated_by,updated_at) values({q(id)}, {j(values)}, array[{','.join(q(k)for k in values)}]::text[], 'AI source review 2026-10-31', now()) on conflict(event_id) do update set fields=coalesce(event_overrides.fields,'{{}}'::jsonb)||excluded.fields, locked_fields=array(select distinct unnest(coalesce(event_overrides.locked_fields,'{{}}'::text[])||excluded.locked_fields)),updated_by=excluded.updated_by,updated_at=now();")
def merge(keep,drop):sql.append(f"select app_merge_events({q(keep)}::uuid,{q(drop)}::uuid);")
def dismiss(a,b):
 a,b=sorted([a,b]);sql.append(f"insert into duplicate_reviews(left_id,right_id,verdict) values({q(a)},{q(b)},'separate') on conflict(left_id,right_id) do nothing;")
left=lambda i:pairs[i]['left']['id']
right=lambda i:pairs[i]['right']['id']
pdf='https://static.rad-net.de/html/bdr/generalausschreibungen/2026/ga-bl-cyclo-cross_26-27.pdf'
decisions=[]
def decision(i,action,reason,sources):decisions.append({'pair':i,'key':pairs[i]['key'],'action':action,'reason':reason,'sources':sources})
decision(0,'waiting','Stejné datum, město a shodný pořadatel nestačí k prokázání, že krajské mistrovství a Oderský pohár jsou totožné starty. Portál ČSC nyní nezobrazil obsah; ani web pořadatele výslovně nepropojuje obě označení. Zachovat obě položky do získání rozpisu.',[pairs[0]['left']['websiteUrl'],pairs[0]['right']['websiteUrl'],'https://portal.czechcyclingfederation.com/RaceDetail/Race/1515','https://biketeam.estranky.cz/clanky/kalendar-zavodu-2026.html'])
for id in [left(0),right(0)]:fact(id,'duplicate_review',{'verdict':'waiting','pair':pairs[0]['key']},None,'https://portal.czechcyclingfederation.com/RaceDetail/Race/1515',decisions[-1]['reason'])
# The original round-10 row was overwritten by nearby round 11. Restore it to
# Vaihingen and return the exact Magstadt source identity to its existing race.
magstadt='150df4d3-d2b9-4de2-9ecb-1fe872e312aa'
sql.append(f"update event_sources set event_id={q(magstadt)} where event_id={q(right(1))} and external_id='cx-bundesliga-11-2026-11-08-magstadt';")
merge(right(1),left(1))
update(right(1),{'name':'Vaihinger Radcross — CX Bundesliga 10','start_date':'2026-11-07','end_date':'2026-11-07','location_id':events[left(1)]['location_id'],'website_url':pairs[1]['left']['websiteUrl'],'registration_url':None,'event_type':'race'},pairs[1]['left']['websiteUrl'],'Bundesliga Cyclo-Cross 2026/27 - Vaihinger Radcross am 7.11.2026 in Stuttgart - Vaihingen; official GA: 10 07.11.2026 Vaihingen, 11 08.11.2026 Magstadt.')
update(magstadt,{'start_date':'2026-11-08','end_date':'2026-11-08'},pairs[1]['right']['websiteUrl'],'Magstadter Radcross / 11. Lauf Cyclo-Cross Bundesliga 2026/2027 am So. 8.11.2026')
dismiss(right(1),magstadt)
decision(1,'repair_and_merge','Původní záznam 10. kola přepsalo 11. kolo v jiném místě. Vrátit zdroj Magstadtu k existujícímu Magstadter Radcross, obnovit Vaihingen 7.11. a sloučit jeho dvě kopie. Magstadt 8.11. zachovat samostatně.',[pairs[1]['left']['websiteUrl'],pairs[1]['right']['websiteUrl'],pdf])
merge(left(2),right(2));decision(2,'merge','Stejný DWH Cross Wels 8.11.2026 ve Freizeitanlage Wels/Wimpassing, stejný pořadatel RC Ovilava. Ponechat podrobnější záznam federace.',[pairs[2]['left']['websiteUrl'],'https://www.cyclingaustria.at/index.php?option=com_events&view=event&id=D59A1F1CEF05413A9755FD4000066BB2&filter=page=2'])
# Keep both separately ranked Stahnsdorf rounds, not one artificial 2-day race.
day2='e6ceea5c-9518-4bc6-918c-bd761d73e23e'
sql.append(f"update event_sources set event_id={q(day2)} where event_id={q(left(3))} and external_id like '%2026-11-15%';")
merge(left(3),right(3))
update(left(3),{'name':'CX Bundesliga 12 — Stahnsdorf / Tag 1','start_date':'2026-11-14','end_date':'2026-11-14','event_type':'race','website_url':pairs[3]['right']['websiteUrl']},pdf,'12 14.11.2026 Stahnsdorf; 13 15.11.2026 Stahnsdorf. Separate points-scoring rounds in the official GA.')
update(day2,{'name':'CX Bundesliga 13 — Stahnsdorf / Tag 2','start_date':'2026-11-15','end_date':'2026-11-15','event_type':'race'},pdf,'13 15.11.2026 Stahnsdorf. Separate points-scoring round in the official GA.')
dismiss(left(3),day2)
decision(3,'repair_and_merge','Sloučit kopii soboty s dosavadním víkendovým záznamem a zúžit jej na 14.11.; nedělní 13. kolo 15.11. zachovat samostatně a přesunout k němu jeho zdroj.',[pdf,'https://www.dsergebnis.de/'])
merge(left(4),right(4));update(left(4),{'start_date':'2026-12-19','end_date':'2026-12-19'},pairs[4]['left']['websiteUrl'],'Antwerpen Saturday 19 December 2026. Koksijde is the separate following round on 20 December.')
decision(4,'merge','Antverpy a Antwerpen jsou stejné 4. kolo SP; pořadatel potvrzuje pouze 19.12., nikoli 19.–20.12. Zachovat existující ruční věkové zámky.',[pairs[4]['left']['websiteUrl'],pairs[4]['right']['websiteUrl']])
merge(right(5),left(5));decision(5,'merge','Zonhoven 3.1.2027 je totožné 9. kolo SP v českém i oficiálním kalendáři. Ponechat oficiální záznam a jeho věkové zámky.',[pairs[5]['left']['websiteUrl'],pairs[5]['right']['websiteUrl']])
merge(left(6),right(6));decision(6,'merge','Mannheim je stručné označení finále stejného Cyclocross Cupu 16.1.2027; pořadatel seriálu uvádí RRC Endspurt Mannheim a závod Rund um die Radrennbahn.',[pairs[6]['left']['websiteUrl'],'https://cyclocrosscup.de/rennen/',pairs[6]['right']['websiteUrl']])
dismiss(left(7),right(7))
# This Ruda is in Górzno, not Ruda Śląska. Never modify the shared old location.
sql.append("do $$ declare loc uuid; begin select id into loc from locations where name='Ruda, gmina Górzno' and country_code='PL' limit 1; if loc is null then insert into locations(name,municipality,country_code,lat,lng,region,geocode_query,geocode_status) values('Ruda, gmina Górzno','Ruda koło Górzna','PL',53.2253987,19.6560676,'kujawsko-pomorskie','Ruda, gmina Górzno, kujawsko-pomorskie','ok') returning id into loc; end if; update events set location_id=loc,website_url='https://www.glpkgravel.pl/',updated_at=now() where id='bc995997-ac54-442d-af22-f4d5c7fb31af'; insert into event_overrides(event_id,fields,locked_fields,updated_by) values('bc995997-ac54-442d-af22-f4d5c7fb31af',jsonb_build_object('location_id',loc,'website_url','https://www.glpkgravel.pl/'),array['location_id','website_url'],'AI source review 2026-10-31') on conflict(event_id) do update set fields=coalesce(event_overrides.fields,'{}'::jsonb)||excluded.fields,locked_fields=array(select distinct unnest(coalesce(event_overrides.locked_fields,'{}'::text[])||excluded.locked_fields)),updated_at=now(); end $$;")
fact(left(7),'venue_review',{'municipality':'Ruda koło Górzna','lat':53.2253987,'lng':19.6560676},events[left(7)]['location_id'],'https://www.glpkgravel.pl/','17.04.2027 Górznieńsko-Lidzbarski Park Krajobrazowy / Ruda k. Górzna. OSM: Ruda, gmina Górzno, kujawsko-pomorskie; not Ruda Śląska.')
decision(7,'separate_and_repair','GLPK Gravel je v Rudě u Górzna v Kujavsko-pomořském kraji; Grevet je v Tychách ve Slezsku. Dvojici způsobil chybný bod v Rudě Śląské. Opravit pouze polohu GLPK, závody neslučovat.',[pairs[7]['left']['websiteUrl'],pairs[7]['right']['websiteUrl'],'https://www.glpkgravel.pl/'])
for i,reason in [(8,'Tentýž den a pořadatel, ale různé formáty: Volksradfahren a Odenwald Marathon mají oddělené trasy a registrace.'),(9,'BONNET Radmarathon je 214km maraton se startem 6–7 h; Volksradfahren je rodinná cca 20km jízda se startem 8–11 h. Jsou samostatné položky.'),(10,'Profesionální GP Czech Republic UCI 1.2 startuje 11:00, amatérské Road Stage formáty později ve vlastních vlnách. Nejsou to kopie jednoho závodu.'),(12,'Federace potvrzuje samostatné Short-Track a Kids & Juniors Trophy se dvěma různými identitami a kategoriemi, obě 6.8.2027. Short-Track je XCC, nikoli dráha.')]:
 dismiss(left(i),right(i));decision(i,'separate',reason,[pairs[i]['left']['websiteUrl'],pairs[i]['right']['websiteUrl']])
update(left(10),{'start_date':'2027-06-05','end_date':'2027-06-05','website_url':'https://www.roadstage.cz/orlicke-hory'},pairs[10]['left']['websiteUrl'],'SO 5.6.: Road Stage i profesionální GP Czech Republic; NE 6.6.: Wellness, výlet nebo lehké vyjetí, hory bez startovního čísla. Race date is 5 June, not the leisure weekend.')
# Recover the previous annual edition rather than leaving its timing identity
# attached to a 2027 event. Copy stable identity only, not fees or categories.
sql.append("do $$ declare old_id uuid; begin select id into old_id from events where website_url='https://my.raceresult.com/357112/' and start_date='2026-07-11' and merged_into_id is null limit 1; if old_id is null then insert into events(name,name_normalized,fingerprint,slug,start_date,end_date,location_id,disciplines,audience,status,visibility,event_type,website_url,registration_url) select name,name_normalized,regexp_replace(fingerprint,'^2027-07-10:','2026-07-11:'),'2much4you-12h-24h-mtb-rennen-im-zittauer-gebirge-2026','2026-07-11','2026-07-12',location_id,array['mtb'],'mixed','scheduled','public','race','https://my.raceresult.com/357112/','https://my.raceresult.com/357112/' from events where id='9292d95c-a282-478d-aab8-5c77107512b4' returning id into old_id; end if; update event_sources set event_id=old_id where event_id='9292d95c-a282-478d-aab8-5c77107512b4' and external_id='rr-357112'; insert into event_facts(event_id,field,value,source_url,quote,method,version,status) values(old_id,'edition_review',jsonb_build_object('start_date','2026-07-11','end_date','2026-07-12'),'https://my.raceresult.com/357112/','11.07.2026/12.07.2026 Oybin Germany 2Much4You | 12h & 24h MTB-Rennen im Zittauer Gebirge','manual_review','duplicate-audit-2026-10-31','active'); end $$;")
merge(left(11),right(11));update(left(11),{'start_date':'2027-07-10','end_date':'2027-07-11','disciplines':['mtb']},'https://baer-service.de/veranstaltung/TMY','2Much4You | 12h & 24h MTB-Rennen im Zittauer Gebirge, 10. bis 11. Juli 2027, Kammbaude Oybin. Endurance race, no confirmation of Olympic XCO format.')
decision(11,'merge_and_recover_previous_edition','Totožný vytrvalostní závod v Oybinu 10.–11.7.2027. Sloučit dvě kopie; časomíru rr-357112 z 11.–12.7.2026 vrátit do samostatného ročníku 2026, který byl chybně posunut do 2027. Nepřebírat tvrzení XCO.',[pairs[11]['left']['websiteUrl'],'https://baer-service.de/veranstaltung/TMY','https://my.raceresult.com/357112/'])
update(left(12),{'start_date':'2027-08-06','end_date':'2027-08-06','disciplines':['xcc'],'website_url':'https://www.ischgl.com/en/events-experiences/ischgl-ironbike'},'https://www.cyclingaustria.at/index.php?option=com_events&view=event&id=8DF995AD18184F41A9746F40CF27B4FC&filter=page=5','Ischgl Ironbike Short-Track: Fr, 6. August 2027, 15.45–17.30 Uhr, Sparte MTB, Disziplin Short-Track.')
sql.append("insert into watched_urls(url,kind,status,added_by,next_poll_at,notes) values('https://www.glpkgravel.pl/','race','active','duplicate-review-2026-10-31',now(),'Official organiser; 17.04.2027, Ruda k. Górzna') on conflict(url) do nothing;")
sql.append('commit;')
(p/'apply.sql').write_text('\n'.join(sql))
(p/'decisions.json').write_text(json.dumps(decisions,ensure_ascii=False,indent=2))
print('Prepared',len(decisions),'pair decisions; 7 audited merges, 5 separate pairs, 1 evidence-bound wait. No deletions.')
