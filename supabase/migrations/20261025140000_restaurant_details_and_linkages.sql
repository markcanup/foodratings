alter table public.restaurants
  add column if not exists comments text;

comment on column public.restaurants.comments is
  'General restaurant comments not associated with an individual user.';

comment on column public.restaurants.rating is
  'Optional restaurant-level rating override; null uses the calculated dish rating.';

-- Return only the merchant data needed by the edit page for one restaurant.
-- Existing association mutation RPCs remain the single write path.
create function public.admin_restaurant_linkages(p_restaurant_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.restaurants as restaurant
     where restaurant.id = p_restaurant_id
  ) then
    raise exception 'Restaurant not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'linkedMerchants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', merchant.id,
          'currentName', merchant.current_name,
          'currentAddress', merchant.current_address,
          'provider', account.provider,
          'accountLabel', account.label
        )
        order by lower(merchant.current_name), merchant.id
      )
      from public.restaurant_external_merchants as association
      join public.external_merchants as merchant
        on merchant.id = association.external_merchant_id
      join public.external_accounts as account
        on account.id = merchant.external_account_id
      where association.restaurant_id = p_restaurant_id
    ), '[]'::jsonb),
    'availableMerchants', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', merchant.id,
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
      where not exists (
        select 1
          from public.restaurant_external_merchants as association
         where association.external_merchant_id = merchant.id
      )
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.admin_restaurant_linkages(uuid) from public;
grant execute on function public.admin_restaurant_linkages(uuid) to authenticated, service_role;
