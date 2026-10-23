-- One race may score in several series (ČP Enduro inside Czech Enduro Series,
-- a KPŽ partner round that also counts for Prima, …). events.series_id stays
-- the primary badge for the UI; event_series holds every membership.

create table if not exists public.event_series (
  event_id uuid not null references public.events(id) on delete cascade,
  series_id uuid not null references public.series(id) on delete cascade,
  is_primary boolean not null default false,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, series_id)
);

create unique index if not exists event_series_one_primary_idx
  on public.event_series (event_id)
  where is_primary;

create index if not exists event_series_series_id_idx
  on public.event_series (series_id);

alter table public.event_series enable row level security;

drop policy if exists event_series_public_read on public.event_series;
create policy event_series_public_read on public.event_series
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.visibility = 'public'
    )
  );

-- Existing catalogue: every series_id is the primary membership.
insert into public.event_series (event_id, series_id, is_primary, source)
select e.id, e.series_id, true, 'backfill'
from public.events e
where e.series_id is not null
  and e.merged_into_id is null
on conflict (event_id, series_id) do update
  set is_primary = excluded.is_primary,
      updated_at = now();

-- Keep the primary flag in step with events.series_id writes.
create or replace function public.sync_event_series_primary()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.series_id is null then
    update public.event_series
      set is_primary = false, updated_at = now()
      where event_id = new.id and is_primary;
    return new;
  end if;

  update public.event_series
    set is_primary = false, updated_at = now()
    where event_id = new.id and is_primary and series_id is distinct from new.series_id;

  insert into public.event_series (event_id, series_id, is_primary, source)
  values (new.id, new.series_id, true, coalesce(current_setting('app.event_series_source', true), 'series_id'))
  on conflict (event_id, series_id) do update
    set is_primary = true, updated_at = now();

  return new;
end;
$$;

drop trigger if exists events_sync_event_series_primary on public.events;
create trigger events_sync_event_series_primary
  after insert or update of series_id on public.events
  for each row
  execute function public.sync_event_series_primary();

-- Merges must carry every membership across, not just the primary badge.
create or replace function public.app_merge_events(keep_id uuid, drop_id uuid)
returns uuid
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  kept public.events%rowtype;
  dropped public.events%rowtype;
  locked text[];
begin
  if keep_id = drop_id then raise exception 'Cannot merge a race into itself'; end if;
  perform id from public.events where id in (keep_id, drop_id) order by id for update;
  select * into strict kept from public.events where id=keep_id;
  select * into strict dropped from public.events where id=drop_id;
  if dropped.merged_into_id = keep_id then return keep_id; end if;
  if kept.merged_into_id is not null or dropped.merged_into_id is not null then
    raise exception 'Resolve the canonical race before merging';
  end if;
  if exists(select 1 from public.event_overrides where event_id=drop_id and cardinality(locked_fields)>0) then
    raise exception 'Resolve manually locked fields on the duplicate first';
  end if;
  select coalesce(locked_fields, '{}') into locked from public.event_overrides where event_id=keep_id;
  locked := coalesce(locked, '{}');

  update public.events set
    website_url=case when 'website_url'=any(locked) then kept.website_url else coalesce(kept.website_url,dropped.website_url) end,
    registration_url=case when 'registration_url'=any(locked) then kept.registration_url else coalesce(kept.registration_url,dropped.registration_url) end,
    regulations_url=case when 'regulations_url'=any(locked) then kept.regulations_url else coalesce(kept.regulations_url,dropped.regulations_url) end,
    results_url=case when 'results_url'=any(locked) then kept.results_url else coalesce(kept.results_url,dropped.results_url) end,
    series_id=case when 'series_id'=any(locked) then kept.series_id else coalesce(kept.series_id,dropped.series_id) end,
    updated_at=now()
  where id=keep_id;

  update public.event_sources set event_id=keep_id where event_id=drop_id;

  insert into public.event_categories(event_id,name,age_min,age_max,distance_km,elevation_m,gender,audience)
    select keep_id,c.name,c.age_min,c.age_max,c.distance_km,c.elevation_m,c.gender,c.audience
    from public.event_categories c where c.event_id=drop_id and not exists(
      select 1 from public.event_categories k where k.event_id=keep_id and k.name=c.name
    );

  -- Secondary series on the duplicate become additional memberships on the keeper.
  insert into public.event_series(event_id, series_id, is_primary, source, created_at, updated_at)
    select keep_id, es.series_id, false, coalesce(es.source, 'merge'), es.created_at, now()
    from public.event_series es
    where es.event_id = drop_id
  on conflict (event_id, series_id) do nothing;
  delete from public.event_series where event_id = drop_id;

  insert into public.event_favorites(user_id,event_id,created_at,fee_amount)
    select user_id,keep_id,created_at,fee_amount from public.event_favorites where event_id=drop_id
    on conflict(user_id,event_id) do update set fee_amount=coalesce(event_favorites.fee_amount,excluded.fee_amount);
  delete from public.event_favorites where event_id=drop_id;

  insert into public.event_attendance(user_id,event_id,member_id,status,registered,paid,notes,created_at,updated_at)
    select user_id,keep_id,member_id,status,registered,paid,notes,created_at,now()
    from public.event_attendance where event_id=drop_id
    on conflict(user_id,event_id,member_id) do update set
      status=case when event_attendance.status='going' or excluded.status='going' then 'going' else event_attendance.status end,
      registered=event_attendance.registered or excluded.registered or event_attendance.paid or excluded.paid,
      paid=event_attendance.paid or excluded.paid,
      notes=case when event_attendance.notes is not distinct from excluded.notes then event_attendance.notes else nullif(concat_ws(E'\n',event_attendance.notes,excluded.notes),'') end,
      updated_at=now();
  delete from public.event_attendance where event_id=drop_id;

  update public.events set merged_into_id=keep_id where merged_into_id=drop_id;
  update public.events set visibility='hidden',status='hidden',merged_into_id=keep_id,
    fingerprint='merged:'||drop_id::text,updated_at=now() where id=drop_id;
  return keep_id;
end;
$$;

revoke all on function public.app_merge_events(uuid,uuid) from public, anon, authenticated;
grant execute on function public.app_merge_events(uuid,uuid) to service_role;
