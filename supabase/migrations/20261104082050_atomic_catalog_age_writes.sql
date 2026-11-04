-- Evidence, the resulting catalogue revision and the public outbox commit together.
create function public.pipeline_apply_catalogue_age_read(
  p_event uuid,p_revision uuid,p_patch jsonb,p_method text,p_version text,
  p_source text default null,p_quote text default null,p_series uuid default null,p_series_updated_at timestamptz default null
) returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare race public.events; patched public.events; locked text[]; allowed text[]; next_revision uuid;
begin
  allowed:=case p_method
    when 'catalogue_age_inference' then array['age_categories','age_confidence','audience']
    when 'confirmed_series' then array['age_categories','age_confidence','audience']
    when 'raceresult_contests' then array['age_categories','age_confidence','audience']
    when 'regulation_ages' then array['age_categories','age_confidence','audience']
    when 'fci_ages' then array['age_categories','age_confidence','audience','registration_opens_at','registration_closes_at']
    when 'raceresult_official_date' then array['start_date','end_date','website_url','regulations_url']
    else null end;
  if allowed is null or jsonb_typeof(p_patch) is distinct from 'object' or p_patch='{}'
    or exists(select 1 from jsonb_object_keys(p_patch) k where not k=any(allowed)) then
    raise exception 'Invalid catalogue age read patch';
  end if;

  -- Series updates may in turn lock linked races. Acquire locks in that order.
  if p_series is not null then
    perform 1 from public.series where id=p_series and updated_at=p_series_updated_at
      and (p_method<>'confirmed_series' or (age_categories_confirmed_at is not null and to_jsonb(age_categories) @> (p_patch->'age_categories'))) for share;
    if not found then return null; end if;
  elsif p_method='confirmed_series' then return null;
  end if;
  select * into race from public.events where id=p_event for update;
  if not found or p_revision is null or race.public_revision is distinct from p_revision
    or race.visibility is distinct from 'public' or race.merged_into_id is not null
    or coalesce(race.status,'') not in ('scheduled','registration_open','postponed','tbc')
    or (p_series is not null and race.series_id is distinct from p_series)
    then return null; end if;
  select locked_fields into locked from public.event_overrides where event_id=p_event for share;
  if exists(select 1 from jsonb_object_keys(p_patch) k where k=any(coalesce(locked,'{}')))
    or (p_patch ? 'age_categories' and coalesce(locked,'{}') && array['age_categories','age_confidence','audience'])
    then return null; end if;
  if p_patch ? 'age_categories' and cardinality(coalesce(race.age_categories,'{}'))>0
    and (p_method in ('catalogue_age_inference','fci_ages') or race.age_confidence='explicit') then return null; end if;
  if p_method='fci_ages' and p_patch ? 'registration_closes_at' and race.registration_closes_at is not null then return null; end if;

  patched:=jsonb_populate_record(race,p_patch);
  if not exists(select 1 from jsonb_each(p_patch) item where (to_jsonb(race)->item.key) is distinct from (to_jsonb(patched)->item.key))
    then return null; end if;
  update public.events set age_categories=patched.age_categories,age_confidence=patched.age_confidence,audience=patched.audience,
    registration_opens_at=patched.registration_opens_at,registration_closes_at=patched.registration_closes_at,
    start_date=patched.start_date,end_date=patched.end_date,website_url=patched.website_url,regulations_url=patched.regulations_url,
    updated_at=now() where id=p_event returning public_revision into next_revision;
  insert into public.event_facts(event_id,field,value,previous,source_url,quote,method,version)
    select p_event,item.key,to_jsonb(patched)->item.key,to_jsonb(race)->item.key,p_source,p_quote,p_method,p_version
    from jsonb_each(p_patch) item where (to_jsonb(race)->item.key) is distinct from (to_jsonb(patched)->item.key);
  return next_revision;
end;
$$;
revoke execute on function public.pipeline_apply_catalogue_age_read(uuid,uuid,jsonb,text,text,text,text,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.pipeline_apply_catalogue_age_read(uuid,uuid,jsonb,text,text,text,text,uuid,timestamptz) to service_role;
