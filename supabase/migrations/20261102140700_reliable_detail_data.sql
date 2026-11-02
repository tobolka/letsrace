-- One commit for the edit, category rows, locks, history and publication task.
-- Service-only; the session user and live claim are checked again in the transaction.
create function public.organizer_apply_edit(
  p_event_id uuid, p_claim_id uuid, p_user_id uuid,
  p_changes jsonb, p_categories jsonb default null
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  c public.organizer_claims; b public.events; a public.events;
  field text; changed_fields text[] := '{}'; changed_values jsonb := '{}';
  previous_categories jsonb; next_categories jsonb; category jsonb;
  category_id uuid; kept_ids uuid[] := '{}'; s_slug text;
begin
  -- Lock order is claim -> event, so a revocation cannot race a save.
  select * into c from public.organizer_claims where id=p_claim_id for share;
  if c.id is null or c.user_id <> p_user_id or c.status <> 'verified' then
    raise exception 'organizer_access_denied' using errcode='42501';
  end if;
  select * into b from public.events where id=p_event_id for update;
  if b.id is null then raise exception 'race_not_found'; end if;
  if c.event_id is distinct from p_event_id and not (
    c.series_id is not null and (c.series_id=b.series_id or exists(
      select 1 from public.event_series where event_id=p_event_id and series_id=c.series_id
    ))
  ) then raise exception 'organizer_access_denied' using errcode='42501'; end if;
  if jsonb_typeof(p_changes) is distinct from 'object' then raise exception 'invalid_changes'; end if;
  for field in select jsonb_object_keys(p_changes) loop
    if not field=any(array['start_date','end_date','status','website_url','registration_url','regulations_url','registration_closes_at','description']) then
      raise exception 'unsupported_field: %',field;
    end if;
  end loop;
  a := jsonb_populate_record(b,p_changes);
  if a.start_date is null or a.end_date<a.start_date then raise exception 'invalid_date_range'; end if;
  if p_changes ? 'status' and a.status not in ('scheduled','postponed','cancelled') then raise exception 'invalid_status'; end if;
  for field in select jsonb_object_keys(p_changes) loop
    if (to_jsonb(b)->field) is not distinct from (to_jsonb(a)->field) then continue; end if;
    changed_fields := array_append(changed_fields,field);
    changed_values := changed_values || jsonb_build_object(field,to_jsonb(a)->field);
    insert into public.organizer_edits(claim_id,user_id,event_id,field,previous,value)
      values(p_claim_id,p_user_id,p_event_id,field,to_jsonb(b)->field,to_jsonb(a)->field);
  end loop;
  if p_categories is not null then
    if jsonb_typeof(p_categories)<>'array' or jsonb_array_length(p_categories)>40 then raise exception 'invalid_categories'; end if;
    select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') into previous_categories from public.event_categories t where event_id=p_event_id;
    for category in select value from jsonb_array_elements(p_categories) loop
      if nullif(btrim(category->>'name'),'') is null or length(category->>'name')>120 or
        (category->>'ageMin')::int<0 or (category->>'ageMin')::int>99 or
        (category->>'ageMax')::int<0 or (category->>'ageMax')::int>99 or
        (category->>'ageMin')::int>(category->>'ageMax')::int or
        (category->>'distanceKm')::float8<=0 or (category->>'distanceKm')::float8>2000 then raise exception 'invalid_category'; end if;
      category_id := null;
      -- Keep existing IDs and attributes this editor does not expose.
      select id into category_id from public.event_categories
        where event_id=p_event_id and name=category->>'name' and not(id=any(kept_ids)) order by id limit 1;
      if category_id is null then
        insert into public.event_categories(event_id,name,distance_km,age_min,age_max)
          values(p_event_id,btrim(category->>'name'),(category->>'distanceKm')::float8,(category->>'ageMin')::int,(category->>'ageMax')::int)
          returning id into category_id;
      else
        update public.event_categories set distance_km=(category->>'distanceKm')::float8,
          age_min=(category->>'ageMin')::int,age_max=(category->>'ageMax')::int where id=category_id;
      end if;
      kept_ids := array_append(kept_ids,category_id);
    end loop;
    delete from public.event_categories where event_id=p_event_id and not(id=any(kept_ids));
    select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') into next_categories from public.event_categories t where event_id=p_event_id;
    if previous_categories is distinct from next_categories then
      changed_fields := array_append(changed_fields,'categories');
      changed_values := changed_values || jsonb_build_object('categories',next_categories);
      insert into public.organizer_edits(claim_id,user_id,event_id,field,previous,value)
        values(p_claim_id,p_user_id,p_event_id,'categories',previous_categories,next_categories);
    end if;
  end if;
  if cardinality(changed_fields)>0 then
    insert into public.event_overrides(event_id,fields,locked_fields,updated_by,updated_at)
      values(p_event_id,changed_values,changed_fields,'organizer',now())
      on conflict(event_id) do update set fields=coalesce(event_overrides.fields,'{}')||excluded.fields,
        locked_fields=array(select distinct unnest(coalesce(event_overrides.locked_fields,'{}')||excluded.locked_fields)),
        updated_by='organizer',updated_at=now();
    -- Categories alone need a new revision too: event triggers otherwise miss them.
    update public.events set start_date=a.start_date,end_date=a.end_date,status=a.status,
      website_url=a.website_url,registration_url=a.registration_url,regulations_url=a.regulations_url,
      registration_closes_at=a.registration_closes_at,description=a.description,
      updated_at=now(), public_revision=gen_random_uuid() where id=p_event_id;
  end if;
  select slug into s_slug from public.series where id=b.series_id;
  return jsonb_build_object('changed',cardinality(changed_fields),'slug',b.slug,'seriesSlug',s_slug);
end $$;
revoke all on function public.organizer_apply_edit(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.organizer_apply_edit(uuid,uuid,uuid,jsonb,jsonb) to service_role;

-- Categories and source links are now public content too. Queue their changes
-- for publication in the same transaction, regardless of which reader wrote them.
create function public.pipeline_detail_child_revision()
returns trigger language plpgsql security invoker set search_path=public as $$
declare old_event uuid; new_event uuid;
begin
  if tg_op<>'INSERT' then old_event:=old.event_id; end if;
  if tg_op<>'DELETE' then new_event:=new.event_id; end if;
  if tg_op='UPDATE' then
    if tg_table_name='event_sources' then
      if (old.event_id,old.source_url,old.kind) is not distinct from (new.event_id,new.source_url,new.kind) then return new; end if;
    end if;
    if to_jsonb(old) is not distinct from to_jsonb(new) then return new; end if;
  end if;
  update public.events set public_revision=gen_random_uuid() where id=new_event or id=old_event;
  return null;
end $$;
create trigger pipeline_category_revision after insert or update or delete on public.event_categories for each row execute function public.pipeline_detail_child_revision();
create trigger pipeline_source_revision after insert or update or delete on public.event_sources for each row execute function public.pipeline_detail_child_revision();
revoke all on function public.pipeline_detail_child_revision() from public,anon,authenticated;
grant execute on function public.pipeline_detail_child_revision() to service_role;

-- Shared historical weather, independent of race IDs and annual editions.
-- Visitors only read summaries; only the bounded server cron calls the archive.
create table public.weather_history (
  lat_cell integer not null check(lat_cell between -9000 and 9000),
  lng_cell integer not null check(lng_cell between -18000 and 18000),
  reference_year integer,
  summaries jsonb not null default '{}' check(jsonb_typeof(summaries)='object'),
  fetched_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  last_error text,
  primary key(lat_cell,lng_cell)
);
create table public.weather_history_attempts (
  token uuid primary key,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error text
);
create index weather_history_attempts_started on public.weather_history_attempts(started_at);
alter table public.weather_history enable row level security;
alter table public.weather_history_attempts enable row level security;
revoke all on public.weather_history,public.weather_history_attempts from public,anon,authenticated;
grant all on public.weather_history,public.weather_history_attempts to service_role;

create function public.weather_history_claim(p_lat integer,p_lng integer,p_year integer,p_days text[])
returns uuid language plpgsql security invoker set search_path=public as $$
declare h public.weather_history; t uuid;
begin
  -- Reservations, including crashed requests, share one daily archive budget.
  perform pg_advisory_xact_lock(hashtext('weather_history_daily'));
  if (select count(*) from public.weather_history_attempts where started_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=12 then return null; end if;
  insert into public.weather_history(lat_cell,lng_cell) values(p_lat,p_lng) on conflict do nothing;
  select * into h from public.weather_history where lat_cell=p_lat and lng_cell=p_lng for update;
  if h.next_attempt_at>now() or h.lease_until>now() or
    (h.reference_year>=p_year and h.summaries ?& p_days) then return null; end if;
  t:=gen_random_uuid();
  update public.weather_history set lease_token=t,lease_until=now()+interval '2 minutes' where lat_cell=p_lat and lng_cell=p_lng;
  insert into public.weather_history_attempts(token) values(t);
  return t;
end $$;

create function public.weather_history_finish(p_lat integer,p_lng integer,p_token uuid,p_year integer,p_summaries jsonb,p_error text default null)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
  if p_error is null and (p_summaries is null or jsonb_typeof(p_summaries)<>'object' or p_summaries='{}') then raise exception 'empty_weather_history'; end if;
  update public.weather_history set
    summaries=case when p_error is not null then summaries when reference_year=p_year then summaries||p_summaries else p_summaries end,
    reference_year=case when p_error is null then p_year else reference_year end,
    fetched_at=case when p_error is null then now() else fetched_at end,
    last_error=p_error,next_attempt_at=case when p_error is null then now() else now()+interval '1 day' end,
    lease_token=null,lease_until=null
    where lat_cell=p_lat and lng_cell=p_lng and lease_token=p_token and lease_until>now();
  if not found then return false; end if;
  update public.weather_history_attempts set finished_at=now(),error=p_error where token=p_token;
  return true;
end $$;
create function public.weather_history_read(p_lat integer,p_lng integer,p_day text)
returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object('climate',summaries->p_day,'updatedAt',fetched_at,'referenceYear',reference_year)
    from public.weather_history where lat_cell=p_lat and lng_cell=p_lng and summaries ? p_day;
$$;
revoke all on function public.weather_history_claim(integer,integer,integer,text[]),public.weather_history_finish(integer,integer,uuid,integer,jsonb,text),public.weather_history_read(integer,integer,text) from public,anon,authenticated;
grant execute on function public.weather_history_claim(integer,integer,integer,text[]),public.weather_history_finish(integer,integer,uuid,integer,jsonb,text),public.weather_history_read(integer,integer,text) to service_role;
