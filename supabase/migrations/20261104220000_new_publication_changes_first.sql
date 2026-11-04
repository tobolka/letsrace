-- Unchanged revisions verified under the old two-language check keep a 10% sample.
-- Everything already waiting drops behind new changes, keeping its relative order.
update public.pipeline_tasks
set status='done',finished_at=now(),updated_at=now(),last_error=null,
  result=result||jsonb_build_object('reverification','outside_sample')
where kind in ('public_refresh','series_refresh') and status='pending'
  and result ? 'verifiedAt' and result->>'revision'=payload->>'revision'
  and abs(hashtext(key))%10<>0;

update public.pipeline_tasks
set priority=case priority when 100 then 30 when 70 then 20 when 40 then 10 else priority end,updated_at=now()
where kind in ('public_refresh','series_refresh') and status='pending';
