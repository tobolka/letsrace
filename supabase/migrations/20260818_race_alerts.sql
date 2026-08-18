-- Nearby-race email/in-app alerts: place + radius + disciplines.

create table if not exists public.race_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  label text not null default '',
  lat double precision not null,
  lng double precision not null,
  radius_km integer not null default 80,
  disciplines text[] not null default '{}',
  locale text not null default 'cs',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint race_alerts_radius_chk check (radius_km >= 10 and radius_km <= 400)
);

create table if not exists public.race_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.race_alerts(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  distance_km double precision,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (alert_id, event_id)
);

create index if not exists race_alerts_user_id_idx on public.race_alerts (user_id);
create index if not exists race_alert_deliveries_alert_id_idx on public.race_alert_deliveries (alert_id);

alter table public.race_alerts enable row level security;
alter table public.race_alert_deliveries enable row level security;

create policy "race_alerts_own"
  on public.race_alerts
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "race_alert_deliveries_own_select"
  on public.race_alert_deliveries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.race_alerts a
      where a.id = race_alert_deliveries.alert_id
        and a.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.race_alerts to authenticated;
grant select on public.race_alert_deliveries to authenticated;
