-- A confirmed content mismatch may request one more refresh per revision.
-- The renewal consumes the existing expiration budget, never a direct purge.
create function public.pipeline_retry_publication_check(
  p_key text,p_token uuid,p_revision text,p_error text,p_delay_seconds integer,p_stale boolean
) returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare held public.pipeline_tasks;
begin
  select * into held from public.pipeline_tasks where key=p_key for update;
  if not found or held.kind not in ('public_refresh','series_refresh') then return false; end if;
  if not public.pipeline_retry_task(p_key,p_token,p_error,
    case when held.payload->>'revision' is distinct from p_revision then 60 else p_delay_seconds end)
    then return false; end if;

  if p_stale and held.payload->>'revision'=p_revision
    and not exists(select 1 from public.pipeline_task_attempts where task_key=p_key and result->>'refreshReissuedFor'=p_revision) then
    delete from public.pipeline_refresh_receipts
      where task_key=p_key and revision=p_revision and requested_at<=now()-interval '10 minutes';
    if found then
      update public.pipeline_task_attempts set result=jsonb_build_object('refreshReissuedFor',p_revision) where token=p_token;
      perform public.pipeline_enqueue_expiration();
    end if;
  end if;
  return true;
end;
$$;

revoke execute on function public.pipeline_retry_publication_check(text,uuid,text,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.pipeline_retry_publication_check(text,uuid,text,text,integer,boolean) to service_role;
