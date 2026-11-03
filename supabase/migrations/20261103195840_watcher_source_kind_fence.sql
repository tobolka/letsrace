-- A source reclassified during a read needs a fresh prepared plan.
-- Publish a new race only when its native dependencies and evidence also commit.
create or replace function public.pipeline_create_watcher_event(
  p_event uuid,p_payload jsonb,p_source jsonb,p_hash text,p_reader text,p_reviewed boolean,
  p_location jsonb,p_categories jsonb,p_secondary uuid[],p_lease jsonb default null)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare watched public.watched_urls; loc public.locations; lease public.pipeline_tasks; k text; names text; vals text;
  location_row jsonb; category jsonb; linked_series uuid; external_id text:=p_source#>>'{event,externalId}'; source_url text:=p_source#>>'{event,sourceUrl}';
begin
  if p_event is null or jsonb_typeof(p_payload) is distinct from 'object' or pg_column_size(p_payload)>100000
    or jsonb_typeof(p_source) is distinct from 'object' or pg_column_size(p_source)>1000000
    or nullif(external_id,'') is null or coalesce(source_url,'') !~ '^https?://'
    or coalesce(p_hash,'') !~ '^[0-9a-f]{40}$' or p_reader is distinct from 'source-evidence-v1:'||(p_source->>'watchedUrlId')||':'||external_id||':'||p_event::text
    or jsonb_typeof(p_categories) is distinct from 'array' then raise exception 'Invalid new race plan'; end if;
  if jsonb_array_length(p_categories)>1000 or cardinality(p_secondary)>100 then raise exception 'New race plan too large'; end if;
  select * into watched from public.watched_urls where id=(p_source->>'watchedUrlId')::uuid for share;
  if not found or not (watched.status='active' or (coalesce(p_reviewed,false) and watched.status='paused' and watched.added_by='pipeline_review')) then
    raise exception 'source_reader_unavailable_or_running: source is paused or unavailable';
  end if;
  if p_lease is not null and p_lease<>'null'::jsonb then
    select * into lease from public.pipeline_tasks where key=p_lease->>'key' for update;
    if not found or lease.key is distinct from 'source:'||watched.id::text or lease.status<>'running'
      or lease.kind<>'source_read' or lease.token is distinct from (p_lease->>'token')::uuid
      or lease.lease_until is null or lease.lease_until<=clock_timestamp() or watched.url is distinct from p_lease->>'url'
      or watched.kind is distinct from p_source->>'kind' then
      raise exception 'source_reader_unavailable_or_running: source lease lost before creation';
    end if;
  end if;
  for k in select jsonb_object_keys(p_payload) loop
    if not k=any(array['slug','name','name_normalized','start_date','end_date','disciplines','formats','audience','age_categories','age_confidence','event_type','competition_type','season','timezone','fingerprint','registration_opens_at','registration_closes_at','source_kind','level','class_label','uci_class','last_seen_at','updated_at','visibility','status','description','website_url','registration_url','regulations_url','results_url','location_id','series_id']) then raise exception 'Unsupported new race field: %',k; end if;
  end loop;
  if p_location is not null and p_location<>'null'::jsonb then
    if p_location->>'action'='create' then
      location_row:=p_location->'row';
      if location_row->>'id' is distinct from p_payload->>'location_id' then raise exception 'New location does not match race'; end if;
      insert into public.locations(id,name,municipality,country_code,lat,lng,geocode_query,geocode_status,timezone)
        values((location_row->>'id')::uuid,location_row->>'name',location_row->>'municipality',location_row->>'country_code',
          (location_row->>'lat')::float8,(location_row->>'lng')::float8,location_row->>'geocode_query',location_row->>'geocode_status',location_row->>'timezone');
      if location_row->>'lat' is not null and location_row->>'lng' is not null then
        perform public.set_location_geog((location_row->>'id')::uuid,(location_row->>'lng')::float8,(location_row->>'lat')::float8);
      end if;
    elsif p_location->>'action'='geocode' then
      if p_location->>'id' is distinct from p_payload->>'location_id' then raise exception 'Geocode plan does not match race'; end if;
      select * into loc from public.locations where id=(p_location->>'id')::uuid for update;
      if not found or loc.lat is distinct from (p_location->>'expectedLat')::float8 or loc.lng is distinct from (p_location->>'expectedLng')::float8 then
        raise exception 'concurrent_event_update: location changed before race creation';
      end if;
      if loc.lat is not null or p_location->>'lat' is null or p_location->>'lng' is null then raise exception 'Invalid geocode fill'; end if;
      update public.locations set lat=(p_location->>'lat')::float8,lng=(p_location->>'lng')::float8,geocode_status='ok',updated_at=now() where id=loc.id;
      perform public.set_location_geog(loc.id,(p_location->>'lng')::float8,(p_location->>'lat')::float8);
    else raise exception 'Invalid location plan'; end if;
  end if;
  select string_agg(format('%I',key),',' order by key),string_agg(format('(jsonb_populate_record(null::public.events,$1)).%I',key),',' order by key)
    into names,vals from jsonb_object_keys(p_payload) key;
  if names is null then raise exception 'Empty race plan'; end if;
  perform set_config('app.event_series_source','watcher',true);
  execute format('insert into public.events(id,%s) select $2,%s',names,vals) using p_payload,p_event;
  insert into public.event_sources(event_id,watched_url_id,source_url,external_id,kind,is_canonical)
    values(p_event,watched.id,source_url,external_id,case p_source->>'kind' when 'federation' then 'national_federation' when 'series' then 'series' when 'aggregator' then 'aggregator' else 'official' end,true);
  insert into public.event_facts(event_id,field,value,previous,source_url,method,version)
    values(p_event,'source_evidence',p_source,null,source_url,'watcher_source_evidence','source-evidence-v1');
  insert into public.page_reads(url,reader,text_hash,read_at) values(source_url,p_reader,p_hash,now())
    on conflict(url,reader) do update set text_hash=excluded.text_hash,read_at=excluded.read_at;
  for category in select value from jsonb_array_elements(p_categories) loop
    if jsonb_typeof(category) is distinct from 'object' or nullif(btrim(category->>'name'),'') is null
      or (category->>'distance_km' is not null and not ((category->>'distance_km')::float8>0 and (category->>'distance_km')::float8<'Infinity'::float8)) then raise exception 'Invalid new race category'; end if;
    insert into public.event_categories(event_id,name,distance_km,age_min,age_max,audience)
      values(p_event,category->>'name',(category->>'distance_km')::float8,(category->>'age_min')::int,(category->>'age_max')::int,category->>'audience');
  end loop;
  foreach linked_series in array coalesce(p_secondary,'{}') loop
    perform public.pipeline_attach_event_series(p_event,linked_series,false,'watcher',true);
  end loop;
  return jsonb_build_object('id',p_event,'created',true);
end;
$$;
revoke all on function public.pipeline_create_watcher_event(uuid,jsonb,jsonb,text,text,boolean,jsonb,jsonb,uuid[],jsonb) from public,anon,authenticated;
grant execute on function public.pipeline_create_watcher_event(uuid,jsonb,jsonb,text,text,boolean,jsonb,jsonb,uuid[],jsonb) to service_role;
