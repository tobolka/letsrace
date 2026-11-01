begin;
update event_overrides set fields=fields||jsonb_build_object('categories',(select jsonb_agg(to_jsonb(c)-'event_id') from event_categories c where c.event_id=event_overrides.event_id)),locked_fields=array(select distinct unnest(locked_fields||array['categories'])),updated_at=now() where event_id in ('258bb5a5-8cc3-4cfb-8726-4211db0fc7a5','a18b06a4-03b7-4b7c-a0f4-ece6a475441f','c04842aa-824c-4879-af74-3013d5c47681');
commit;
