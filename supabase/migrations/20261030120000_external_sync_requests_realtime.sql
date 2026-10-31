-- Wake the outbound sync helper when an administrator queues a request. The
-- helper still uses its atomic claim RPC and retains low-frequency fallback
-- polling, so missed WebSocket events remain safe.
do $$
begin
  if not exists (
    select 1
      from pg_catalog.pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'external_sync_requests'
  ) then
    alter publication supabase_realtime
      add table public.external_sync_requests;
  end if;
end;
$$;
