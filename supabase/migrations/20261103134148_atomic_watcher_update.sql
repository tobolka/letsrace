-- Existing-event update and its field history are inseparable. A stale prepared
-- payload must be recomputed, never pasted over a concurrently corrected race.
create function public.pipeline_update_watcher_event(p_event uuid,p_revision uuid,p_patch jsonb,p_evidence jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.events; updated public.events; patch jsonb:=p_patch; locked text[];
  k text; assignments text; constraint_name text; retained boolean:=false; changed boolean:=false;
begin
  if jsonb_typeof(patch) is distinct from 'object' or pg_column_size(patch)>100000 then raise exception 'Invalid watcher patch'; end if;
  if jsonb_typeof(p_evidence) is distinct from 'object' or nullif(p_evidence->>'sourceUrl','') is null then raise exception 'Missing watcher evidence'; end if;
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
  select string_agg(format('%1$I=(jsonb_populate_record(null::public.events,$1)).%1$I',key),',') into assignments from jsonb_object_keys(patch) key;
  if assignments is null then return jsonb_build_object('retainedKey',false,'changed',false,'applied',patch); end if;
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
  for k in select jsonb_object_keys(patch) loop
    if k=any(array['last_seen_at','updated_at','fingerprint','name_normalized']) then continue; end if;
    if coalesce(to_jsonb(e)->k,'null'::jsonb) is distinct from coalesce(to_jsonb(updated)->k,'null'::jsonb) then
      insert into public.event_facts(event_id,field,value,previous,source_url,quote,method,version,model)
        values(p_event,k,to_jsonb(updated)->k,to_jsonb(e)->k,p_evidence->>'sourceUrl',p_evidence->>'quote','watcher_update_v2','pipeline-v2',p_evidence->>'model');
      changed:=true;
    end if;
  end loop;
  return jsonb_build_object('retainedKey',retained,'changed',changed,'applied',patch);
end;
$$;
revoke all on function public.pipeline_update_watcher_event(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.pipeline_update_watcher_event(uuid,uuid,jsonb,jsonb) to service_role;

-- A stale prepared change is retried; it is not a question for the owner.
create or replace function public.pipeline_source_state(p_state text,p_error text)
returns text language sql immutable security invoker set search_path=public,pg_temp as $$
  select case
    when coalesce(p_state,'') not in ('error','needs_review') then 'ok'
    when coalesce(p_error,'') ~ '(provider_deferred:|LLM budget of|Shared LLM budget|calendar_budget_exhausted|calendar_time_budget_exhausted|write_time_budget_exhausted|time budget exceeded|chunk_limit|source_reader_unavailable_or_running|source_changed_before_read|concurrent_event_update)' then 'deferred'
    when p_error in ('unsupported_or_empty_source','low confidence or empty extract','dynamic_render_unavailable')
      or coalesce(p_error,'') ~ '^(source_document_too_large|pdf_has_no_text)' then 'unreadable'
    when coalesce(p_error,'') ~ '(identity_review_required|pipeline_data_review_required)'
      or (p_state='needs_review' and p_error is null) then 'review'
    else 'broken' end;
$$;
