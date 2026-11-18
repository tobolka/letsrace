-- The regulations of an edition are the primary source of who may start. Their reader may replace
-- an age set another source confirmed; a field a person locked stays as it is.
create or replace function public.pipeline_apply_periodic_read(
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
    when p_method='regulation_categories' and p_version='regulation-categories-v1' then ages
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
    or (p_version is distinct from 'dossier-classes-v5-all-sources' and p_method is distinct from 'regulation_categories' and race.age_confidence='explicit' and cardinality(race.age_categories)>0)
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
