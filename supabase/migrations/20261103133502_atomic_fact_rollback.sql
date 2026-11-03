-- Undo one recorded write, not a whole method blindly. Event first, fact second:
-- matches normal writers' lock order. All category removals/status/outbox commit together.
create function public.pipeline_rollback_fact(p_fact uuid,p_dry_run boolean default false)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare f public.event_facts; e public.events; event_id_to_lock uuid; locked text[];
  saved jsonb; row_value jsonb; current_row jsonb; category_fields text[]:=array['id','event_id','name','age_min','age_max','distance_km','elevation_m','gender','audience'];
begin
  select event_id into event_id_to_lock from public.event_facts where id=p_fact;
  if not found then return jsonb_build_object('status','kept','reason','missing_fact'); end if;
  select * into e from public.events where id=event_id_to_lock for update;
  if not found or e.merged_into_id is not null then return jsonb_build_object('status','kept','reason','missing_or_merged_event'); end if;
  select * into f from public.event_facts where id=p_fact for update;
  if f.event_id is distinct from e.id or f.status is distinct from 'active' then return jsonb_build_object('status','kept','reason','inactive_fact'); end if;
  select locked_fields into locked from public.event_overrides where event_id=e.id for share;
  if f.field=any(coalesce(locked,'{}')) or (f.field='event_categories' and coalesce(locked,'{}') && array['categories','age_categories']) then
    return jsonb_build_object('status','kept','reason','manual_lock');
  end if;
  if f.field='event_categories' then
    -- This path undoes inserted rows only. Replacing an older category set needs
    -- its own restoration policy; never erase it while claiming a full undo.
    if coalesce(f.previous,'null'::jsonb) not in ('null'::jsonb,'[]'::jsonb,'{"rows":[]}'::jsonb) then
      return jsonb_build_object('status','kept','reason','previous_categories_require_restore');
    end if;
    saved:=f.value->'rows';
    if jsonb_typeof(saved) is distinct from 'array' then return jsonb_build_object('status','kept','reason','unsupported_evidence'); end if;
    if jsonb_array_length(saved)=0 or exists(select 1 from jsonb_array_elements(saved) r where jsonb_typeof(r) is distinct from 'object' or r->>'id' is null)
      or (select count(distinct r->>'id') from jsonb_array_elements(saved) r)<>jsonb_array_length(saved) then
      return jsonb_build_object('status','kept','reason','unsupported_evidence');
    end if;
    -- Lock the exact recorded rows; never delete independently added categories.
    perform 1 from public.event_categories c where c.event_id=e.id and c.id::text in(select r->>'id' from jsonb_array_elements(saved) r) order by c.id for update;
    for row_value in select value from jsonb_array_elements(saved) loop
      select to_jsonb(c) into current_row from public.event_categories c where c.id::text=row_value->>'id' and c.event_id=e.id;
      if not found or exists(select 1 from unnest(category_fields) k where coalesce(current_row->k,'null'::jsonb) is distinct from coalesce(row_value->k,'null'::jsonb)) then
        return jsonb_build_object('status','kept','reason','changed_categories');
      end if;
    end loop;
    if not coalesce(p_dry_run,false) then
      delete from public.event_categories c where c.event_id=e.id and c.id::text in(select r->>'id' from jsonb_array_elements(saved) r);
    end if;
  else
    -- Evidence includes documents and composite summaries too; they are not event columns.
    if not f.field=any(array['name','start_date','end_date','status','visibility','location_id','series_id','disciplines','age_categories','age_confidence','audience','level','class_label','uci_class','description','website_url','registration_url','regulations_url','event_type','competition_type','formats','registration_status','registration_opens_at','registration_closes_at','timezone']) then
      return jsonb_build_object('status','kept','reason','unsupported_field');
    end if;
    if not to_jsonb(e) ? f.field then return jsonb_build_object('status','kept','reason','unsupported_field'); end if;
    if coalesce(to_jsonb(e)->f.field,'null'::jsonb) is distinct from coalesce(f.value,'null'::jsonb) then return jsonb_build_object('status','kept','reason','changed_value'); end if;
    if not coalesce(p_dry_run,false) then
      execute format('update public.events set %1$I=(jsonb_populate_record(null::public.events,$1)).%1$I,updated_at=now() where id=$2',f.field)
        using jsonb_build_object(f.field,f.previous),e.id;
    end if;
  end if;
  if not coalesce(p_dry_run,false) then update public.event_facts set status='rolled_back' where id=f.id; end if;
  return jsonb_build_object('status','restored','field',f.field,'event_id',e.id,'dry_run',coalesce(p_dry_run,false));
end;
$$;
revoke all on function public.pipeline_rollback_fact(uuid,boolean) from public,anon,authenticated;
grant execute on function public.pipeline_rollback_fact(uuid,boolean) to service_role;
