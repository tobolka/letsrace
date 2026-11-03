-- Lock one event and commit badge, memberships, provenance and outbox together.
create function public.pipeline_attach_event_series(p_event uuid,p_series uuid,p_primary boolean,p_source text,p_promote_if_empty boolean default false)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.events; previous public.event_series; make_primary boolean; current_primary uuid; locked text[]; series_source text; changed boolean:=false;
begin
  if p_source is null or length(p_source)>200 then raise exception 'Invalid membership source'; end if;
  select * into e from public.events where id=p_event for update;
  if not found then raise exception 'Unknown event'; end if;
  if e.merged_into_id is not null then return jsonb_build_object('status','merged'); end if;
  select coalesce(source_url,website_url) into series_source from public.series where id=p_series;
  if not found then raise exception 'Unknown series'; end if;
  make_primary:=coalesce(p_primary,false) or (coalesce(p_promote_if_empty,false) and e.series_id is null) or e.series_id is not distinct from p_series;
  select locked_fields into locked from public.event_overrides where event_id=p_event for share;
  if make_primary and e.series_id is distinct from p_series and 'series_id'=any(coalesce(locked,'{}')) then return jsonb_build_object('status','locked'); end if;
  select * into previous from public.event_series where event_id=p_event and series_id=p_series;
  if found and previous.is_primary=make_primary and (not make_primary or e.series_id=p_series) then return jsonb_build_object('status','unchanged'); end if;
  current_primary:=e.series_id;
  if make_primary and e.series_id is distinct from p_series then
    perform set_config('app.event_series_source',p_source,true);
    update public.event_series set is_primary=false,updated_at=now() where event_id=p_event and is_primary and series_id<>p_series;
    update public.events set series_id=p_series,updated_at=now() where id=p_event;
    changed:=true;
  end if;
  insert into public.event_series(event_id,series_id,is_primary,source,updated_at)
    values(p_event,p_series,make_primary,p_source,now())
    on conflict(event_id,series_id) do update set is_primary=excluded.is_primary,updated_at=now()
    where event_series.is_primary is distinct from excluded.is_primary;
  changed:=changed or previous.event_id is null or previous.is_primary is distinct from make_primary;
  if changed then
    insert into public.event_facts(event_id,field,value,previous,source_url,quote,method,version)
      values(p_event,'source_evidence',jsonb_build_object('series_id',p_series,'is_primary',make_primary,'source',p_source),
      jsonb_build_object('primary_series_id',current_primary,'membership',to_jsonb(previous)),series_source,
      'Series association saved atomically; this is an association record, not independently verified race information.','series_membership','atomic-v1');
  end if;
  return jsonb_build_object('status',case when changed then 'attached' else 'unchanged' end);
end;
$$;
revoke all on function public.pipeline_attach_event_series(uuid,uuid,boolean,text,boolean) from public,anon,authenticated;
grant execute on function public.pipeline_attach_event_series(uuid,uuid,boolean,text,boolean) to service_role;

-- Secondary memberships affect the race and both series, too. Ignore timestamps/source heartbeats.
create function public.pipeline_secondary_series_revision()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare s jsonb;
begin
  if tg_op='UPDATE' and (old.event_id,old.series_id,old.is_primary) is not distinct from (new.event_id,new.series_id,new.is_primary) then return null; end if;
  if tg_op<>'INSERT' then
    update public.events set public_revision=gen_random_uuid() where id=old.event_id;
    select to_jsonb(row) into s from public.series row where row.id=old.series_id;
    if s is not null then perform public.pipeline_enqueue_series(s); end if;
  end if;
  if tg_op<>'DELETE' then
    if tg_op='INSERT' or new.event_id is distinct from old.event_id then update public.events set public_revision=gen_random_uuid() where id=new.event_id; end if;
    if tg_op='INSERT' or new.series_id is distinct from old.series_id then
      select to_jsonb(row) into s from public.series row where row.id=new.series_id;
      if s is not null then perform public.pipeline_enqueue_series(s); end if;
    end if;
  end if;
  return null;
end;
$$;
create trigger pipeline_secondary_series_content after insert or update or delete on public.event_series for each row execute function public.pipeline_secondary_series_revision();
revoke all on function public.pipeline_secondary_series_revision() from public,anon,authenticated;
grant execute on function public.pipeline_secondary_series_revision() to service_role;
