-- Service-only telemetry, overlap leases, and an account-wide atomic AI cap.
create table public.pipeline_jobs (
 key text primary key, run_id uuid not null, started_at timestamptz not null default now(),
 finished_at timestamptz, status text not null default 'running', summary jsonb not null default '{}'::jsonb
);
create table public.pipeline_ai_charges (
 id uuid primary key default gen_random_uuid(), day date not null default (now() at time zone 'Europe/Prague')::date,
 amount numeric not null check(amount >= 0), settled boolean not null default false
);
create index pipeline_ai_charges_day on public.pipeline_ai_charges(day);
alter table public.pipeline_jobs enable row level security;
alter table public.pipeline_ai_charges enable row level security;
revoke all on public.pipeline_jobs, public.pipeline_ai_charges from public, anon, authenticated;
grant all on public.pipeline_jobs, public.pipeline_ai_charges to service_role;

create function public.pipeline_begin(p_key text, p_run uuid) returns boolean language plpgsql security invoker set search_path = public as $$
begin
 insert into public.pipeline_jobs(key,run_id) values(p_key,p_run)
 on conflict(key) do update set run_id=excluded.run_id, started_at=now(), finished_at=null,status='running',summary='{}'::jsonb
 where pipeline_jobs.finished_at is not null or pipeline_jobs.started_at<now()-interval '15 minutes';
 return found;
end $$;
create function public.pipeline_ai_reserve(p_amount numeric) returns uuid language plpgsql security invoker set search_path = public as $$
declare d date := (now() at time zone 'Europe/Prague')::date; receipt uuid;
begin
 if p_amount is null or p_amount <= 0 or p_amount > 0.5 then raise exception 'Invalid AI reservation'; end if;
 perform pg_advisory_xact_lock(720261026);
 if coalesce((select sum(amount) from public.pipeline_ai_charges where day=d),0)+p_amount > 0.50
 or coalesce((select sum(amount) from public.pipeline_ai_charges where day>=date_trunc('month',d)::date and day<(date_trunc('month',d)+interval '1 month')::date),0)+p_amount > 5
 then raise exception 'AI budget deferred: daily 0.50 USD or monthly 5 USD exhausted'; end if;
 insert into public.pipeline_ai_charges(amount) values(p_amount) returning id into receipt;
 return receipt;
end $$;
create function public.pipeline_ai_settle(p_id uuid,p_actual numeric) returns void language plpgsql security invoker set search_path = public as $$
begin
 if p_actual is null or p_actual<0 or p_actual='NaN'::numeric then raise exception 'Invalid actual cost'; end if;
 perform pg_advisory_xact_lock(720261026);
 -- A crashed request keeps its conservative charge. Settlement is idempotent.
 update public.pipeline_ai_charges set amount=p_actual,settled=true where id=p_id and not settled;
end $$;
revoke all on function public.pipeline_begin(text,uuid), public.pipeline_ai_reserve(numeric), public.pipeline_ai_settle(uuid,numeric) from public,anon,authenticated;
grant execute on function public.pipeline_begin(text,uuid), public.pipeline_ai_reserve(numeric), public.pipeline_ai_settle(uuid,numeric) to service_role;
-- Preserve the existing CLI ledger, including spend made before the new policy.
insert into public.pipeline_ai_charges(id,day,amount,settled) values('c0000000-0000-4000-8000-000000000001','2026-10-01',7.683967400000007,true);
