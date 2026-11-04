-- Recheck the current dates and manual locks at the point of writing.
create function public.pipeline_complete_past_events(p_ids uuid[],p_today date)
returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare race public.events; locked text[]; completed integer:=0;
begin
  if p_today is null or p_today>(now() at time zone 'UTC')::date or cardinality(p_ids)>100 then
    raise exception 'Invalid past-event batch';
  end if;
  for race in select e.* from public.events e
    where e.id=any(p_ids) and e.merged_into_id is null
      and e.status in ('scheduled','registration_open')
      and greatest(e.start_date,e.end_date)<p_today
    order by e.id for update skip locked
  loop
    select locked_fields into locked from public.event_overrides where event_id=race.id for share;
    if 'status'=any(coalesce(locked,'{}')) then continue; end if;
    update public.events set status='completed',updated_at=now() where id=race.id;
    insert into public.event_facts(event_id,field,value,previous,method,version)
      values(race.id,'status',to_jsonb('completed'::text),to_jsonb(race.status),'calendar_elapsed','atomic-v1');
    completed:=completed+1;
  end loop;
  return completed;
end;
$$;

-- Evidence obtained over the network is only valid for the revision we read.
create function public.pipeline_fill_registration_link(
  p_event uuid,p_revision uuid,p_link text,p_source text,p_quote text
) returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare race public.events; locked text[];
begin
  if p_link is null or p_link !~ '^https?://' or p_source is null or p_source !~ '^https?://' then
    raise exception 'Invalid registration evidence URL';
  end if;
  select * into race from public.events where id=p_event for update;
  if not found or p_revision is null or race.public_revision is distinct from p_revision
    or race.visibility is distinct from 'public' or race.merged_into_id is not null or race.registration_url is not null
    or coalesce(race.status,'') not in ('scheduled','registration_open','postponed','tbc')
    or race.start_date<(now() at time zone 'UTC')::date then return false; end if;
  select locked_fields into locked from public.event_overrides where event_id=p_event for share;
  if 'registration_url'=any(coalesce(locked,'{}')) then return false; end if;
  update public.events set registration_url=p_link,updated_at=now() where id=p_event;
  insert into public.event_facts(event_id,field,value,previous,source_url,quote,method,version)
    values(p_event,'registration_url',to_jsonb(p_link),null,p_source,p_quote,'registration_links','links-v2');
  return true;
end;
$$;
revoke execute on function public.pipeline_complete_past_events(uuid[],date),
  public.pipeline_fill_registration_link(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.pipeline_complete_past_events(uuid[],date),
  public.pipeline_fill_registration_link(uuid,uuid,text,text,text) to service_role;
