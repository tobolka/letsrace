-- An explicit failed attempt cannot keep writing during its retry delay.
-- Only an explicit reviewed service retry may advance the delay; never steal a live worker.
drop function public.pipeline_claim_candidate(uuid,text,timestamptz,jsonb);
create function public.pipeline_claim_candidate(p_id uuid,p_hash text,p_updated timestamptz,p_decision jsonb,p_retry_resolved boolean default false)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare c public.pipeline_candidates; token uuid:=gen_random_uuid();
begin
  select * into c from public.pipeline_candidates where id=p_id for update;
  if not found or c.evidence_hash is distinct from p_hash or c.updated_at is distinct from p_updated then raise exception 'Candidate changed; review again'; end if;
  if p_decision->>'action' is distinct from 'publish' or p_decision->>'id' is distinct from p_id::text
    or p_decision->>'evidenceHash' is distinct from p_hash or nullif(btrim(p_decision->>'reason'),'') is null
    or not p_decision ? 'expectedEventId' or coalesce(p_decision->>'authority','') not in ('official','national_federation','series')
    or not coalesce(p_decision->'checked' @> '{"identity":true,"date":true,"place":true,"discipline":true,"authority":true}',false)
    then raise exception 'Explicit evidence-bound publish decision required'; end if;
  if c.status='published' then
    if c.decision-'reviewedAt' is distinct from p_decision then raise exception 'Published decision differs'; end if;
    return jsonb_build_object('status','published','result',c.publication_result);
  end if;
  if c.status='publishing' then
    if c.publish_token is null then raise exception 'Legacy interrupted publication requires inspection'; end if;
    if c.publish_lease_until>clock_timestamp() and (c.publish_error is null or not coalesce(p_retry_resolved,false)) then raise exception 'Candidate publication already running'; end if;
    if c.decision-'reviewedAt' is distinct from p_decision then raise exception 'Interrupted publication requires the same decision'; end if;
  elsif c.status not in ('pending','waiting','conflict') then raise exception 'Candidate cannot be published'; end if;
  update public.pipeline_candidates set status='publishing',decision=p_decision||jsonb_build_object('reviewedAt',clock_timestamp()),
    publish_token=token,publish_lease_until=clock_timestamp()+interval '5 minutes',publish_error=null,updated_at=clock_timestamp() where id=p_id;
  return jsonb_build_object('status','publishing','token',token);
end;$$;

revoke all on function public.pipeline_claim_candidate(uuid,text,timestamptz,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.pipeline_claim_candidate(uuid,text,timestamptz,jsonb,boolean) to service_role;

create or replace function public.pipeline_publish_candidate(p_id uuid,p_token uuid,p_hash text,p_event uuid,p_revision uuid,
  p_payload jsonb,p_source jsonb,p_source_hash text,p_reader text,p_location jsonb,p_categories jsonb,p_secondary uuid[])
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare c public.pipeline_candidates; watched public.watched_urls; result jsonb; changed boolean:=false; created boolean:=p_revision is null; applied jsonb;
begin
  select * into c from public.pipeline_candidates where id=p_id for update;
  if not found or c.evidence_hash is distinct from p_hash or c.publish_token is distinct from p_token then raise exception 'Candidate publication lease lost'; end if;
  if c.status='published' and c.publication_result is not null then return c.publication_result; end if;
  if c.status<>'publishing' or c.publish_error is not null or c.publish_lease_until is null or c.publish_lease_until<=clock_timestamp() then raise exception 'Candidate publication lease lost'; end if;
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
