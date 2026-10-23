-- Keep merged URLs resolvable and make source identity survive a catalog cleanup.
alter table public.events add column if not exists merged_into_id uuid references public.events(id);
create index if not exists events_merged_into_idx on public.events(merged_into_id) where merged_into_id is not null;

-- One database transaction: a failure leaves the entire original plan intact.
-- SECURITY INVOKER and service-role-only execution; never a public write API.
create or replace function public.app_merge_events(keep_id uuid, drop_id uuid)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
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
  -- Copy only missing category descriptions; retain the archived originals.
  insert into public.event_categories(event_id,name,age_min,age_max,distance_km,elevation_m,gender,audience)
    select keep_id,c.name,c.age_min,c.age_max,c.distance_km,c.elevation_m,c.gender,c.audience
    from public.event_categories c where c.event_id=drop_id and not exists(
      select 1 from public.event_categories k where k.event_id=keep_id and k.name=c.name
    );

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

  -- Old delivery/history rows deliberately retain their original event ids.
  -- They are historical evidence, not current attendance.
  update public.events set merged_into_id=keep_id where merged_into_id=drop_id;
  update public.events set visibility='hidden',status='hidden',merged_into_id=keep_id,
    fingerprint='merged:'||drop_id::text,updated_at=now() where id=drop_id;
  return keep_id;
end;
$$;
revoke all on function public.app_merge_events(uuid,uuid) from public, anon, authenticated;
grant execute on function public.app_merge_events(uuid,uuid) to service_role;
