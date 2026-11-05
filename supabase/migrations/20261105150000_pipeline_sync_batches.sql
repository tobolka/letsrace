-- One row per applied batch of results from a pass on the Mac, written in the same
-- transaction as the changes. After a crash this shows exactly what landed and holds
-- what is needed to undo it. Only the service role can reach it.
create table public.pipeline_sync_batches (
  id bigint generated always as identity primary key,
  plan_sha text not null,
  batch integer not null,
  summary jsonb not null,
  journal jsonb not null,
  created_at timestamptz not null default now()
);
create index pipeline_sync_batches_plan on public.pipeline_sync_batches (plan_sha, id);
alter table public.pipeline_sync_batches enable row level security;
revoke all on table public.pipeline_sync_batches from public, anon, authenticated;
grant select, insert on table public.pipeline_sync_batches to service_role;
