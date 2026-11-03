-- Persist the actual committed before/after values. Do not infer notices from a stale prepared patch.
create function public.pipeline_queue_plan_changes()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare before_value jsonb; after_value jsonb;
begin
  if old.visibility<>'public' or new.visibility<>'public' or new.merged_into_id is not null then return new; end if;
  before_value:=jsonb_build_object('name',old.name,'startDate',old.start_date,'endDate',old.end_date,'status',old.status,'disciplines',to_jsonb(old.disciplines),'registrationUrl',old.registration_url);
  after_value:=jsonb_build_object('name',new.name,'startDate',new.start_date,'endDate',new.end_date,'status',new.status,'disciplines',to_jsonb(new.disciplines),'registrationUrl',new.registration_url);
  if before_value is distinct from after_value then
    insert into public.pipeline_tasks(key,kind,capability,entity_id,priority,payload)
      values('plan-change:'||gen_random_uuid()::text,'plan_changes','web',new.id,50,jsonb_build_object('eventId',new.id,'before',before_value,'after',after_value));
  end if;
  return new;
end;$$;
create trigger pipeline_queue_plan_changes after update of name,start_date,end_date,status,disciplines,registration_url on public.events
  for each row execute function public.pipeline_queue_plan_changes();

create function public.pipeline_finish_plan_changes(p_key text,p_token uuid,p_payload jsonb,p_changes jsonb)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare held public.pipeline_tasks; change jsonb;
begin
  select * into held from public.pipeline_tasks where key=p_key for update;
  if not found or held.kind<>'plan_changes' or held.status<>'running' or p_token is null or held.token is distinct from p_token
    or held.lease_until is null or held.lease_until<=clock_timestamp() or held.payload is distinct from p_payload then return false; end if;
  if p_payload->>'eventId' is distinct from held.entity_id::text or jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes)>4 then raise exception 'Invalid plan-change result'; end if;
  for change in select value from jsonb_array_elements(p_changes) loop
    if coalesce(change->>'kind','') not in ('date','cancelled','registration','discipline') or nullif(change->>'fingerprint','') is null
      or jsonb_typeof(change->'payload') is distinct from 'object' then raise exception 'Invalid plan change'; end if;
    insert into public.event_plan_changes(event_id,kind,fingerprint,payload)
      values(held.entity_id,change->>'kind',change->>'fingerprint',change->'payload') on conflict(event_id,kind,fingerprint) do nothing;
  end loop;
  if not public.pipeline_finish_task(p_key,p_token,p_payload,jsonb_build_object('changes',jsonb_array_length(p_changes))) then raise exception 'Plan-change completion refused'; end if;
  return true;
end;$$;
revoke all on function public.pipeline_queue_plan_changes(),public.pipeline_finish_plan_changes(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.pipeline_queue_plan_changes(),public.pipeline_finish_plan_changes(text,uuid,jsonb,jsonb) to service_role;
