create function public.pipeline_apply_catalogue_detail(
  p_event uuid,p_revision uuid,p_method text,p_source text,p_patch jsonb,
  p_place jsonb default null,p_quote text default null
) returns text[] language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  race public.events;
  patched public.events;
  prior_location uuid;
  prior_venue text;
  locked text[];
  changed text[];
  coordinates record;
begin
  if p_method is null or p_method not in ('fci_website','rideandrest_website','cycling_austria_detail')
    or p_source is null or p_source !~ '^https?://'
    or jsonb_typeof(p_patch) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(p_patch) k where
      k<>'website_url' and (p_method<>'cycling_austria_detail' or k not in ('age_categories','age_confidence','audience')))
    or (p_patch ? 'website_url' and coalesce(p_patch->>'website_url','') !~ '^https?://')
    or (p_place is not null and (p_method<>'cycling_austria_detail' or jsonb_typeof(p_place)<>'object'
      or nullif(btrim(p_place->>'town'),'') is null))
    then raise exception 'Invalid catalogue detail proposal'; end if;

  if p_place is not null then
    select location_id into prior_location from public.events where id=p_event;
    -- Match the lock order of other location writers.
    select venue into prior_venue from public.locations where id=prior_location for share;
  end if;
  select * into race from public.events where id=p_event for update;
  if not found or p_revision is null or race.public_revision is distinct from p_revision
    or race.visibility is distinct from 'public' or race.merged_into_id is not null
    or coalesce(race.status,'') not in ('scheduled','registration_open','postponed','tbc')
    or race.start_date<(now() at time zone 'UTC')::date
    or (p_place is not null and race.location_id is distinct from prior_location)
    then return '{}'; end if;

  select coalesce(locked_fields,'{}') into locked from public.event_overrides where event_id=p_event for share;
  locked:=coalesce(locked,'{}');
  if 'website_url'=any(locked) or (race.website_url is not null and
    (p_method<>'cycling_austria_detail' or race.website_url !~* '^https?://(www\.)?cyclingaustria\.at([/:?#]|$)'))
    then p_patch:=p_patch-'website_url'; end if;
  if locked && array['age_categories','age_confidence','audience'] or race.age_confidence='explicit'
    then p_patch:=p_patch-array['age_categories','age_confidence','audience']; end if;

  patched:=jsonb_populate_record(race,p_patch);
  if p_place is not null and nullif(btrim(prior_venue),'') is null and not (locked && array['location_id','location','lat','lng']) then
    select (p_place->>'lat')::float8 as lat,(p_place->>'lng')::float8 as lng into coordinates;
    if (coordinates.lat is null) <> (coordinates.lng is null)
      or coordinates.lat not between -90 and 90 or coordinates.lng not between -180 and 180
      then raise exception 'Invalid location coordinates'; end if;
    insert into public.locations(name,municipality,country_code,timezone,lat,lng,geocode_query,geocode_status)
      values(p_place->>'town',p_place->>'town','AT','Europe/Vienna',coordinates.lat,coordinates.lng,
        (p_place->>'town')||', AT',case when coordinates.lat is null then 'pending' else 'ok' end)
      returning id into patched.location_id;
    if coordinates.lat is not null then
      perform public.set_location_geog(patched.location_id,coordinates.lng,coordinates.lat);
    end if;
    p_patch:=p_patch||jsonb_build_object('location_id',patched.location_id);
  end if;
  select coalesce(array_agg(k order by k),'{}') into changed from jsonb_object_keys(p_patch) k
    where (to_jsonb(race)->k) is distinct from (to_jsonb(patched)->k);
  if cardinality(changed)=0 then return changed; end if;

  update public.events set website_url=patched.website_url,location_id=patched.location_id,
    age_categories=patched.age_categories,age_confidence=patched.age_confidence,audience=patched.audience,
    updated_at=now() where id=p_event;
  if not found then raise exception 'Catalogue detail update was not applied'; end if;
  insert into public.event_facts(event_id,field,value,previous,source_url,quote,method,version)
    select p_event,k,to_jsonb(patched)->k,to_jsonb(race)->k,p_source,p_quote,p_method,'atomic-v1'
    from unnest(changed) k;
  return changed;
end;
$$;
revoke execute on function public.pipeline_apply_catalogue_detail(uuid,uuid,text,text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.pipeline_apply_catalogue_detail(uuid,uuid,text,text,jsonb,jsonb,text) to service_role;
