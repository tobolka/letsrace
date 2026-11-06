-- What a rider needs from regulations also covers parking and the race's own categories.
create or replace function public.pipeline_save_practical_details(p_event uuid, p_expected uuid, p_details jsonb)
 returns jsonb language plpgsql set search_path to 'public', 'pg_temp' as $function$
declare held public.events; locks text[]; field text; fact jsonb; previous jsonb; merged jsonb; changed text[]:='{}'; skipped text[]:='{}';
begin
  select * into held from public.events where id=p_event for update;
  if not found or held.public_revision is distinct from p_expected or held.merged_into_id is not null then return jsonb_build_object('status','changed'); end if;
  if jsonb_typeof(p_details)<>'object' or (select count(*) from jsonb_object_keys(p_details))>7 then raise exception 'Invalid practical details'; end if;
  select locked_fields into locks from public.event_overrides where event_id=p_event;
  merged:=held.practical_details;
  for field,fact in select * from jsonb_each(p_details) loop
    if field not in ('venue','organizer','schedule','fees','routes','parking','categories') or jsonb_typeof(fact)<>'object'
      or not fact ?& array['sourceUrl','quote','editionYear','status','checkedAt','value']
      or coalesce(fact->>'sourceUrl','') !~ '^https?://' or length(coalesce(fact->>'quote',''))<8
      or fact->>'editionYear' is distinct from extract(year from held.start_date)::int::text
      or coalesce(fact->>'status','') not in ('current','year_neutral','inherited')
      or (field in ('schedule','fees','routes','categories') and fact->>'status'<>'current')
      or jsonb_typeof(fact->'value') is distinct from (case when field in ('venue','organizer','parking') then 'object' else 'array' end)
      or fact->>'checkedAt' is null then raise exception 'Invalid practical fact'; end if;
    previous:=merged->field;
    if 'practical_details'=any(coalesce(locks,'{}')) or ('practical.'||field)=any(coalesce(locks,'{}'))
      or (field='venue' and 'location_id'=any(coalesce(locks,'{}')) and exists(select 1 from public.locations where id=held.location_id and coalesce(venue,name) is distinct from fact->'value'->>'name'))
      or (previous->>'status'='current' and fact->>'status'<>'current') then skipped:=array_append(skipped,field); continue; end if;
    if previous->'value'=fact->'value' and previous->>'status'=fact->>'status' then continue; end if;
    if previous is not null and (fact->>'checkedAt')::timestamptz < (previous->>'checkedAt')::timestamptz then skipped:=array_append(skipped,field); continue; end if;
    merged:=jsonb_set(merged,array[field],fact,true); changed:=array_append(changed,field);
    insert into public.event_facts(event_id,field,value,previous,source_url,quote,method,version)
      values(p_event,'practical.'||field,fact,previous,fact->>'sourceUrl',fact->>'quote','practical_details','1');
  end loop;
  if cardinality(changed)>0 then update public.events set practical_details=merged where id=p_event; end if;
  return jsonb_build_object('status','saved','changed',changed,'skipped',skipped);
end;
$function$;
