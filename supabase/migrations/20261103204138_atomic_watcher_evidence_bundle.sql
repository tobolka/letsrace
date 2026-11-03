-- Existing race, source identity, extraction checkpoint and categories share one transaction.
create function public.pipeline_update_watcher_bundle(p_event uuid,p_revision uuid,p_patch jsonb,p_evidence jsonb,
  p_source jsonb,p_source_hash text,p_reader text,p_categories jsonb,p_reviewed boolean default false)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare watched public.watched_urls; result jsonb; category jsonb; held public.event_categories;
  locked text[]; owner uuid; changed boolean:=false;
begin
  if jsonb_typeof(p_source) is distinct from 'object' or pg_column_size(p_source)>1000000
    or nullif(p_source#>>'{event,externalId}','') is null or coalesce(p_source#>>'{event,sourceUrl}','') !~ '^https?://'
    or coalesce(p_source_hash,'') !~ '^[0-9a-f]{40}$'
    or p_reader is distinct from 'source-evidence-v1:'||(p_source->>'watchedUrlId')||':'||(p_source#>>'{event,externalId}')||':'||p_event::text
    or jsonb_typeof(p_categories) is distinct from 'array' or jsonb_array_length(p_categories)>1000
    then raise exception 'Invalid watcher evidence plan'; end if;
  select * into watched from public.watched_urls where id=(p_source->>'watchedUrlId')::uuid for share;
  if not found or not (watched.status='active' or (coalesce(p_reviewed,false) and watched.status='paused' and watched.added_by='pipeline_review')) then raise exception 'source_reader_unavailable_or_running: source unavailable'; end if;
  if p_evidence->'lease' is not null and p_evidence->'lease'<>'null'::jsonb and watched.kind is distinct from p_source->>'kind' then raise exception 'source_reader_unavailable_or_running: source kind changed'; end if;
  result:=public.pipeline_update_watcher_event(p_event,p_revision,p_patch,p_evidence);
    select event_id into owner from public.event_sources where watched_url_id=watched.id and external_id=p_source#>>'{event,externalId}' for update;
    if found and owner<>p_event then raise exception 'identity_review_required: source belongs to another race'; end if;
    insert into public.event_sources(event_id,watched_url_id,source_url,external_id,kind,is_canonical)
      values(p_event,watched.id,p_source#>>'{event,sourceUrl}',p_source#>>'{event,externalId}',case p_source->>'kind' when 'federation' then 'national_federation' when 'series' then 'series' when 'aggregator' then 'aggregator' else 'official' end,true)
      on conflict(watched_url_id,external_id) do update set source_url=excluded.source_url,kind=excluded.kind,is_canonical=true where event_sources.event_id=excluded.event_id returning event_id into owner;
    if not found then raise exception 'identity_review_required: source belongs to another race'; end if;
    if not exists(select 1 from public.page_reads where url=p_source#>>'{event,sourceUrl}' and reader=p_reader and text_hash=p_source_hash) then
      insert into public.event_facts(event_id,field,value,previous,source_url,method,version)
        values(p_event,'source_evidence',p_source,null,p_source#>>'{event,sourceUrl}','watcher_source_evidence','source-evidence-v1');
      insert into public.page_reads(url,reader,text_hash,read_at) values(p_source#>>'{event,sourceUrl}',p_reader,p_source_hash,now())
        on conflict(url,reader) do update set text_hash=excluded.text_hash,read_at=excluded.read_at;
    end if;
    select locked_fields into locked from public.event_overrides where event_id=p_event;
    if not ('categories'=any(coalesce(locked,'{}'))) then
      if jsonb_typeof(p_categories) is distinct from 'array' or jsonb_array_length(p_categories)>1000 then raise exception 'Invalid category plan'; end if;
      for category in select value from jsonb_array_elements(p_categories) loop
        if nullif(btrim(category->>'name'),'') is null or (category->>'distance_km' is not null and not ((category->>'distance_km')::float8>0 and (category->>'distance_km')::float8<'Infinity'::float8)) then raise exception 'Invalid category'; end if;
        if category->>'id' is not null then
          select * into held from public.event_categories where id=(category->>'id')::uuid and event_id=p_event;
          if not found then raise exception 'Category changed concurrently'; end if;
          if (to_jsonb(held)-'id'-'event_id') @> (category-'id') then continue; end if;
          update public.event_categories set name=category->>'name',distance_km=(category->>'distance_km')::float8,age_min=(category->>'age_min')::int,age_max=(category->>'age_max')::int,audience=category->>'audience' where id=held.id;
        else
          insert into public.event_categories(event_id,name,distance_km,age_min,age_max,audience) values(p_event,category->>'name',(category->>'distance_km')::float8,(category->>'age_min')::int,(category->>'age_max')::int,category->>'audience');
        end if;
        changed:=true;
      end loop;
    end if;
  return result||jsonb_build_object('changed',(result->>'changed')::boolean or changed);
end;$$;
revoke all on function public.pipeline_update_watcher_bundle(uuid,uuid,jsonb,jsonb,jsonb,text,text,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.pipeline_update_watcher_bundle(uuid,uuid,jsonb,jsonb,jsonb,text,text,jsonb,boolean) to service_role;

create or replace function public.pipeline_publish_candidate(p_id uuid,p_token uuid,p_hash text,p_event uuid,p_revision uuid,
  p_payload jsonb,p_source jsonb,p_source_hash text,p_reader text,p_location jsonb,p_categories jsonb,p_secondary uuid[])
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare c public.pipeline_candidates; watched public.watched_urls; result jsonb; changed boolean:=false; created boolean:=p_revision is null; applied jsonb;
begin
  select * into c from public.pipeline_candidates where id=p_id for update;
  if not found or c.evidence_hash is distinct from p_hash or c.publish_token is distinct from p_token then raise exception 'Candidate publication lease lost'; end if;
  if c.status='published' and c.publication_result is not null then return c.publication_result; end if;
  if c.status<>'publishing' or c.publish_lease_until is null or c.publish_lease_until<=clock_timestamp() then raise exception 'Candidate publication lease lost'; end if;
  if p_event is null or coalesce(p_source_hash,'') !~ '^[0-9a-f]{40}$' or p_reader is distinct from 'source-evidence-v1:'||(p_source->>'watchedUrlId')||':'||(p_source#>>'{event,externalId}')||':'||p_event::text then raise exception 'Invalid source checkpoint'; end if;
  if p_source->'event' is distinct from c.payload or p_source#>>'{event,evidence,sourceUrl}' is distinct from c.source_url
    or (c.watched_url_id is not null and c.watched_url_id::text is distinct from p_source->>'watchedUrlId')
    or ((c.decision->>'expectedEventId') is null) is distinct from created
    or (not created and c.decision->>'expectedEventId' is distinct from p_event::text)
    then raise exception 'Candidate publication plan differs from reviewed assertion'; end if;
  select * into watched from public.watched_urls where id=(p_source->>'watchedUrlId')::uuid for share;
  if not found or not (watched.status='active' or (watched.status='paused' and watched.added_by='pipeline_review')) then raise exception 'Reviewed source unavailable'; end if;
  if exists(select 1 from public.discovered_links where url=c.source_url and status in ('rejected','ignored')) then raise exception 'Source was explicitly rejected/ignored'; end if;
  if created then
    perform public.pipeline_create_watcher_event(p_event,p_payload,p_source,p_source_hash,p_reader,true,p_location,p_categories,p_secondary,null);
    changed:=true;
  else
    result:=public.pipeline_update_watcher_bundle(p_event,p_revision,p_payload,jsonb_build_object('sourceUrl',c.source_url,
      'quote',c.payload#>>'{evidence,quote}','model',c.payload#>>'{evidence,model}','location',p_location,'secondarySeries',to_jsonb(p_secondary)),
      p_source,p_source_hash,p_reader,p_categories,true);
    changed:=(result->>'changed')::boolean; applied:=result->'applied';
    if not exists(select 1 from public.events where id=p_event and visibility='public' and merged_into_id is null) then raise exception 'Reviewed identity is no longer public'; end if;
  end if;
  result:=jsonb_build_object('id',p_event,'created',created,'changed',changed,'applied',applied);
  update public.pipeline_candidates set status='published',event_id=p_event,publication_result=result,publish_lease_until=null,publish_error=null,updated_at=clock_timestamp() where id=p_id;
  return result;
end;$$;
