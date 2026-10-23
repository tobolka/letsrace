-- Two races at one venue, on one day, in one discipline are suspicious and not
-- much more than that: run over the whole catalogue the rule pairs eighty
-- listings and only about half are real. Merging on it would quietly destroy
-- races, so the pairs go to a person instead — and a person's answer has to
-- stick, or the same forty non-duplicates come back every morning.
--
-- Keyed by the two event ids in a fixed order, so the pair has one row however
-- it is discovered.

create table if not exists public.duplicate_reviews (
  id uuid primary key default gen_random_uuid(),
  left_id uuid not null references public.events(id) on delete cascade,
  right_id uuid not null references public.events(id) on delete cascade,
  -- 'separate' — looked at, genuinely two races, stop showing me.
  verdict text not null check (verdict in ('separate')),
  note text,
  created_at timestamptz not null default now(),
  unique (left_id, right_id),
  constraint duplicate_reviews_ordered check (left_id < right_id)
);

create index if not exists duplicate_reviews_left_idx
  on public.duplicate_reviews (left_id);

alter table public.duplicate_reviews enable row level security;
-- No policy: this is admin-only and reached with the service role, the same way
-- the rest of the catalogue tooling is.
