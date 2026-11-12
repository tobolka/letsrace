create or replace function public.pipeline_claim_tasks(p_kind text,p_capabilities text[],p_limit integer default 10)
returns setof public.pipeline_tasks language plpgsql security invoker set search_path=public,pg_temp as $$
declare take integer:=greatest(0,least(p_limit,100));
begin
  if p_kind in ('public_refresh','series_refresh') then
    perform pg_advisory_xact_lock(hashtextextended('pipeline-publication-budget',0));
    select greatest(0,least(take,60-count(*)::integer)) into take from public.pipeline_task_attempts
      where kind in ('public_refresh','series_refresh') and started_at>=date_trunc('day',now());
  end if;
  if p_kind='catalogue_refresh' then
    perform pg_advisory_xact_lock(hashtextextended('pipeline-catalogue-budget',0));
    take:=least(take,1);
    if exists(select 1 from public.pipeline_task_attempts where kind=p_kind and started_at>now()-interval '6 hours')
      or (select count(*) from public.pipeline_task_attempts where kind=p_kind and started_at>now()-interval '24 hours')>=4 then take:=0; end if;
  end if;
  if p_kind='public_expire' then
    perform pg_advisory_xact_lock(hashtextextended('pipeline-expiration-budget',0));
    take:=least(take,1);
    -- Tag expiration does not load pages or consume the separate verification budget.
    if exists(select 1 from public.pipeline_task_attempts where kind=p_kind and started_at>now()-interval '1 hour') then take:=0; end if;
  end if;
  return query with chosen as materialized (
    select key,token from public.pipeline_tasks
    where kind=p_kind and capability=any(p_capabilities)
      and (p_kind not in ('public_refresh','series_refresh') or exists (
        select 1 from public.pipeline_refresh_receipts receipt
        where receipt.task_key=pipeline_tasks.key and receipt.revision=pipeline_tasks.payload->>'revision'
      ))
      and ((status='pending' and available_at<=now()) or (status='running' and lease_until<=now()))
    order by priority desc,available_at,created_at,key
    for update skip locked limit take
  ), expired as (
    update public.pipeline_task_attempts set outcome='lease_expired',finished_at=now()
    where token in(select token from chosen) and finished_at is null returning token
  ), claimed as (
    update public.pipeline_tasks t set status='running',token=gen_random_uuid(),lease_until=now()+interval '5 minutes',
    attempts=attempts+1,updated_at=now()
    from chosen c where t.key=c.key returning t.*
  ), logged as (
    insert into public.pipeline_task_attempts(token,task_key,kind) select token,key,kind from claimed returning token
  ) select c.* from claimed c join logged l using(token);
end;
$$;
