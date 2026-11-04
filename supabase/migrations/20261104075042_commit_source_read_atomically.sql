-- Due selection is read-only. The source lease is the only reservation.
create function public.pipeline_claim_source_read(p_source uuid,p_capabilities text[],p_due_before timestamptz default null,p_expected_revision timestamptz default null)
returns setof public.pipeline_tasks language plpgsql security invoker set search_path=public,pg_temp as $$
declare source public.watched_urls; held public.pipeline_tasks;
begin
  select * into source from public.watched_urls where id=p_source for update;
  if not found or source.status<>'active'
    or (p_expected_revision is not null and source.updated_at is distinct from p_expected_revision)
    or (p_due_before is not null and source.next_poll_at>p_due_before) then return; end if;
  if p_due_before is not null and exists (select 1 from public.pipeline_tasks where key='source:'||p_source and available_at>p_due_before) then return; end if;
  select * into held from public.pipeline_claim_source(p_source,p_capabilities);
  if not found then return; end if;
  held.payload:=held.payload || jsonb_build_object('sourceRevision',source.updated_at);
  return next held;
end;
$$;

create function public.pipeline_commit_source_read(
  p_key text,p_token uuid,p_url text,p_revision timestamptz,
  p_run uuid,p_patch jsonb,p_run_result jsonb,p_result jsonb
) returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare source public.watched_urls; held public.pipeline_tasks; patch public.watched_urls; receipt public.ingest_runs;
begin
  -- Same lock order as the source trigger and calendar freshness writer.
  select * into source from public.watched_urls where id=(select entity_id from public.pipeline_tasks where key=p_key) for update;
  if not found then return false; end if;
  select * into held from public.pipeline_tasks where key=p_key for update;
  if not found or held.entity_id is distinct from source.id or held.kind<>'source_read'
    or held.status<>'running' or p_token is null or held.token is distinct from p_token
    or held.lease_until is null or held.lease_until<=clock_timestamp() then return false; end if;
  if source.status<>'active' or source.url is distinct from p_url or p_revision is null
    or source.updated_at is distinct from p_revision then
    perform public.pipeline_finish_source(p_key,p_token,source.url,jsonb_build_object('ok',false,'error','source_changed_before_read'));
    update public.pipeline_task_attempts set outcome='superseded' where token=p_token;
    return false;
  end if;

  patch:=jsonb_populate_record(source,p_patch);
  if patch.status not in ('active','dead') then raise exception 'Invalid source read status'; end if;
  receipt:=jsonb_populate_record(null::public.ingest_runs,p_run_result);
  update public.ingest_runs set finished_at=clock_timestamp(),ok=receipt.ok,error=receipt.error,
    events_upserted=receipt.events_upserted,links_discovered=receipt.links_discovered,
    strategy=receipt.strategy,http_status=receipt.http_status,metrics=receipt.metrics
    where id=p_run and watched_url_id=source.id and finished_at is null;
  if not found then raise exception 'Source read receipt missing or already closed'; end if;

  update public.watched_urls set status=patch.status,next_poll_at=patch.next_poll_at,
    calendar_write_progress=patch.calendar_write_progress,content_hash=patch.content_hash,
    etag=patch.etag,last_modified=patch.last_modified,http_status=patch.http_status,
    last_error=patch.last_error,last_extract_status=patch.last_extract_status,
    last_fetched_at=patch.last_fetched_at,last_changed_at=patch.last_changed_at,updated_at=clock_timestamp()
    where id=source.id;
  if not public.pipeline_finish_source(p_key,p_token,p_url,p_result) then
    raise exception 'source_reader_unavailable_or_running: source lease lost at completion';
  end if;
  return true;
end;
$$;

revoke execute on function public.pipeline_claim_source_read(uuid,text[],timestamptz,timestamptz),
  public.pipeline_commit_source_read(text,uuid,text,timestamptz,uuid,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.pipeline_claim_source_read(uuid,text[],timestamptz,timestamptz),
  public.pipeline_commit_source_read(text,uuid,text,timestamptz,uuid,jsonb,jsonb,jsonb) to service_role;
