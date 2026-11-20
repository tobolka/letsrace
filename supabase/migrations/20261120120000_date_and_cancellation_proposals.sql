-- The gate learns three more fields: start_date, end_date and a cancellation (status = 'cancelled').
-- A reader still hands in a proposal with the page and the words on it; this function decides and
-- writes in one transaction with the history row. The regulations_url rules are unchanged, in the
-- same order, with the same reasons.
--
-- What a date or a cancellation must pass, as the race is now and under a lock:
--   * the race is public, not merged, and starts today or later (a past day is never moved);
--   * a date is a real date, in the future, not a year or more from the old one (that waits for a person),
--     and its quote names the year; the end never comes before the start;
--   * a cancellation's quote says the race is off, in the languages of the catalogue;
--   * nothing is locked by hand (start_date, end_date or status).
-- Anything else is rejected with a reason, or held when a person or time may still change the answer.

create or replace function public.pipeline_apply_proposal(p_key text)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare p public.pipeline_proposals; e public.events; locked text[]; link text; fact uuid;
  decide text; why text; newd date; oldd date; today date := (now() at time zone 'UTC')::date;
  previous jsonb;
begin
  select * into p from public.pipeline_proposals where key = p_key for update;
  if not found then return jsonb_build_object('status', 'missing'); end if;
  if p.status not in ('proposed', 'held') then
    return jsonb_build_object('status', p.status, 'reason', p.reason, 'repeated', true);
  end if;

  -- Everything is checked against the race as it is now, under a lock, not as the reader saw it.
  select * into e from public.events where id = p.event_id for update;
  select locked_fields into locked from public.event_overrides where event_id = p.event_id for share;
  link := p.value #>> '{}';

  if p.field not in ('regulations_url', 'start_date', 'end_date', 'status') then decide := 'held'; why := 'unsupported_field';
  elsif jsonb_typeof(p.value) <> 'string'
    or (p.field = 'regulations_url' and link !~ '^https?://')
    or (p.field in ('start_date', 'end_date') and link !~ '^\d{4}-\d{2}-\d{2}$')
    or (p.field = 'status' and link <> 'cancelled') then decide := 'rejected'; why := 'invalid_value';
  elsif e.merged_into_id is not null then decide := 'rejected'; why := 'merged';
  elsif e.start_date < today then decide := 'rejected'; why := 'past_race';
  elsif p.field = 'regulations_url' then
    if e.regulations_url = link then decide := 'superseded'; why := 'already_set';
    elsif e.regulations_url is not null then decide := 'superseded'; why := 'field_filled';
    elsif e.visibility is distinct from 'public' then decide := 'held'; why := 'hidden';
    elsif 'regulations_url' = any(coalesce(locked, '{}')) then decide := 'held'; why := 'manual_lock';
    else
      update public.events set regulations_url = link, updated_at = now() where id = e.id;
      insert into public.event_facts(event_id, field, value, previous, source_url, quote, method, version)
        values (e.id, 'regulations_url', p.value, null, p.source_url, p.quote, p.reader, p.version)
        returning id into fact;
      decide := 'applied';
    end if;
  elsif p.field = 'status' then
    if e.status = 'cancelled' then decide := 'superseded'; why := 'already_set';
    elsif p.quote !~* '(cancel|zru[sš]en|odvol[aá]n|abgesagt|entf[aä]llt|annull|odwo[lł]an|storn)' then decide := 'rejected'; why := 'quote_does_not_say_cancelled';
    elsif e.visibility is distinct from 'public' then decide := 'held'; why := 'hidden';
    elsif 'status' = any(coalesce(locked, '{}')) then decide := 'held'; why := 'manual_lock';
    else
      previous := to_jsonb(e.status);
      update public.events set status = 'cancelled', updated_at = now() where id = e.id;
      insert into public.event_facts(event_id, field, value, previous, source_url, quote, method, version)
        values (e.id, 'status', p.value, previous, p.source_url, p.quote, p.reader, p.version)
        returning id into fact;
      decide := 'applied';
    end if;
  else
    -- start_date or end_date
    begin newd := link::date; exception when others then newd := null; end;
    oldd := case p.field when 'start_date' then e.start_date else e.end_date end;
    if newd is null then decide := 'rejected'; why := 'invalid_value';
    elsif oldd = newd then decide := 'superseded'; why := 'already_set';
    elsif newd < today then decide := 'rejected'; why := 'date_in_the_past';
    elsif p.quote !~ to_char(newd, 'YYYY') then decide := 'rejected'; why := 'quote_without_the_year';
    elsif p.field = 'start_date' and e.end_date is not null and e.end_date < newd then decide := 'rejected'; why := 'end_before_start';
    elsif p.field = 'end_date' and newd < e.start_date then decide := 'rejected'; why := 'end_before_start';
    elsif oldd is not null and abs(newd - oldd) > 365 then decide := 'held'; why := 'moved_more_than_a_year';
    elsif e.visibility is distinct from 'public' then decide := 'held'; why := 'hidden';
    elsif p.field = any(coalesce(locked, '{}')) then decide := 'held'; why := 'manual_lock';
    else
      previous := to_jsonb(oldd);
      if p.field = 'start_date' then update public.events set start_date = newd, updated_at = now() where id = e.id;
      else update public.events set end_date = newd, updated_at = now() where id = e.id;
      end if;
      insert into public.event_facts(event_id, field, value, previous, source_url, quote, method, version)
        values (e.id, p.field, p.value, previous, p.source_url, p.quote, p.reader, p.version)
        returning id into fact;
      decide := 'applied';
    end if;
  end if;

  update public.pipeline_proposals set status = decide, reason = why, fact_id = fact, decided_at = now() where key = p_key;
  return jsonb_build_object('status', decide, 'reason', why, 'fact', fact);
end;
$$;

revoke execute on function public.pipeline_apply_proposal(text) from public, anon, authenticated;
grant execute on function public.pipeline_apply_proposal(text) to service_role;
