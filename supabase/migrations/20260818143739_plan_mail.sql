-- Plan-change notices from watcher diffs, Friday digest, and mail toggles.

alter table public.profiles
  add column if not exists plan_mail boolean not null default true,
  add column if not exists digest_mail boolean not null default true,
  add column if not exists locale text not null default 'cs';

create table if not exists public.event_plan_changes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null,
  fingerprint text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (event_id, kind, fingerprint),
  constraint event_plan_changes_kind_chk check (
    kind in ('date', 'cancelled', 'registration', 'discipline')
  )
);

create table if not exists public.plan_change_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  change_id uuid not null references public.event_plan_changes(id) on delete cascade,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, change_id)
);

create table if not exists public.plan_digest_deliveries (
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_key text not null,
  emailed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, week_key)
);

create index if not exists event_plan_changes_created_at_idx
  on public.event_plan_changes (created_at desc);
create index if not exists plan_change_deliveries_user_id_idx
  on public.plan_change_deliveries (user_id);

alter table public.event_plan_changes enable row level security;
alter table public.plan_change_deliveries enable row level security;
alter table public.plan_digest_deliveries enable row level security;
