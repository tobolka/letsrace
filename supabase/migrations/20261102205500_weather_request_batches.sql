-- Reserve a complete historical period or nothing: do not discard eight
-- fetched years just because the last two would exceed the shared quota.
create function public.weather_provider_claim_batch(p_provider text,p_units integer[],p_history boolean default true)
returns uuid[] language plpgsql security invoker set search_path=public as $$
declare tokens uuid[]:='{}'; t uuid; u integer;
begin
  if cardinality(p_units) is null or cardinality(p_units)<1 or cardinality(p_units)>50 then raise exception 'invalid_weather_batch'; end if;
  perform pg_advisory_xact_lock(hashtextextended('weather-provider:'||p_provider,0));
  foreach u in array p_units loop
    t:=public.weather_provider_claim(p_provider,u,p_history);
    if t is null then raise exception 'weather_budget_deferred'; end if;
    tokens:=array_append(tokens,t);
  end loop;
  return tokens;
end $$;
revoke all on function public.weather_provider_claim_batch(text,integer[],boolean) from public,anon,authenticated;
grant execute on function public.weather_provider_claim_batch(text,integer[],boolean) to service_role;
