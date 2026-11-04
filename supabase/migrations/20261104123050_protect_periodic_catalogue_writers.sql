-- A periodic reader may only write the fields its evidence covers.
create function public.pipeline_apply_periodic_read(
  p_event uuid,p_revision uuid,p_patch jsonb,p_method text,p_version text,
  p_evidence jsonb default '{}',p_source text default null,p_quote text default null,p_model text default null
) returns text[] language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  race public.events;
  patched public.events;
  locked text[];
  allowed text[];
  changed text[];
  assignments text;
  ages text[]:=array['age_categories','age_confidence','audience'];
begin
  allowed:=case
    when p_method='llm' and p_version='event-kind-v1' then array['event_type','visibility']
    when p_method='llm' and p_version='enrich-v4' then ages||array['disciplines','registration_url','regulations_url','registration_closes_at']
    when p_method='llm' and p_version='dossier-classes-v5-all-sources' then ages
    when p_method='series_document' and p_version='series-document-v3' then ages||array['regulations_url']
    when p_method='parser:sportsoft-race-page' then array['registration_url','regulations_url']
    when p_method='registration_categories' then ages
    when p_method='csc_race_page' then ages||array['website_url','registration_closes_at']
    else null end;
  if allowed is null or jsonb_typeof(p_patch) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(p_patch) k where not k=any(allowed))
    or (p_patch ? 'visibility' and p_patch->>'visibility' is distinct from 'hidden')
    or (p_patch ? 'event_type' and p_patch->>'event_type' is distinct from 'ride')
    then raise exception 'Invalid periodic read patch'; end if;
  select * into race from public.events where id=p_event for update;
  if not found or p_revision is null or race.public_revision is distinct from p_revision
    or race.visibility is distinct from 'public' or race.merged_into_id is not null
    or (p_version='event-kind-v1' and race.start_date<current_date)
    or (p_version is distinct from 'event-kind-v1' and coalesce(race.status,'') not in ('scheduled','registration_open','postponed','tbc','confirmed','completed'))
    then return null; end if;

  select coalesce(locked_fields,'{}') into locked from public.event_overrides where event_id=p_event for share;
  locked:=coalesce(locked,'{}');
  if p_version='event-kind-v1' and locked && array['event_type','visibility'] then return '{}'; end if;
  if locked && (ages||array['categories','event_categories'])
    or (p_version is distinct from 'dossier-classes-v5-all-sources' and race.age_confidence='explicit' and cardinality(race.age_categories)>0)
    then p_patch:=p_patch-ages; end if;
  p_patch:=p_patch-locked;
  if race.website_url is not null then p_patch:=p_patch-'website_url'; end if;
  if race.registration_url is not null then p_patch:=p_patch-'registration_url'; end if;
  if race.regulations_url is not null then p_patch:=p_patch-'regulations_url'; end if;
  if race.registration_closes_at is not null then p_patch:=p_patch-'registration_closes_at'; end if;

  patched:=jsonb_populate_record(race,p_patch);
  select coalesce(array_agg(k order by k),'{}'),string_agg(format('%1$I=(jsonb_populate_record(null::public.events,$1)).%1$I',k),',')
    into changed,assignments from jsonb_object_keys(p_patch) k where (to_jsonb(race)->k) is distinct from (to_jsonb(patched)->k);
  if cardinality(changed)=0 then return changed; end if;

  execute format('update public.events set %s,updated_at=now() where id=$2',assignments) using p_patch,p_event;
  insert into public.event_facts(event_id,field,value,previous,source_url,quote,method,version,model)
    select p_event,k,to_jsonb(patched)->k,to_jsonb(race)->k,
      coalesce(p_evidence->k->>'sourceUrl',p_source),coalesce(p_evidence->k->>'quote',p_quote),p_method,p_version,p_model
    from unnest(changed) k;
  return changed;
end;
$$;

revoke execute on function public.pipeline_apply_periodic_read(uuid,uuid,jsonb,text,text,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.pipeline_apply_periodic_read(uuid,uuid,jsonb,text,text,jsonb,text,text,text) to service_role;

create function public.pipeline_apply_original_categories(
  p_event uuid,p_revision uuid,p_rows jsonb,p_evidence jsonb,p_complete boolean,p_source text,p_quote text,p_model text,p_version text
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare race public.events; locked text[]; saved jsonb;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)=0 then raise exception 'Invalid original categories'; end if;
  select * into race from public.events where id=p_event for update;
  if not found or p_revision is null or race.public_revision is distinct from p_revision
    or race.visibility is distinct from 'public' or race.merged_into_id is not null
    or coalesce(race.status,'') not in ('scheduled','tbc','confirmed')
    then return null; end if;
  select locked_fields into locked from public.event_overrides where event_id=p_event for share;
  if coalesce(locked,'{}') && array['categories','event_categories','age_categories','age_confidence','audience']
    or exists(select 1 from public.event_categories where event_id=p_event) then return null; end if;

  with written as (
    insert into public.event_categories(event_id,name,age_min,age_max,gender)
      select p_event,c.name,c.age_min,c.age_max,c.gender from jsonb_populate_recordset(null::public.event_categories,p_rows) c
      returning *
  )
  select jsonb_agg(to_jsonb(written) order by id) into saved from written;
  insert into public.event_facts(event_id,field,value,previous,source_url,quote,method,version,model)
    values(p_event,'event_categories',jsonb_build_object('rows',saved,'details',p_evidence,'complete',p_complete),
      '[]',p_source,p_quote,'source_categories',p_version,p_model);
  return saved;
end;
$$;

create function public.pipeline_accept_discovered_race(p_url text,p_notes text)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare added uuid;
begin
  perform 1 from public.discovered_links where url=p_url and status='pending' for update;
  if not found then return false; end if;
  insert into public.watched_urls(url,kind,status,added_by,notes,next_poll_at,updated_at)
    values(p_url,'race','active','explore',p_notes,now(),now()) on conflict (url) do nothing returning id into added;
  if added is null then return false; end if;
  update public.discovered_links set status='accepted' where url=p_url;
  return true;
end;
$$;

create function public.pipeline_apply_series_links(
  p_series uuid,p_slug text,p_name text,p_normalized text,p_country text,p_races jsonb
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare s public.series; race public.events; proposal record; locked text[]; eligible uuid[]:='{}';
  linked integer:=0; created boolean:=false; receipt jsonb; race_id uuid;
begin
  if jsonb_typeof(p_races) is distinct from 'array' then raise exception 'Invalid series link plan'; end if;
  if p_series is null then
    select * into s from public.series where slug=p_slug for no key update;
  else
    select * into s from public.series where id=p_series for no key update;
    if not found then return jsonb_build_object('linked',0,'created',false); end if;
  end if;
  if s.id is not null and (s.visibility is distinct from 'public'
      or (p_series is not null and s.name is distinct from p_name)
      or (p_country is not null and s.country_code is not null and s.country_code is distinct from p_country))
    then return jsonb_build_object('linked',0,'created',false); end if;

  for proposal in select distinct * from jsonb_to_recordset(p_races) as r(id uuid,revision uuid) order by id loop
    select * into race from public.events where id=proposal.id for update;
    if not found or proposal.revision is null or race.public_revision is distinct from proposal.revision
      or race.series_id is not null or race.visibility is distinct from 'public' or race.merged_into_id is not null
      or coalesce(race.status,'') not in ('scheduled','registration_open','postponed','tbc') or race.start_date<current_date
      then continue; end if;
    select locked_fields into locked from public.event_overrides where event_id=race.id for share;
    if 'series_id'=any(coalesce(locked,'{}')) then continue; end if;
    eligible:=array_append(eligible,race.id);
  end loop;
  if cardinality(eligible)=0 then return jsonb_build_object('linked',0,'created',false); end if;
  if s.id is null then
    if cardinality(eligible)<2 or nullif(p_slug,'') is null then return jsonb_build_object('linked',0,'created',false); end if;
    insert into public.series(slug,name,name_normalized,country_code,source_kind)
      values(p_slug,p_name,p_normalized,p_country,'other') on conflict (slug) do nothing returning * into s;
    if s.id is null then return jsonb_build_object('linked',0,'created',false); end if;
    created:=true;
  end if;
  foreach race_id in array eligible loop
    receipt:=public.pipeline_attach_event_series(race_id,s.id,true,'periodic_series_link',false);
    if receipt->>'status'<>'attached' then raise exception 'Series membership was not saved'; end if;
    linked:=linked+1;
  end loop;
  return jsonb_build_object('linked',linked,'created',created);
end;
$$;

revoke execute on function public.pipeline_apply_original_categories(uuid,uuid,jsonb,jsonb,boolean,text,text,text,text),
  public.pipeline_accept_discovered_race(text,text),public.pipeline_apply_series_links(uuid,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.pipeline_apply_original_categories(uuid,uuid,jsonb,jsonb,boolean,text,text,text,text),
  public.pipeline_accept_discovered_race(text,text),public.pipeline_apply_series_links(uuid,text,text,text,text,jsonb) to service_role;
