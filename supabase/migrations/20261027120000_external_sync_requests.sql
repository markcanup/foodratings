-- Queue outbound Postmates history syncs without exposing the sync service or
-- its provider session to the browser.
create table public.external_sync_requests (
  id uuid primary key default gen_random_uuid(),
  external_account_id uuid not null
    references public.external_accounts(id) on delete cascade,
  requested_by uuid
    references auth.users(id) on delete set null,
  state text not null default 'queued',
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  sync_run_id uuid
    references public.external_sync_runs(id) on delete set null,
  new_order_count integer,
  error text,
  constraint external_sync_requests_state_check
    check (state in ('queued', 'running', 'complete', 'failed')),
  constraint external_sync_requests_new_order_count_check
    check (new_order_count is null or new_order_count >= 0)
);

create index external_sync_requests_account_requested_idx
  on public.external_sync_requests (external_account_id, requested_at desc);

-- At most one outstanding request per account. Repeated button presses return
-- the existing request instead of creating duplicate provider reads.
create unique index external_sync_requests_one_active_idx
  on public.external_sync_requests (external_account_id)
  where state in ('queued', 'running');

alter table public.external_sync_requests enable row level security;
revoke all on table public.external_sync_requests from anon, authenticated;
grant select, insert, update, delete on table public.external_sync_requests to service_role;

comment on table public.external_sync_requests is
  'Admin-created sync queue consumed outbound by the Postmates helper.';

create function public.admin_request_external_sync(p_provider text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_record record;
  request_record record;
begin
  if not public.is_app_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select account.id, account.label
    into account_record
    from public.external_accounts as account
   where account.provider = p_provider
   order by account.created_at, account.id
   limit 1;

  if account_record.id is null then
    raise exception 'No % account is configured for synchronization', p_provider
      using errcode = 'P0002';
  end if;

  select request.*
    into request_record
    from public.external_sync_requests as request
   where request.external_account_id = account_record.id
     and request.state in ('queued', 'running')
   order by request.requested_at desc
   limit 1;

  if request_record.id is null then
    begin
      insert into public.external_sync_requests (
        external_account_id,
        requested_by
      ) values (
        account_record.id,
        auth.uid()
      )
      returning * into request_record;
    exception when unique_violation then
      select request.*
        into request_record
        from public.external_sync_requests as request
       where request.external_account_id = account_record.id
         and request.state in ('queued', 'running')
       order by request.requested_at desc
       limit 1;
    end;
  end if;

  return jsonb_build_object(
    'id', request_record.id,
    'state', request_record.state,
    'requestedAt', request_record.requested_at,
    'accountLabel', account_record.label
  );
end;
$$;

create function public.admin_external_sync_status(p_provider text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  account_record record;
begin
  if not public.is_app_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select account.id, account.label
    into account_record
    from public.external_accounts as account
   where account.provider = p_provider
   order by account.created_at, account.id
   limit 1;

  if account_record.id is null then
    return jsonb_build_object('configured', false);
  end if;

  return jsonb_build_object(
    'configured', true,
    'accountLabel', account_record.label,
    'request', (
      select jsonb_build_object(
        'id', request.id,
        'state', request.state,
        'requestedAt', request.requested_at,
        'startedAt', request.started_at,
        'completedAt', request.completed_at,
        'newOrderCount', request.new_order_count,
        'error', request.error
      )
      from public.external_sync_requests as request
      where request.external_account_id = account_record.id
      order by request.requested_at desc
      limit 1
    ),
    'lastSync', (
      select jsonb_build_object(
        'state', run.state,
        'startedAt', run.started_at,
        'completedAt', run.completed_at,
        'orderCount', run.order_count,
        'itemCount', run.item_count,
        'error', run.error
      )
      from public.external_sync_runs as run
      where run.external_account_id = account_record.id
      order by run.started_at desc
      limit 1
    )
  );
end;
$$;

-- The helper calls this service-role-only RPC to atomically claim one queued
-- request. A stale running request is safe to reclaim because imports filter and
-- deduplicate against existing provider order IDs before writing.
create function public.claim_external_sync_request(
  p_provider text,
  p_account_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record record;
begin
  select request.id
    into request_record
    from public.external_sync_requests as request
    join public.external_accounts as account
      on account.id = request.external_account_id
   where account.provider = p_provider
     and account.account_key = p_account_key
     and (
       request.state = 'queued'
       or (
         request.state = 'running'
         and request.started_at < now() - interval '30 minutes'
       )
     )
   order by request.requested_at
   limit 1
   for update of request skip locked;

  if request_record.id is null then
    return null;
  end if;

  update public.external_sync_requests as request
     set state = 'running',
         started_at = now(),
         completed_at = null,
         sync_run_id = null,
         new_order_count = null,
         error = null
   where request.id = request_record.id
  returning request.* into request_record;

  return jsonb_build_object(
    'id', request_record.id,
    'externalAccountId', request_record.external_account_id,
    'provider', p_provider
  );
end;
$$;

revoke all on function public.admin_request_external_sync(text) from public;
revoke all on function public.admin_external_sync_status(text) from public;
revoke all on function public.claim_external_sync_request(text, text) from public;

grant execute on function public.admin_request_external_sync(text) to authenticated, service_role;
grant execute on function public.admin_external_sync_status(text) to authenticated, service_role;
grant execute on function public.claim_external_sync_request(text, text) to service_role;
