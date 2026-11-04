-- Both snapshots were selected by the catalogue's place matching rules.
-- A changed snapshot or a location lock defers the whole pair.
create function public.pipeline_merge_duplicate_location(p_keep jsonb,p_drop jsonb)
returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  keep_id uuid := (p_keep->>'id')::uuid;
  drop_id uuid := (p_drop->>'id')::uuid;
  kept public.locations;
  dropped public.locations;
  moved integer;
begin
  if keep_id is null or drop_id is null or keep_id=drop_id then return null; end if;
  -- Prevent new FK references to the dropped location until the move is committed.
  perform 1 from public.locations where id in (keep_id,drop_id) order by id for update;
  select * into kept from public.locations where id=keep_id;
  select * into dropped from public.locations where id=drop_id;
  if kept.id is null or dropped.id is null
    or not (to_jsonb(kept) @> p_keep and to_jsonb(dropped) @> p_drop)
    or kept.lat is null or kept.lng is null
    or kept.lat is distinct from dropped.lat or kept.lng is distinct from dropped.lng
    or kept.country_code is distinct from dropped.country_code
    or kept.timezone is distinct from dropped.timezone
    or (nullif(btrim(dropped.venue),'') is not null and kept.venue is distinct from dropped.venue)
    or (nullif(btrim(dropped.region),'') is not null and kept.region is distinct from dropped.region)
    or (nullif(btrim(dropped.region_code),'') is not null and kept.region_code is distinct from dropped.region_code)
    or (nullif(btrim(dropped.municipality),'') is not null and nullif(btrim(kept.municipality),'') is null)
    then return null; end if;

  perform 1 from public.events where location_id=drop_id order by id for update;
  perform 1 from public.event_overrides o join public.events e on e.id=o.event_id
    where e.location_id=drop_id for share of o;
  if exists (select 1 from public.event_overrides o join public.events e on e.id=o.event_id
    where e.location_id=drop_id and o.locked_fields && array['location_id','location','lat','lng'])
    then return null; end if;

  with repointed as (
    update public.events set location_id=keep_id,updated_at=now()
    where location_id=drop_id returning id
  )
  insert into public.event_facts(event_id,field,value,previous,quote,method,version)
    select id,'location_id',to_jsonb(keep_id),to_jsonb(drop_id),
      'Previous location: '||p_drop::text,'location_hygiene','atomic-v1' from repointed;
  get diagnostics moved=row_count;
  if exists (select 1 from public.events where location_id=drop_id) then
    raise exception 'Location still has linked events';
  end if;
  delete from public.locations where id=drop_id;
  if not found then raise exception 'Duplicate location could not be removed'; end if;
  return moved;
end;
$$;

-- A country-centre pin may be removed only while the reviewed row still matches.
create function public.pipeline_unpin_country_location(p_expected jsonb)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare held public.locations;
begin
  select * into held from public.locations where id=(p_expected->>'id')::uuid for update;
  if not found or held.lat is null or nullif(btrim(held.venue),'') is not null
    or not (to_jsonb(held) @> p_expected) then return false; end if;
  perform 1 from public.events where location_id=held.id order by id for update;
  perform 1 from public.event_overrides o join public.events e on e.id=o.event_id
    where e.location_id=held.id for share of o;
  if exists (select 1 from public.event_overrides o join public.events e on e.id=o.event_id
    where e.location_id=held.id and o.locked_fields && array['location_id','location','lat','lng'])
    then return false; end if;
  update public.locations set lat=null,lng=null,geog=null,geocode_status='skipped',updated_at=now()
    where id=held.id;
  insert into public.event_facts(event_id,field,value,previous,method,version)
    select id,'location_coordinates',jsonb_build_object('lat',null,'lng',null),
      jsonb_build_object('lat',held.lat,'lng',held.lng),'location_hygiene','atomic-v1'
    from public.events where location_id=held.id;
  return true;
end;
$$;

revoke execute on function public.pipeline_merge_duplicate_location(jsonb,jsonb),
  public.pipeline_unpin_country_location(jsonb) from public,anon,authenticated;
grant execute on function public.pipeline_merge_duplicate_location(jsonb,jsonb),
  public.pipeline_unpin_country_location(jsonb) to service_role;
