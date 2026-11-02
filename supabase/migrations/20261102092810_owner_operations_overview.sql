create function public.pipeline_source_state(p_state text,p_error text)
returns text language sql immutable security invoker set search_path=public,pg_temp as $$
  select case
    when coalesce(p_state,'') not in ('error','needs_review') then 'ok'
    when coalesce(p_error,'') ~ '(provider_deferred:|LLM budget of|Shared LLM budget|calendar_budget_exhausted|calendar_time_budget_exhausted|write_time_budget_exhausted|time budget exceeded|chunk_limit|source_reader_unavailable_or_running|source_changed_before_read)' then 'deferred'
    when p_error in ('unsupported_or_empty_source','low confidence or empty extract','dynamic_render_unavailable')
      or coalesce(p_error,'') ~ '^(source_document_too_large|pdf_has_no_text)' then 'unreadable'
    when coalesce(p_error,'') ~ '(identity_review_required|pipeline_data_review_required)'
      or (p_state='needs_review' and p_error is null) then 'review'
    else 'broken' end;
$$;
revoke all on function public.pipeline_source_state(text,text) from public,anon,authenticated;
grant execute on function public.pipeline_source_state(text,text) to service_role;
alter table public.watched_urls add column operational_state text generated always as (public.pipeline_source_state(last_extract_status,last_error)) stored;

create function public.pipeline_source_counts()
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
  select jsonb_build_object('sources',count(*),'due',count(*) filter(where next_poll_at<=now()),'overdue',count(*) filter(where next_poll_at<now()-interval '36 hours'),
    'broken',count(*) filter(where operational_state='broken'),'unreadable',count(*) filter(where operational_state='unreadable'),
    'deferred',count(*) filter(where operational_state='deferred'),'review',count(*) filter(where operational_state='review')) from public.watched_urls where status='active';
$$;
revoke all on function public.pipeline_source_counts() from public,anon,authenticated;
grant execute on function public.pipeline_source_counts() to service_role;

create table public.pipeline_owner_decisions (
  key text primary key,
  kind text not null check(kind in ('manual_lock','scope','budget','external_access')),
  status text not null default 'open' check(status in ('open','answered','resolved','superseded')),
  question text not null,
  reason text not null,
  recommendation text not null,
  default_action text not null,
  options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 4),
  evidence jsonb not null default '{}',
  answer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  answered_at timestamptz
);
create index pipeline_owner_decisions_open on public.pipeline_owner_decisions(status,created_at);
alter table public.pipeline_owner_decisions enable row level security;
revoke all on public.pipeline_owner_decisions from public,anon,authenticated;
grant select,insert,update,delete on public.pipeline_owner_decisions to service_role;

create function public.pipeline_answer_owner(p_key text,p_expected timestamptz,p_answer text)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare held public.pipeline_owner_decisions;
begin
  select * into held from public.pipeline_owner_decisions where key=p_key for update;
  if not found or held.status<>'open' or held.updated_at is distinct from p_expected then return false; end if;
  if not exists(select 1 from jsonb_array_elements(held.options) option where option->>'value'=p_answer) then return false; end if;
  update public.pipeline_owner_decisions set status='answered',answer=p_answer,answered_at=now(),updated_at=now() where key=p_key;
  return true;
end;
$$;
revoke all on function public.pipeline_answer_owner(text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.pipeline_answer_owner(text,timestamptz,text) to service_role;
