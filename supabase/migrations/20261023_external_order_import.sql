-- External delivery history is intentionally isolated from the curated
-- restaurants, dishes, ratings, cuisines, and family-member users tables.

create table public.external_accounts (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  account_key text not null,
  label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint external_accounts_provider_check
    check (provider in ('postmates', 'ubereats')),
  constraint external_accounts_account_key_check
    check (account_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  constraint external_accounts_provider_key_unique
    unique (provider, account_key)
);

create table public.external_sync_runs (
  id uuid primary key default gen_random_uuid(),
  external_account_id uuid not null
    references public.external_accounts(id) on delete cascade,
  source text not null default 'history',
  state text not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  page_count integer,
  order_count integer not null default 0,
  item_count integer not null default 0,
  orders_without_item_details integer not null default 0,
  earliest_order_at timestamptz,
  latest_order_at timestamptz,
  error text,
  constraint external_sync_runs_source_check
    check (source in ('history', 'active', 'csv_import')),
  constraint external_sync_runs_state_check
    check (state in ('running', 'complete', 'failed')),
  constraint external_sync_runs_counts_check
    check (order_count >= 0 and item_count >= 0 and orders_without_item_details >= 0)
);

create table public.external_merchants (
  id uuid primary key default gen_random_uuid(),
  external_account_id uuid not null
    references public.external_accounts(id) on delete cascade,
  provider_merchant_id text not null,
  current_name text not null,
  current_address text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_sync_run_id uuid
    references public.external_sync_runs(id) on delete set null,
  constraint external_merchants_provider_id_check
    check (provider_merchant_id <> ''),
  constraint external_merchants_account_provider_id_unique
    unique (external_account_id, provider_merchant_id)
);

create table public.external_menu_items (
  id uuid primary key default gen_random_uuid(),
  external_account_id uuid not null
    references public.external_accounts(id) on delete cascade,
  external_merchant_id uuid not null
    references public.external_merchants(id) on delete cascade,
  provider_menu_item_id text not null,
  current_name text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_sync_run_id uuid
    references public.external_sync_runs(id) on delete set null,
  constraint external_menu_items_provider_id_check
    check (provider_menu_item_id <> ''),
  constraint external_menu_items_merchant_provider_id_unique
    unique (external_account_id, external_merchant_id, provider_menu_item_id)
);

create table public.external_orders (
  id uuid primary key default gen_random_uuid(),
  external_account_id uuid not null
    references public.external_accounts(id) on delete cascade,
  external_merchant_id uuid not null
    references public.external_merchants(id) on delete restrict,
  provider_order_id text not null,
  provider_workflow_id text,
  merchant_name_snapshot text not null,
  merchant_address_snapshot text,
  source_created_at timestamptz,
  completed_at timestamptz,
  last_state_change_at timestamptz,
  provider_status text,
  cancelled boolean,
  currency text,
  total_minor bigint,
  total_source jsonb not null default 'null'::jsonb,
  fare_breakdown jsonb not null default '[]'::jsonb,
  items_available boolean not null,
  items_source text,
  item_line_count integer,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_sync_run_id uuid
    references public.external_sync_runs(id) on delete set null,
  constraint external_orders_provider_order_id_check
    check (provider_order_id <> ''),
  constraint external_orders_item_count_check
    check (item_line_count is null or item_line_count >= 0),
  constraint external_orders_fare_array_check
    check (jsonb_typeof(fare_breakdown) = 'array'),
  constraint external_orders_account_provider_order_unique
    unique (external_account_id, provider_order_id)
);

create table public.external_order_items (
  id uuid primary key default gen_random_uuid(),
  external_order_id uuid not null
    references public.external_orders(id) on delete cascade,
  external_menu_item_id uuid
    references public.external_menu_items(id) on delete set null,
  source_item_key text not null,
  provider_order_line_id text,
  provider_menu_item_id text,
  line_index integer not null,
  name_snapshot text not null,
  quantity numeric,
  price_minor bigint,
  price_source jsonb not null default 'null'::jsonb,
  customizations jsonb not null default '[]'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_sync_run_id uuid
    references public.external_sync_runs(id) on delete set null,
  constraint external_order_items_source_key_check
    check (source_item_key <> ''),
  constraint external_order_items_line_index_check
    check (line_index > 0),
  constraint external_order_items_quantity_check
    check (quantity is null or quantity >= 0),
  constraint external_order_items_customizations_array_check
    check (jsonb_typeof(customizations) = 'array'),
  constraint external_order_items_order_source_key_unique
    unique (external_order_id, source_item_key),
  constraint external_order_items_order_line_index_unique
    unique (external_order_id, line_index)
);

create index external_sync_runs_account_started_idx
  on public.external_sync_runs (external_account_id, started_at desc);
create index external_merchants_account_name_idx
  on public.external_merchants (external_account_id, current_name);
create index external_menu_items_merchant_name_idx
  on public.external_menu_items (external_merchant_id, current_name);
create index external_orders_account_completed_idx
  on public.external_orders (external_account_id, completed_at desc);
create index external_orders_merchant_idx
  on public.external_orders (external_merchant_id);
create index external_order_items_menu_item_idx
  on public.external_order_items (external_menu_item_id);

-- PostgREST upserts may materialize column defaults for omitted fields. Preserve
-- the original observation time even when a row is seen in later sync runs.
create function public.preserve_external_first_seen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.first_seen_at := old.first_seen_at;
  return new;
end;
$$;

create function public.preserve_external_account_created_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := old.created_at;
  return new;
end;
$$;

revoke all on function public.preserve_external_first_seen() from public;
revoke all on function public.preserve_external_account_created_at() from public;

create trigger preserve_external_accounts_created_at
  before update on public.external_accounts
  for each row execute function public.preserve_external_account_created_at();

create trigger preserve_external_merchants_first_seen
  before update on public.external_merchants
  for each row execute function public.preserve_external_first_seen();
create trigger preserve_external_menu_items_first_seen
  before update on public.external_menu_items
  for each row execute function public.preserve_external_first_seen();
create trigger preserve_external_orders_first_seen
  before update on public.external_orders
  for each row execute function public.preserve_external_first_seen();
create trigger preserve_external_order_items_first_seen
  before update on public.external_order_items
  for each row execute function public.preserve_external_first_seen();

alter table public.external_accounts enable row level security;
alter table public.external_sync_runs enable row level security;
alter table public.external_merchants enable row level security;
alter table public.external_menu_items enable row level security;
alter table public.external_orders enable row level security;
alter table public.external_order_items enable row level security;

-- The Food Ratings browser receives no access yet. A backend secret key maps to
-- service_role and bypasses RLS, but still needs explicit table privileges.
revoke all on table public.external_accounts from anon, authenticated;
revoke all on table public.external_sync_runs from anon, authenticated;
revoke all on table public.external_merchants from anon, authenticated;
revoke all on table public.external_menu_items from anon, authenticated;
revoke all on table public.external_orders from anon, authenticated;
revoke all on table public.external_order_items from anon, authenticated;

grant select, insert, update, delete on table public.external_accounts to service_role;
grant select, insert, update, delete on table public.external_sync_runs to service_role;
grant select, insert, update, delete on table public.external_merchants to service_role;
grant select, insert, update, delete on table public.external_menu_items to service_role;
grant select, insert, update, delete on table public.external_orders to service_role;
grant select, insert, update, delete on table public.external_order_items to service_role;

comment on table public.external_accounts is
  'Server-managed delivery-provider accounts; contains no provider session secrets.';
comment on table public.external_orders is
  'Imported provider orders kept separate from curated Food Ratings restaurants and dishes.';
comment on column public.external_orders.total_minor is
  'Provider total in minor units when verified; total_source preserves the source value.';
comment on column public.external_order_items.price_minor is
  'Provider item price in minor units when verified; price_source preserves the source value.';
