-- Stage dependencies until after the revision check; own changes are not concurrent edits.
-- Existing-event update and its field history are inseparable. A stale prepared
-- payload must be recomputed, never pasted over a concurrently corrected race.
create or replace function public.pipeline_update_watcher_event(p_event uuid,p_revision uuid,p_patch jsonb,p_evidence jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.events; updated public.events; patch jsonb:=p_patch; locked text[];
  location_plan jsonb:=p_evidence->'location'; location_row jsonb; loc public.locations; sid text; attached jsonb;
  lease public.pipeline_tasks; watched public.watched_urls; lease_plan jsonb:=p_evidence->'lease';
  k text; assignments text; constraint_name text; retained boolean:=false; changed boolean:=false;
begin
  if jsonb_typeof(patch) is distinct from 'object' or pg_column_size(patch)>100000 then raise exception 'Invalid watcher patch'; end if;
  if jsonb_typeof(p_evidence) is distinct from 'object' or nullif(p_evidence->>'sourceUrl','') is null then raise exception 'Missing watcher evidence'; end if;
  if lease_plan is not null and lease_plan<>'null'::jsonb then
    select * into watched from public.watched_urls where id=(split_part(lease_plan->>'key',':',2))::uuid for share;
    if not found or watched.status<>'active' or watched.url is distinct from lease_plan->>'url'
      or (p_evidence->>'sourceKind' is not null and watched.kind is distinct from p_evidence->>'sourceKind') then
      raise exception 'source_reader_unavailable_or_running: source changed before update';
    end if;
    select * into lease from public.pipeline_tasks where key=lease_plan->>'key' for update;
    if not found or lease.kind<>'source_read' or lease.status<>'running' or lease.token is distinct from (lease_plan->>'token')::uuid
      or lease.lease_until is null or lease.lease_until<=clock_timestamp() then raise exception 'source_reader_unavailable_or_running: source lease lost before update'; end if;
  end if;
  -- Shared location writers take the location before the event. Match that order.
  if location_plan->>'action'='geocode' then select * into loc from public.locations where id=(location_plan->>'id')::uuid for update; end if;
  select * into e from public.events where id=p_event for update;
  if not found or e.merged_into_id is not null then raise exception 'identity_review_required: matched race missing or merged'; end if;
  if p_revision is null or e.public_revision is distinct from p_revision then raise exception 'concurrent_event_update: race changed before write'; end if;
  select locked_fields into locked from public.event_overrides where event_id=p_event for share;
  foreach k in array coalesce(locked,'{}') loop patch:=patch-k; end loop;
  if coalesce(locked,'{}') && array['name','start_date','location_id'] then patch:=patch-'fingerprint'; end if;
  if 'name'=any(coalesce(locked,'{}')) then patch:=patch-'name_normalized'; end if;
  if 'start_date'=any(coalesce(locked,'{}')) then patch:=patch-'season'; end if;
  for k in select jsonb_object_keys(patch) loop
    if not k=any(array['name','name_normalized','start_date','end_date','disciplines','formats','audience','age_categories','age_confidence','event_type','competition_type','season','timezone','fingerprint','registration_opens_at','registration_closes_at','source_kind','level','class_label','uci_class','last_seen_at','updated_at','visibility','status','description','website_url','registration_url','regulations_url','results_url','location_id','series_id']) then raise exception 'Unsupported watcher field: %',k; end if;
  end loop;
  if patch->>'location_id' is not null and not ('location_id'=any(coalesce(locked,'{}'))) and location_plan is not null and location_plan<>'null'::jsonb then
    if location_plan->>'action'='create' then
      location_row:=location_plan->'row';
      if location_row->>'id' is distinct from patch->>'location_id' then raise exception 'Location does not match race update'; end if;
      insert into public.locations(id,name,municipality,country_code,lat,lng,geocode_query,geocode_status,timezone)
        values((location_row->>'id')::uuid,location_row->>'name',location_row->>'municipality',location_row->>'country_code',
          (location_row->>'lat')::float8,(location_row->>'lng')::float8,location_row->>'geocode_query',location_row->>'geocode_status',location_row->>'timezone');
      if location_row->>'lat' is not null and location_row->>'lng' is not null then perform public.set_location_geog((location_row->>'id')::uuid,(location_row->>'lng')::float8,(location_row->>'lat')::float8); end if;
    elsif location_plan->>'action'='geocode' then
      if location_plan->>'id' is distinct from patch->>'location_id' or loc.id is null or loc.lat is distinct from (location_plan->>'expectedLat')::float8 or loc.lng is distinct from (location_plan->>'expectedLng')::float8 then
        raise exception 'concurrent_event_update: location changed before race update';
      end if;
      if loc.lat is not null or location_plan->>'lat' is null or location_plan->>'lng' is null then raise exception 'Invalid geocode fill'; end if;
      update public.locations set lat=(location_plan->>'lat')::float8,lng=(location_plan->>'lng')::float8,geocode_status='ok',updated_at=now() where id=loc.id;
      perform public.set_location_geog(loc.id,(location_plan->>'lng')::float8,(location_plan->>'lat')::float8);
      changed:=true;
    else raise exception 'Invalid update location plan'; end if;
  end if;
  select string_agg(format('%1$I=(jsonb_populate_record(null::public.events,$1)).%1$I',key),',') into assignments from jsonb_object_keys(patch) key;
  if assignments is null then updated:=e; else
  begin
    execute format('update public.events set %s where id=$2 returning *',assignments) into updated using patch,p_event;
  exception when unique_violation then
    get stacked diagnostics constraint_name=constraint_name;
    if constraint_name<>'events_fingerprint_key' or not patch ? 'fingerprint' then raise; end if;
    patch:=patch-'fingerprint'; retained:=true;
    select string_agg(format('%1$I=(jsonb_populate_record(null::public.events,$1)).%1$I',key),',') into assignments from jsonb_object_keys(patch) key;
    if assignments is null then updated:=e;
    else execute format('update public.events set %s where id=$2 returning *',assignments) into updated using patch,p_event;
    end if;
  end;
  end if;
  for k in select jsonb_object_keys(patch) loop
    if k=any(array['last_seen_at','updated_at','fingerprint','name_normalized']) then continue; end if;
    if coalesce(to_jsonb(e)->k,'null'::jsonb) is distinct from coalesce(to_jsonb(updated)->k,'null'::jsonb) then
      insert into public.event_facts(event_id,field,value,previous,source_url,quote,method,version,model)
        values(p_event,k,to_jsonb(updated)->k,to_jsonb(e)->k,p_evidence->>'sourceUrl',p_evidence->>'quote','watcher_update_v2','pipeline-v2',p_evidence->>'model');
      changed:=true;
    end if;
  end loop;
  for sid in select jsonb_array_elements_text(coalesce(p_evidence->'secondarySeries','[]'::jsonb)) loop
    attached:=public.pipeline_attach_event_series(p_event,sid::uuid,false,'watcher',true);
    changed:=changed or attached->>'status'='attached';
  end loop;
  return jsonb_build_object('retainedKey',retained,'changed',changed,'applied',patch);
end;
$$;
revoke all on function public.pipeline_update_watcher_event(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.pipeline_update_watcher_event(uuid,uuid,jsonb,jsonb) to service_role;

