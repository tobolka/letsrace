-- Private, transactional recovery points for merges, including user plans.
-- Never expose these snapshots through the public catalogue or anonymous API.
alter table public.ingest_runs add column metrics jsonb not null default '{}'::jsonb;

create table public.pipeline_extraction_cache (
  key text primary key check (key ~ '^[a-f0-9]{64}$'),
  value jsonb not null,
  saved_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index pipeline_extraction_cache_expiry_idx on public.pipeline_extraction_cache(expires_at);
alter table public.pipeline_extraction_cache enable row level security;
revoke all on public.pipeline_extraction_cache from public, anon, authenticated;
grant select, insert, update, delete on public.pipeline_extraction_cache to service_role;

create table public.pipeline_merge_history (
  id uuid primary key default gen_random_uuid(),
  keep_id uuid not null references public.events(id),
  drop_id uuid not null references public.events(id),
  before_state jsonb not null,
  after_state jsonb not null,
  created_at timestamptz not null default now(),
  restored_at timestamptz
);
alter table public.pipeline_merge_history enable row level security;
revoke all on public.pipeline_merge_history from public, anon, authenticated;
grant select, insert, update on public.pipeline_merge_history to service_role;

create function public.app_merge_snapshot(keep_id uuid, drop_id uuid)
returns jsonb language sql security invoker set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'events', (select coalesce(jsonb_agg(to_jsonb(t) order by t.id), '[]') from public.events t
      where t.id in (keep_id,drop_id) or t.merged_into_id in (keep_id,drop_id)),
    'event_sources', (select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]') from public.event_sources t where t.event_id in (keep_id,drop_id)),
    'event_categories', (select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]') from public.event_categories t where t.event_id in (keep_id,drop_id)),
    'event_favorites', (select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]') from public.event_favorites t where t.event_id in (keep_id,drop_id)),
    'event_attendance', (select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]') from public.event_attendance t where t.event_id in (keep_id,drop_id)),
    'event_series', (select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]') from public.event_series t where t.event_id in (keep_id,drop_id)),
    'event_facts', (select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]') from public.event_facts t where t.event_id in (keep_id,drop_id)),
    'event_overrides', (select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text), '[]') from public.event_overrides t where t.event_id in (keep_id,drop_id))
  );
$$;
revoke all on function public.app_merge_snapshot(uuid,uuid) from public, anon, authenticated;
grant execute on function public.app_merge_snapshot(uuid,uuid) to service_role;

-- Keep the existing field selection, locks and personal-plan reconciliation.
create schema if not exists pipeline_private;
revoke all on schema pipeline_private from public, anon, authenticated;
grant usage on schema pipeline_private to service_role;
alter function public.app_merge_events(uuid,uuid) set schema pipeline_private;
alter function pipeline_private.app_merge_events(uuid,uuid) rename to app_merge_events_v1;
revoke all on function pipeline_private.app_merge_events_v1(uuid,uuid) from public, anon, authenticated, service_role;
-- The invoker wrapper must be able to call its implementation.
grant execute on function pipeline_private.app_merge_events_v1(uuid,uuid) to service_role;

create function public.app_merge_events(keep_id uuid, drop_id uuid)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  original jsonb;
begin
  if keep_id = drop_id then raise exception 'Cannot merge a race into itself'; end if;
  if exists(select 1 from public.duplicate_reviews where left_id=least(keep_id,drop_id) and right_id=greatest(keep_id,drop_id)) then
    raise exception 'Pair is reviewed as separate';
  end if;
  perform id from public.events where id in (keep_id,drop_id) or merged_into_id in (keep_id,drop_id) order by id for update;
  if exists(select 1 from public.events where id=drop_id and merged_into_id=keep_id) then return keep_id; end if;
  original := public.app_merge_snapshot(keep_id,drop_id);
  perform pipeline_private.app_merge_events_v1(keep_id,drop_id);
  -- The previous implementation lost secondary cup memberships and left source
  -- evidence attached to the hidden row. Keep both accessible from the keeper.
  insert into public.event_series(event_id,series_id,is_primary,source,created_at,updated_at)
    select keep_id,series_id,false,source,created_at,now() from public.event_series where event_id=drop_id
    on conflict(event_id,series_id) do nothing;
  delete from public.event_series where event_id=drop_id;
  update public.event_facts set event_id=keep_id where event_id=drop_id;
  insert into public.pipeline_merge_history(keep_id,drop_id,before_state,after_state)
    values(keep_id,drop_id,original,public.app_merge_snapshot(keep_id,drop_id));
  return keep_id;
end;
$$;
revoke all on function public.app_merge_events(uuid,uuid) from public, anon, authenticated;
grant execute on function public.app_merge_events(uuid,uuid) to service_role;

-- Restore only when nothing covered by the snapshot changed since the merge.
-- Refuse a stale restore rather than overwriting later edits or new plans.
create function public.app_restore_event_merge(history_id uuid)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  h public.pipeline_merge_history%rowtype;
  row_data jsonb;
  relation_name text;
  column_list text;
begin
  select * into strict h from public.pipeline_merge_history where id=history_id for update;
  if h.restored_at is not null then raise exception 'Merge already restored'; end if;
  perform id from public.events where id in (h.keep_id,h.drop_id) or merged_into_id in (h.keep_id,h.drop_id) order by id for update;
  if public.app_merge_snapshot(h.keep_id,h.drop_id) <> h.after_state then
    raise exception 'Merge state changed; manual reconciliation required';
  end if;
  -- Update existing event rows, retaining every historical foreign-key target.
  -- Skip generated columns such as search_text; PostgreSQL recomputes them.
  select string_agg(quote_ident(column_name), ',' order by ordinal_position) into column_list
    from information_schema.columns where table_schema='public' and table_name='events'
      and is_generated='NEVER' and is_identity='NO' and column_name <> 'id';
  for row_data in select value from jsonb_array_elements(h.before_state->'events') loop
    execute format('update public.events set (%1$s) = (select %1$s from jsonb_populate_record(null::public.events,$1)) where id=$2',column_list)
      using row_data,(row_data->>'id')::uuid;
  end loop;
  -- Restore all affected relationships, including values reconciled by the merge.
  foreach relation_name in array array['event_sources','event_categories','event_favorites','event_attendance','event_series','event_facts'] loop
    execute format('delete from public.%I where event_id in ($1,$2)',relation_name) using h.keep_id,h.drop_id;
    execute format('insert into public.%1$I select * from jsonb_populate_recordset(null::public.%1$I,$1)',relation_name)
      using h.before_state->relation_name;
  end loop;
  update public.pipeline_merge_history set restored_at=now() where id=history_id;
  return h.drop_id;
end;
$$;
revoke all on function public.app_restore_event_merge(uuid) from public, anon, authenticated;
grant execute on function public.app_restore_event_merge(uuid) to service_role;
