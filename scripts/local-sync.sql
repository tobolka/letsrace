-- Applies one batch of a local pass to a target database as a three-way merge.
-- Expects temp tables _cs (the batch) and _settings, filled by scripts/local-sync.cjs.
--
-- A race travels as one package: the race and its sources, categories and evidence land
-- together or not at all, so a conflict cannot leave a race changed without its proof.
-- Each row is locked before it is compared, so a later edit cannot be overwritten. A column
-- changes only if the pass changed it and the target still holds the value the pass started
-- from. Manual locks win. Triggers stay on, so the target queues its own refreshes.
do $engine$
declare
  g record;
  r record;
  current_row jsonb;
  pass integer;
  progressed boolean;
  exact boolean := (select exact from _settings);
  excluded_columns text[] := (select excluded from _settings);
  auto_merge text[] := array['last_seen_at', 'updated_at', 'last_fetched_at', 'last_changed_at'];
  key_filter text;
  column_list text;
  locks text[];
  c text;
  to_set text[];
  conflicts text[];
  prior jsonb;
  written jsonb;
  culprit bigint;
  why text;
  why_columns text[];
begin
  for pass in 1..4 loop
    progressed := false;
    for g in select grp, min(owner) as owner from _cs where state = 'pending' group by grp order by min(seq) loop
      culprit := null; why := null; why_columns := null;
      begin
        locks := '{}';
        if g.owner is not null and not exact then
          select coalesce(o.locked_fields, '{}') into locks from public.event_overrides o where o.event_id = g.owner::uuid for share;
          locks := coalesce(locks, '{}');
        end if;

        for r in select * from _cs where grp = g.grp and state = 'pending' order by seq loop
          culprit := r.seq;
          select string_agg(format('t.%I = (jsonb_populate_record(null::%s, $1)).%I', k, r.tab, k), ' and ')
            into key_filter from jsonb_object_keys(r.pk) k;
          execute format('select to_jsonb(t) from %s t where %s for update of t', r.tab, key_filter) into current_row using r.pk;

          -- Same locks the target's own writers honour for a race's categories.
          if r.tab = 'public.event_categories' and locks && array['categories', 'event_categories', 'age_categories', 'age_confidence', 'audience'] then
            update _cs set state = 'unchanged', skipped_locked = array['categories'] where seq = r.seq;
            continue;
          end if;

          if r.op = 'insert' then
            if current_row is not null then
              select array_agg(k) into conflicts from jsonb_object_keys(r.after) k
                where current_row -> k is distinct from r.after -> k and not (k = any(auto_merge)) and k <> all(excluded_columns);
              if conflicts is not null then
                why := 'exists_with_other_values'; why_columns := conflicts;
                raise exception 'conflict' using errcode = 'LR001';
              end if;
              update _cs set state = 'unchanged' where seq = r.seq;
            else
              select string_agg(format('%I', a.attname), ', ') into column_list from pg_attribute a
                where a.attrelid = r.tab::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = '' and r.after ? a.attname;
              execute format('insert into %s (%s) select %s from jsonb_populate_record(null::%s, $1)', r.tab, column_list, column_list, r.tab) using r.after;
              execute format('select to_jsonb(t) from %s t where %s', r.tab, key_filter) into written using r.pk;
              insert into _journal values (r.seq, r.tab, r.pk, 'delete', written, null, r.owner);
              update _cs set state = 'applied' where seq = r.seq;
            end if;

          elsif r.op = 'delete' then
            if current_row is null then
              update _cs set state = 'unchanged' where seq = r.seq;
            else
              select array_agg(k) into conflicts from jsonb_object_keys(r.before) k
                where current_row -> k is distinct from r.before -> k and (exact or not (k = any(auto_merge))) and k <> all(excluded_columns);
              if conflicts is not null then
                why := 'changed_in_target'; why_columns := conflicts;
                raise exception 'conflict' using errcode = 'LR001';
              end if;
              execute format('delete from %s t where %s', r.tab, key_filter) using r.pk;
              insert into _journal values (r.seq, r.tab, r.pk, 'insert', null, current_row, r.owner);
              update _cs set state = 'applied' where seq = r.seq;
            end if;

          else -- update
            if current_row is null then
              why := 'missing_in_target';
              raise exception 'conflict' using errcode = 'LR001';
            end if;
            if r.tab = 'public.events' and not exact and current_row ->> 'merged_into_id' is not null and not (r.after ? 'merged_into_id') then
              why := 'merged_in_target';
              raise exception 'conflict' using errcode = 'LR001';
            end if;
            to_set := '{}'; conflicts := '{}'; prior := '{}';
            for c in select jsonb_object_keys(r.after) loop
              if not exact and r.tab = 'public.events' and (
                  c = any(locks)
                  or (c in ('age_categories', 'age_confidence', 'audience') and locks && array['categories', 'event_categories'])
                  or (c = 'practical_details' and exists (select 1 from unnest(locks) lock_name where lock_name = 'practical_details' or lock_name like 'practical.%'))) then
                update _cs set skipped_locked = array_append(coalesce(skipped_locked, '{}'), c) where seq = r.seq;
                continue;
              end if;
              if current_row -> c is not distinct from r.after -> c then continue; end if;
              if not exact and c = any(auto_merge) then
                -- Observation times only move forward; neither side's newer time is a conflict.
                if (current_row ->> c)::timestamptz is null or (r.after ->> c)::timestamptz > (current_row ->> c)::timestamptz then
                  to_set := to_set || c;
                  prior := prior || jsonb_build_object(c, current_row -> c);
                end if;
              elsif current_row -> c is not distinct from r.before -> c then
                to_set := to_set || c;
                prior := prior || jsonb_build_object(c, current_row -> c);
              else
                conflicts := conflicts || c;
              end if;
            end loop;
            if cardinality(conflicts) > 0 then
              why := 'changed_in_target'; why_columns := conflicts;
              raise exception 'conflict' using errcode = 'LR001';
            end if;
            if cardinality(to_set) = 0 then
              update _cs set state = 'unchanged' where seq = r.seq;
            else
              select string_agg(format('%I', col), ', ') into column_list from unnest(to_set) col;
              execute format('update %s t set (%s) = row(%s) where %s', r.tab, column_list,
                (select string_agg(format('(jsonb_populate_record(null::%s, $2)).%I', r.tab, col), ', ') from unnest(to_set) col), key_filter)
                using r.pk, r.after;
              select jsonb_object_agg(col, r.after -> col) into written from unnest(to_set) col;
              insert into _journal values (r.seq, r.tab, r.pk, 'update', written, prior, r.owner);
              update _cs set state = 'applied' where seq = r.seq;
            end if;
          end if;
        end loop;
        progressed := true;
      exception
        when sqlstate 'LR001' then
          update _cs set state = 'conflict', reason = why, columns = why_columns where seq = culprit;
          update _cs set state = 'group_held', reason = 'another_change_for_this_race_stopped' where grp = g.grp and seq <> culprit and state = 'pending';
          progressed := true;
        -- A parent may arrive later in this batch; a child may still be holding a delete back.
        when foreign_key_violation then
          update _cs set reason = sqlerrm where grp = g.grp and state = 'pending';
        -- A key another change in this send may still free (a merged race giving up its source): try again
        -- after the others; it fails only if nothing else moved.
        when unique_violation then
          update _cs set reason = 'unique:' || left(sqlerrm, 290) where seq = culprit;
        when others then
          update _cs set state = 'failed', reason = left(sqlerrm, 300) where seq = culprit;
          update _cs set state = 'group_held', reason = 'another_change_for_this_race_stopped' where grp = g.grp and seq <> culprit and state = 'pending';
          progressed := true;
      end;
    end loop;
    exit when not progressed or not exists (select 1 from _cs where state = 'pending');
  end loop;
  -- A key still taken stays waiting with its race: a later batch of this send may free it, and
  -- scripts/local-sync.cjs reports it as failed if it is still taken after the last round.
end
$engine$;
