-- Keep immutable evidence, but only one pending review for the same assertion.
-- A changing Blazor document hash must not enqueue the same bad date forever.
create function public.pipeline_supersede_review_snapshot()
returns trigger language plpgsql security invoker set search_path = public, pg_temp as $$
declare newest uuid;
begin
  if new.status <> 'pending' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.candidate_key, 0));
  select id into newest from public.pipeline_candidates
    where candidate_key=new.candidate_key and payload=new.payload and status='pending'
    order by created_at desc,id desc limit 1;
  update public.pipeline_candidates set status='rejected',
    decision=jsonb_build_object('action','reject','reason','Identical assertion superseded by a newer immutable source snapshot. Evidence retained.','supersededBy',newest),
    updated_at=now()
    where candidate_key=new.candidate_key and payload=new.payload
      and status='pending' and id<>newest;
  return new;
end;
$$;
revoke all on function public.pipeline_supersede_review_snapshot() from public, anon, authenticated;
grant execute on function public.pipeline_supersede_review_snapshot() to service_role;
create trigger pipeline_supersede_review_snapshot
after insert on public.pipeline_candidates for each row
execute function public.pipeline_supersede_review_snapshot();
