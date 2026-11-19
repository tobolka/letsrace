import json,uuid,unicodedata,re
from pathlib import Path
p=Path('reports/winspace-2026-10-31');a=json.loads((p/'actions.json').read_text());geo={x['index']:x['result'] for x in json.loads((p/'geocodes.json').read_text())};version='winspace-review-2026-10-31-v1'
def q(x):
 if x is None:return 'null'
 if isinstance(x,bool):return str(x).lower()
 if isinstance(x,(int,float)):return str(x)
 if isinstance(x,list):return 'array['+','.join(q(t) for t in x)+']::text[]'
 if isinstance(x,dict):return q(json.dumps(x,ensure_ascii=False))+'::jsonb'
 return "'"+x.replace("'","''")+"'"
def norm(s):return re.sub('[^a-z0-9]+',' ',unicodedata.normalize('NFD',s).encode('ascii','ignore').decode().lower()).strip()
sql=['begin;',"select pg_advisory_xact_lock(hashtext('"+version+"'));",'do $batch$ begin']
for x in a:
 d=x['patch'];e=x.get('before');idx=x['index'];sql.append(f"if not exists(select 1 from event_facts where event_id={q(x['id'])} and version={q(version)} and field='import_review') then")
 if e:
  guard={k:e[k] for k in ['name','start_date','end_date','status','visibility','location_id']};sql.append(f"if not exists(select 1 from events e where id={q(e['id'])} and to_jsonb(e) @> {q(guard)}) then raise exception 'Record changed since review: {idx}'; end if;")
 if x['needsLocation']:
  g=geo[idx];assert g and g['countryCode']==x['country'],x
  loc={'id':str(uuid.uuid4()),'name':x['place'],'municipality':x['place'],'country_code':x['country'],'lat':g['lat'],'lng':g['lng'],'geocode_query':x['place']+', '+x['country'],'geocode_status':'ok','timezone':'Europe/Prague' if x['country'] in ['CZ','SK'] else {'BR':'America/Sao_Paulo','CN':'Asia/Shanghai','AE':'Asia/Dubai','HR':'Europe/Zagreb','SI':'Europe/Ljubljana'}.get(x['country'],'Europe/Prague')};sql.append('insert into locations('+','.join(loc)+') values('+','.join(q(v) for v in loc.values())+');');d['location_id']=loc['id'];x['newLocation']=loc
 if x['country'] not in ['CZ','SK','PL','DE','AT','IT','CH']:
  d['timezone']={'GR':'Europe/Athens','TR':'Europe/Istanbul','ES':'Europe/Madrid','BR':'America/Sao_Paulo','EC':'America/Guayaquil','AR':'America/Argentina/Salta','CO':'America/Bogota','GP':'America/Guadeloupe','CN':'Asia/Shanghai','AE':'Asia/Dubai','HR':'Europe/Zagreb','SI':'Europe/Ljubljana'}[x['country']]
 if not e or d['name']!=e['name']:d['name_normalized']=norm(d['name']);d['fingerprint']=d['start_date']+':nogps:'+norm(d['name'])
 if e:
  sql.append('update events set '+','.join(k+'='+q(v) for k,v in d.items())+',updated_at=now() where id='+q(x['id'])+';')
 else:
  d['slug']=norm(d['name']).replace(' ','-')+'-'+d['start_date'][:4];sql.append('insert into events(id,'+','.join(d)+') values('+q(x['id'])+','+','.join(q(v) for v in d.values())+');')
 fields={k:v for k,v in d.items() if k not in ['fingerprint','name_normalized','slug','source_kind']};locked=list(fields)
 sql.append('insert into event_overrides(event_id,fields,locked_fields,updated_by) values('+','.join([q(x['id']),q(fields),q(locked),q('Winspace manual source review 2026-10-31')])+') on conflict(event_id) do update set fields=event_overrides.fields||excluded.fields,locked_fields=array(select distinct unnest(event_overrides.locked_fields||excluded.locked_fields)),updated_by=excluded.updated_by,updated_at=now();')
 for url,kind in [(x['source'],'aggregator'),(x['official'],'official')]:
  if not url:continue
  sql.append('insert into event_sources(event_id,source_url,kind,external_id,is_canonical) select '+','.join([q(x['id']),q(url),q(kind),q(version+':'+str(idx)+':'+kind),'false'])+' where not exists(select 1 from event_sources where event_id='+q(x['id'])+' and source_url='+q(url)+');')
 fact={'fields':fields,'country':x['country'],'source_index':idx,'previous_edition_id':x['previous']['id'] if x['previous'] else None,'inherited_fields':['location_id','age_categories','audience','level','competition_type'] if x['previous'] else [],'location_precision':'municipality; not a verified start line'}
 sql.append('insert into event_facts(event_id,field,value,previous,source_url,quote,method,version) values('+','.join([q(x['id']),q('import_review'),q(fact),q({k:e.get(k) for k in d}) if e else 'null',q(x['source']),q(x['note']),q('manual_source_review'),q(version)])+');')
 sql.append('end if;')
sql+=['end $batch$;','commit;'];(p/'apply.sql').write_text('\n'.join(sql)+'\n');(p/'final-actions.json').write_text(json.dumps(a,ensure_ascii=False,indent=2));print(len(a),'actions; SQL bytes',len((p/'apply.sql').read_bytes()))
