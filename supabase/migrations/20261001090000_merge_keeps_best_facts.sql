-- A merge keeps the best of both races, not just the keeper's links.
--
-- app_merge_events moved sources, links and the series across and hid the
-- duplicate. Everything else the duplicate knew — the categories an organiser
-- stated, the discipline, the level, the entry deadline, a geocoded place —
-- was hidden with it. The same race read from the federation and from Sumator
-- kept the federation's empty category list and lost Sumator's full one.
--
-- Now each fact is taken from whichever side holds the better one:
--   categories: stated beats last year's edition beats a guess beats nothing;
--               two stated lists are unioned;
--   everything else: the keeper's value, or the duplicate's where the keeper
--               has none.
-- Manually locked fields are never touched.
--
-- 'previous' is a new provenance for categories: carried from last year's
-- edition of the same race.

alter table public.events drop constraint if exists events_age_confidence_check;
alter table public.events
  add constraint events_age_confidence_check
  check (age_confidence in ('explicit', 'previous', 'default'));

create or replace function public.app_age_rank(ages text[], confidence text)
returns int language sql immutable as $$
  select case
    when coalesce(cardinality(ages), 0) = 0 then 0
    when confidence = 'explicit' then 3
    when confidence = 'previous' then 2
    else 1
  end
$$;

-- Fill `keep_id` from `drop_id` wherever the keeper knows less. Shared by the
-- merge and by the backfill of merges made before this existed.
create or replace function public.app_fill_event_from(keep_id uuid, drop_id uuid)
returns void language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  kept public.events%rowtype;
  dropped public.events%rowtype;
  locked text[];
  kept_rank int;
  dropped_rank int;
  ages text[];
  confidence text;
  aud text;
  kept_geo boolean;
  dropped_geo boolean;
begin
  select * into strict kept from public.events where id = keep_id;
  select * into strict dropped from public.events where id = drop_id;
  select coalesce(locked_fields, '{}') into locked from public.event_overrides where event_id = keep_id;
  locked := coalesce(locked, '{}');

  kept_rank := public.app_age_rank(kept.age_categories, kept.age_confidence);
  dropped_rank := public.app_age_rank(dropped.age_categories, dropped.age_confidence);
  ages := kept.age_categories;
  confidence := kept.age_confidence;
  aud := kept.audience;
  if not ('age_categories' = any(locked)) then
    if kept_rank = 3 and dropped_rank = 3 then
      ages := array(select distinct unnest(kept.age_categories || dropped.age_categories));
    elsif dropped_rank > kept_rank then
      ages := dropped.age_categories;
      confidence := dropped.age_confidence;
      aud := dropped.audience;
    end if;
  end if;

  select exists(select 1 from public.locations where id = kept.location_id and lat is not null)
    into kept_geo;
  select exists(select 1 from public.locations where id = dropped.location_id and lat is not null)
    into dropped_geo;

  update public.events set
    age_categories = ages,
    age_confidence = confidence,
    audience = aud,
    disciplines = case
      when 'disciplines' = any(locked) or coalesce(cardinality(kept.disciplines), 0) > 0 then kept.disciplines
      else dropped.disciplines end,
    formats = case
      when coalesce(cardinality(kept.formats), 0) > 0 then kept.formats
      else dropped.formats end,
    level = case when 'level' = any(locked) then kept.level else coalesce(kept.level, dropped.level) end,
    uci_class = case when 'uci_class' = any(locked) then kept.uci_class else coalesce(kept.uci_class, dropped.uci_class) end,
    class_label = case when 'class_label' = any(locked) then kept.class_label else coalesce(kept.class_label, dropped.class_label) end,
    description = case when 'description' = any(locked) then kept.description else coalesce(kept.description, dropped.description) end,
    registration_opens_at = case when 'registration_opens_at' = any(locked) then kept.registration_opens_at
      else coalesce(kept.registration_opens_at, dropped.registration_opens_at) end,
    registration_closes_at = case when 'registration_closes_at' = any(locked) then kept.registration_closes_at
      else coalesce(kept.registration_closes_at, dropped.registration_closes_at) end,
    website_url = case when 'website_url' = any(locked) then kept.website_url else coalesce(kept.website_url, dropped.website_url) end,
    registration_url = case when 'registration_url' = any(locked) then kept.registration_url else coalesce(kept.registration_url, dropped.registration_url) end,
    regulations_url = case when 'regulations_url' = any(locked) then kept.regulations_url else coalesce(kept.regulations_url, dropped.regulations_url) end,
    results_url = case when 'results_url' = any(locked) then kept.results_url else coalesce(kept.results_url, dropped.results_url) end,
    series_id = case when 'series_id' = any(locked) then kept.series_id else coalesce(kept.series_id, dropped.series_id) end,
    -- A place with coordinates beats one without.
    location_id = case
      when 'location_id' = any(locked) then kept.location_id
      when not kept_geo and dropped_geo then dropped.location_id
      else coalesce(kept.location_id, dropped.location_id) end,
    updated_at = now()
  where id = keep_id;
end;
$$;

create or replace function public.app_merge_events(keep_id uuid, drop_id uuid)
returns uuid language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  kept public.events%rowtype;
  dropped public.events%rowtype;
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

  perform public.app_fill_event_from(keep_id, drop_id);

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

  update public.events set merged_into_id=keep_id where merged_into_id=drop_id;
  update public.events set visibility='hidden',status='hidden',merged_into_id=keep_id,
    fingerprint='merged:'||drop_id::text,updated_at=now() where id=drop_id;
  return keep_id;
end;
$$;

revoke all on function public.app_merge_events(uuid,uuid) from public, anon, authenticated;
grant execute on function public.app_merge_events(uuid,uuid) to service_role;
revoke all on function public.app_fill_event_from(uuid,uuid) from public, anon, authenticated;
grant execute on function public.app_fill_event_from(uuid,uuid) to service_role;

-- Merges made before this: give each keeper what its duplicates knew.
-- Upcoming races only; the past is not worth rewriting.
do $$
declare r record;
begin
  for r in
    select d.merged_into_id as keep_id, d.id as drop_id
    from public.events d
    join public.events k on k.id = d.merged_into_id
    where d.merged_into_id is not null
      and k.merged_into_id is null
      and k.start_date >= current_date
    order by d.updated_at
  loop
    perform public.app_fill_event_from(r.keep_id, r.drop_id);
  end loop;
end $$;
