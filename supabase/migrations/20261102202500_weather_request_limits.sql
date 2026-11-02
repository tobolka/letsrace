-- Real provider requests, shared by web forecasts, server jobs and the Mac.
create table public.weather_provider_requests (
  token uuid primary key default gen_random_uuid(),
  provider text not null check(provider in ('open-meteo','visual-crossing')),
  units integer not null check(units between 1 and 1000),
  history boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  http_status integer
);
create index weather_provider_requests_started on public.weather_provider_requests(started_at);
create table public.weather_provider_usage (
  provider text not null,
  grain text not null check(grain in ('minute','day')),
  period timestamptz not null,
  requests integer not null default 0,
  units integer not null default 0,
  primary key(provider,grain,period)
);
create table public.weather_provider_backoff (
  provider text primary key,
  until_at timestamptz not null default '-infinity',
  pruned_at timestamptz not null default '-infinity'
);
alter table public.weather_provider_requests enable row level security;
alter table public.weather_provider_usage enable row level security;
alter table public.weather_provider_backoff enable row level security;
revoke all on public.weather_provider_requests,public.weather_provider_usage,public.weather_provider_backoff from public,anon,authenticated;
grant all on public.weather_provider_requests,public.weather_provider_usage,public.weather_provider_backoff to service_role;

create function public.weather_provider_claim(p_provider text,p_units integer default 1,p_history boolean default false)
returns uuid language plpgsql security invoker set search_path=public as $$
declare
  t timestamptz:=clock_timestamp(); token uuid; b public.weather_provider_backoff;
  r_min bigint; r_hour bigint; r_day bigint; r_month bigint;
  u_min bigint; u_hour bigint; u_day bigint; u_month bigint;
begin
  if p_provider is null or p_provider not in ('open-meteo','visual-crossing') or p_units is null or p_units<1 or p_units>1000 then raise exception 'invalid_weather_provider_request'; end if;
  perform pg_advisory_xact_lock(hashtextextended('weather-provider:'||p_provider,0));
  insert into public.weather_provider_backoff(provider) values(p_provider) on conflict do nothing;
  select * into b from public.weather_provider_backoff where provider=p_provider;
  if b.until_at>t then return null; end if;
  if b.pruned_at<t-interval '1 day' then
    delete from public.weather_provider_requests where provider=p_provider and started_at<t-interval '35 days';
    delete from public.weather_provider_usage where provider=p_provider and period<t-interval '35 days';
    update public.weather_provider_backoff set pruned_at=t where provider=p_provider;
  end if;
  -- Minute buckets include the partial oldest bucket: conservatively cover rolling windows.
  select
    coalesce(sum(requests) filter(where period>=date_trunc('minute',t-interval '1 minute')),0),
    coalesce(sum(requests) filter(where period>=date_trunc('minute',t-interval '1 hour')),0),
    coalesce(sum(requests),0),
    coalesce(sum(units) filter(where period>=date_trunc('minute',t-interval '1 minute')),0),
    coalesce(sum(units) filter(where period>=date_trunc('minute',t-interval '1 hour')),0),
    coalesce(sum(units),0)
    into r_min,r_hour,r_day,u_min,u_hour,u_day
    from public.weather_provider_usage where provider=p_provider and grain='minute' and period>=date_trunc('minute',t-interval '1 day');
  select coalesce(sum(requests),0),coalesce(sum(units),0) into r_month,u_month
    from public.weather_provider_usage where provider=p_provider and grain='day' and period>=date_trunc('month',t at time zone 'UTC') at time zone 'UTC';
  -- Open-Meteo limits leave headroom below the published 600/5000/10000/300000 caps.
  if p_provider='open-meteo' and (u_min+p_units>500 or u_hour+p_units>4500 or u_day+p_units>9000 or u_month+p_units>270000 or (p_history and u_day+p_units>7500)) then return null; end if;
  -- Self-imposed anonymous-fallback caps, not a promise about its unpublished allowance.
  if p_provider='visual-crossing' and (r_min+1>10 or r_hour+1>60 or r_day+1>200 or r_month+1>6000 or u_day+p_units>900 or u_month+p_units>27000 or (p_history and u_day+p_units>700)) then return null; end if;
  insert into public.weather_provider_usage(provider,grain,period,requests,units)
    values(p_provider,'minute',date_trunc('minute',t),1,p_units),
          (p_provider,'day',date_trunc('day',t at time zone 'UTC') at time zone 'UTC',1,p_units)
    on conflict(provider,grain,period) do update set requests=weather_provider_usage.requests+1,units=weather_provider_usage.units+excluded.units;
  insert into public.weather_provider_requests(provider,units,history,started_at) values(p_provider,p_units,p_history,t) returning weather_provider_requests.token into token;
  return token;
end $$;

create function public.weather_provider_finish(p_token uuid,p_status integer)
returns void language plpgsql security invoker set search_path=public as $$
declare provider_name text; delay interval;
begin
  update public.weather_provider_requests set finished_at=clock_timestamp(),http_status=p_status where token=p_token and finished_at is null returning provider into provider_name;
  if provider_name is null then return; end if;
  delay:=case when p_status=429 then interval '6 hours' when p_status=0 or p_status>=500 then interval '10 minutes' else interval '0' end;
  if delay>interval '0' then
    perform pg_advisory_xact_lock(hashtextextended('weather-provider:'||provider_name,0));
    update public.weather_provider_backoff set until_at=greatest(until_at,clock_timestamp()+delay) where provider=provider_name;
  end if;
end $$;
revoke all on function public.weather_provider_claim(text,integer,boolean),public.weather_provider_finish(uuid,integer) from public,anon,authenticated;
grant execute on function public.weather_provider_claim(text,integer,boolean),public.weather_provider_finish(uuid,integer) to service_role;
