-- What has already been asked, and what came back.
--
-- Two of the age-category passes read a page that belongs to one race: the
-- Italian federation's "Categorie ammesse" line, and the contest list a timing
-- platform publishes. Both pick their next batch by asking the catalogue which
-- upcoming races still have no categories — which is the same question every
-- run, and so the same answer: the nightly job spent its whole budget re-asking
-- sixty-seven pages that had already said nothing, and never reached the
-- sixty-eighth.
--
-- A page that says nothing is not a failure to retry in an hour. It is a fact
-- about that page, and this is where it is kept.

create table if not exists public.catalog_probes (
  event_id uuid not null references public.events(id) on delete cascade,
  -- Which reader asked: 'fci_ages', 'raceresult_ages'.
  probe text not null,
  -- 'silent' — reached it, it carries nothing. 'failed' — could not reach it.
  outcome text not null check (outcome in ('silent', 'failed')),
  attempts integer not null default 1,
  last_attempt_at timestamptz not null default now(),
  primary key (event_id, probe)
);

create index if not exists catalog_probes_probe_idx
  on public.catalog_probes (probe, last_attempt_at);

alter table public.catalog_probes enable row level security;
-- No policy: written by the catalogue tooling with the service role, like the
-- rest of the hygiene machinery.
