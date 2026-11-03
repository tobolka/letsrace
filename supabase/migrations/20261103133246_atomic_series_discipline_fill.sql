-- One transaction: empty race field, inherited value, provenance and outbox.
create function public.pipeline_fill_series_disciplines(p_limit integer default 3000)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare e public.events; s public.series; locked text[]; filled integer:=0;
begin
  if p_limit is null or p_limit<0 or p_limit>3000 then raise exception 'Invalid discipline batch limit'; end if;
  for e in
    select candidate.* from public.events candidate
    where candidate.visibility='public' and candidate.merged_into_id is null
      and candidate.status in ('scheduled','postponed','registration_open','tbc')
      and candidate.start_date>=current_date
      and cardinality(coalesce(candidate.disciplines,'{}'))=0
      and exists(select 1 from public.series parent where parent.id=candidate.series_id
        and parent.visibility='public' and cardinality(coalesce(parent.disciplines,'{}'))>0)
      and not exists(select 1 from public.event_overrides o where o.event_id=candidate.id
        and 'disciplines'=any(coalesce(o.locked_fields,'{}')))
    order by candidate.start_date,candidate.id limit p_limit for update of candidate skip locked
  loop
    select locked_fields into locked from public.event_overrides where event_id=e.id for share;
    if 'disciplines'=any(coalesce(locked,'{}')) then continue; end if;
    select * into s from public.series where id=e.series_id and visibility='public';
    if not found or cardinality(coalesce(s.disciplines,'{}'))=0 then continue; end if;
    update public.events set disciplines=s.disciplines,updated_at=now() where id=e.id;
    insert into public.event_facts(event_id,field,value,previous,source_url,quote,method,version)
      values(e.id,'disciplines',to_jsonb(s.disciplines),to_jsonb(e.disciplines),coalesce(s.source_url,s.website_url),
        'Inherited from primary series '||s.id::text||' ('||s.name||'); not independently confirmed for this edition.',
        'series_disciplines','atomic-v1');
    filled:=filled+1;
  end loop;
  return jsonb_build_object('filled',filled);
end;
$$;
revoke all on function public.pipeline_fill_series_disciplines(integer) from public,anon,authenticated;
grant execute on function public.pipeline_fill_series_disciplines(integer) to service_role;
