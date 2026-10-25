-- Explicit allowlist for browser-based administrative tools. Authenticated app
-- users are not administrators unless their auth user id appears here.
create table public.app_admins (
  user_id uuid primary key
    references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
revoke all on table public.app_admins from anon, authenticated;
grant select, insert, update, delete on table public.app_admins to service_role;

comment on table public.app_admins is
  'Allowlist of authenticated users permitted to use Food Ratings admin tools.';

create function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1
        from public.app_admins as app_admin
       where app_admin.user_id = auth.uid()
    );
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated, service_role;

-- One curated restaurant may represent several provider-specific merchant records.
-- External merchants are unique to a single curated restaurant association.
create table public.restaurant_external_merchants (
  restaurant_id uuid not null
    references public.restaurants(id) on delete cascade,
  external_merchant_id uuid not null
    references public.external_merchants(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  constraint restaurant_external_merchants_pkey
    primary key (restaurant_id, external_merchant_id),
  constraint restaurant_external_merchants_external_merchant_unique
    unique (external_merchant_id)
);

alter table public.restaurant_external_merchants enable row level security;
revoke all on table public.restaurant_external_merchants from anon, authenticated;
grant select, insert, update, delete on table public.restaurant_external_merchants to service_role;

comment on table public.restaurant_external_merchants is
  'Admin-managed links from curated restaurants to imported provider merchants.';

-- Keep the external import tables private. Allowlisted admins receive only the
-- comparison fields required by the UI through this security-definer RPC.
create function public.admin_restaurant_merchant_comparison()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'restaurants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', restaurant.id,
          'name', restaurant.name,
          'location', restaurant.location
        )
        order by lower(restaurant.name), restaurant.id
      )
      from public.restaurants as restaurant
    ), '[]'::jsonb),
    'externalMerchants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', merchant.id,
          'externalAccountId', merchant.external_account_id,
          'providerMerchantId', merchant.provider_merchant_id,
          'currentName', merchant.current_name,
          'currentAddress', merchant.current_address,
          'provider', account.provider,
          'accountLabel', account.label
        )
        order by lower(merchant.current_name), merchant.id
      )
      from public.external_merchants as merchant
      join public.external_accounts as account
        on account.id = merchant.external_account_id
    ), '[]'::jsonb),
    'associations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'restaurantId', association.restaurant_id,
          'externalMerchantId', association.external_merchant_id,
          'createdAt', association.created_at
        )
        order by association.created_at, association.external_merchant_id
      )
      from public.restaurant_external_merchants as association
    ), '[]'::jsonb)
  );
end;
$$;

create function public.admin_associate_restaurant_merchant(
  p_restaurant_id uuid,
  p_external_merchant_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_restaurant_id uuid;
begin
  if not public.is_app_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select association.restaurant_id
    into existing_restaurant_id
    from public.restaurant_external_merchants as association
   where association.external_merchant_id = p_external_merchant_id;

  if existing_restaurant_id = p_restaurant_id then
    return;
  end if;

  if existing_restaurant_id is not null then
    raise exception 'External merchant is already associated with another restaurant'
      using errcode = '23505';
  end if;

  insert into public.restaurant_external_merchants (
    restaurant_id,
    external_merchant_id,
    created_by
  ) values (
    p_restaurant_id,
    p_external_merchant_id,
    auth.uid()
  );
end;
$$;

create function public.admin_remove_restaurant_merchant_association(
  p_restaurant_id uuid,
  p_external_merchant_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  delete from public.restaurant_external_merchants
   where restaurant_id = p_restaurant_id
     and external_merchant_id = p_external_merchant_id;
end;
$$;

revoke all on function public.admin_restaurant_merchant_comparison() from public;
revoke all on function public.admin_associate_restaurant_merchant(uuid, uuid) from public;
revoke all on function public.admin_remove_restaurant_merchant_association(uuid, uuid) from public;

grant execute on function public.admin_restaurant_merchant_comparison() to authenticated, service_role;
grant execute on function public.admin_associate_restaurant_merchant(uuid, uuid) to authenticated, service_role;
grant execute on function public.admin_remove_restaurant_merchant_association(uuid, uuid) to authenticated, service_role;
