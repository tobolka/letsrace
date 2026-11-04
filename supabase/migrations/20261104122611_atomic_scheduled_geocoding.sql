-- A geocoder can return after a manual correction or a competing batch.
create function public.pipeline_apply_geocoding(
  p_expected jsonb, p_status text, p_lat double precision default null, p_lng double precision default null,
  p_country text default null, p_query text default null, p_rename text default null
) returns uuid[] language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  held public.locations;
  expected public.locations;
  applied uuid[] := '{}';
begin
  if jsonb_typeof(p_expected) is distinct from 'array' or jsonb_array_length(p_expected)>100
    or p_status is null or p_status not in ('ok','skipped','failed')
    or (p_status='ok' and not coalesce(p_lat between -90 and 90 and p_lng between -180 and 180,false))
    or (p_status<>'ok' and (p_lat is not null or p_lng is not null or p_country is not null or p_query is not null or p_rename is not null))
    then raise exception 'Invalid geocoding result'; end if;

  for expected in select * from jsonb_populate_recordset(null::public.locations,p_expected) order by id loop
    select * into held from public.locations where id=expected.id for update;
    if not found or held.lat is not null or held.geog is not null or held.geocode_status='skipped'
      or (held.name,held.municipality,held.venue,held.country_code,held.lng,held.geocode_query,held.geocode_status,held.updated_at)
         is distinct from
         (expected.name,expected.municipality,expected.venue,expected.country_code,expected.lng,expected.geocode_query,expected.geocode_status,expected.updated_at)
      then continue; end if;

    perform 1 from public.events where location_id=held.id order by id for update;
    perform 1 from public.event_overrides o join public.events e on e.id=o.event_id
      where e.location_id=held.id for share of o;
    if exists(select 1 from public.event_overrides o join public.events e on e.id=o.event_id
      where e.location_id=held.id and o.locked_fields && array['location_id','location','lat','lng'])
      then continue; end if;

    if p_status='ok' then
      update public.locations set
        lat=p_lat, lng=p_lng, geog=st_setsrid(st_makepoint(p_lng,p_lat),4326)::geography,
        country_code=coalesce(p_country,held.country_code), name=coalesce(p_rename,held.name),
        municipality=coalesce(p_rename,held.municipality), geocode_query=coalesce(p_rename,p_query,held.geocode_query),
        geocode_status=p_status, updated_at=now()
      where id=held.id;
    else
      update public.locations set geocode_status=p_status,updated_at=now() where id=held.id;
    end if;
    applied:=array_append(applied,held.id);
  end loop;
  return applied;
end;
$$;

revoke execute on function public.pipeline_apply_geocoding(jsonb,text,double precision,double precision,text,text,text)
  from public,anon,authenticated;
grant execute on function public.pipeline_apply_geocoding(jsonb,text,double precision,double precision,text,text,text)
  to service_role;
