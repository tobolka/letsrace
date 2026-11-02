-- Refresh each period independently and retain its last successful snapshot.
create or replace function public.weather_history_claim(p_lat integer,p_lng integer,p_year integer,p_days text[])
returns uuid language plpgsql security invoker set search_path=public as $$
declare h public.weather_history; t uuid;
begin
  -- Reservations, including crashed requests, share one daily archive budget.
  perform pg_advisory_xact_lock(hashtext('weather_history_daily'));
  if (select count(*) from public.weather_history_attempts where started_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')>=12 then return null; end if;
  insert into public.weather_history(lat_cell,lng_cell) values(p_lat,p_lng) on conflict do nothing;
  select * into h from public.weather_history where lat_cell=p_lat and lng_cell=p_lng for update;
  if h.next_attempt_at>now() or h.lease_until>now() or
    not exists(select 1 from unnest(p_days) as d where not(h.summaries ? d)
      or coalesce((h.summaries->d->>'referenceYear')::integer,h.reference_year,0)<p_year) then return null; end if;
  t:=gen_random_uuid();
  update public.weather_history set lease_token=t,lease_until=now()+interval '2 minutes' where lat_cell=p_lat and lng_cell=p_lng;
  insert into public.weather_history_attempts(token) values(t);
  return t;
end $$;

create or replace function public.weather_history_finish(p_lat integer,p_lng integer,p_token uuid,p_year integer,p_summaries jsonb,p_error text default null)
returns boolean language plpgsql security invoker set search_path=public as $$
begin
  if p_error is null and (p_summaries is null or jsonb_typeof(p_summaries)<>'object' or p_summaries='{}') then raise exception 'empty_weather_history'; end if;
  update public.weather_history set
    summaries=case when p_error is not null then summaries else summaries||p_summaries end,
    reference_year=case when p_error is null then p_year else reference_year end,
    fetched_at=case when p_error is null then now() else fetched_at end,
    last_error=p_error,next_attempt_at=case when p_error is null then now() else now()+interval '1 day' end,
    lease_token=null,lease_until=null
    where lat_cell=p_lat and lng_cell=p_lng and lease_token=p_token and lease_until>now();
  if not found then return false; end if;
  update public.weather_history_attempts set finished_at=now(),error=p_error where token=p_token;
  return true;
end $$;

create or replace function public.weather_history_read(p_lat integer,p_lng integer,p_day text)
returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object('climate',summaries->p_day,'updatedAt',fetched_at,'referenceYear',coalesce((summaries->p_day->>'referenceYear')::integer,reference_year))
    from public.weather_history where lat_cell=p_lat and lng_cell=p_lng and summaries ? p_day;
$$;
