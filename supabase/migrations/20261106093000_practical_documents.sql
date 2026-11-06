-- Links to a race's regulations, organisers' instructions and series rules.
do $$
declare body text;
begin
  select pg_get_functiondef('public.pipeline_save_practical_details'::regproc) into body;
  body := replace(body, '(select count(*) from jsonb_object_keys(p_details))>7', '(select count(*) from jsonb_object_keys(p_details))>8');
  body := replace(body, '''parking'',''categories'')', '''parking'',''categories'',''documents'')');
  execute body;
end $$;
