-- Organisers take over their race or series: a claim per user and target,
-- verified at once when the account's email is on the race website's domain,
-- otherwise approved by hand. Only the server writes here (service role);
-- an organiser reads their own claims and edits.

create table public.organizer_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  series_id uuid references public.series(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected', 'revoked')),
  method text check (method in ('email_domain', 'manual')),
  contact_email text not null,
  note text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint organizer_claims_one_target check ((event_id is null) <> (series_id is null))
);

create unique index organizer_claims_user_event on public.organizer_claims (user_id, event_id) where event_id is not null;
create unique index organizer_claims_user_series on public.organizer_claims (user_id, series_id) where series_id is not null;
create index organizer_claims_event on public.organizer_claims (event_id) where event_id is not null;
create index organizer_claims_series on public.organizer_claims (series_id) where series_id is not null;
create index organizer_claims_pending on public.organizer_claims (created_at) where status = 'pending';

alter table public.organizer_claims enable row level security;
create policy organizer_claims_own_select on public.organizer_claims
  for select to authenticated using ((select auth.uid()) = user_id);

-- Every change an organiser makes, with what it replaced, so it can be undone.
create table public.organizer_edits (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.organizer_claims(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  field text not null,
  previous jsonb,
  value jsonb,
  created_at timestamptz not null default now()
);

create index organizer_edits_event on public.organizer_edits (event_id, created_at desc);
create index organizer_edits_claim on public.organizer_edits (claim_id);
create index organizer_edits_user on public.organizer_edits (user_id);

alter table public.organizer_edits enable row level security;
create policy organizer_edits_own_select on public.organizer_edits
  for select to authenticated using ((select auth.uid()) = user_id);

-- The public badge: set while a verified claim stands.
alter table public.events add column organizer_verified_at timestamptz;
alter table public.series add column organizer_verified_at timestamptz;
