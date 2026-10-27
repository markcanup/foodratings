-- Give allowlisted admins only the unmatched merchant data needed by the Add
-- Restaurant form. The external import tables remain inaccessible directly.
create function public.admin_unmatched_external_merchants()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', merchant.id,
        'currentName', merchant.current_name,
        'currentAddress', merchant.current_address,
        'provider', account.provider,
        'accountLabel', account.label
      )
      order by lower(merchant.current_name), merchant.current_address, merchant.id
    )
      from public.external_merchants as merchant
      join public.external_accounts as account
        on account.id = merchant.external_account_id
     where not exists (
       select 1
         from public.restaurant_external_merchants as association
        where association.external_merchant_id = merchant.id
     )
  ), '[]'::jsonb);
end;
$$;

-- Create the curated restaurant and its association in one transaction. Name
-- and location intentionally come from the latest imported merchant values.
create function public.admin_create_restaurant_from_external_merchant(
  p_external_merchant_id uuid,
  p_cuisine_id uuid default null,
  p_comments text default null,
  p_rating integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  merchant_record record;
  new_restaurant_id uuid;
begin
  if not public.is_app_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  select merchant.current_name, merchant.current_address
    into merchant_record
    from public.external_merchants as merchant
   where merchant.id = p_external_merchant_id
   for update;

  if not found then
    raise exception 'External merchant not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
      from public.restaurant_external_merchants as association
     where association.external_merchant_id = p_external_merchant_id
  ) then
    raise exception 'External merchant is already associated with a restaurant'
      using errcode = '23505';
  end if;

  insert into public.restaurants (
    name,
    location,
    cuisine_id,
    comments,
    rating
  ) values (
    merchant_record.current_name,
    nullif(btrim(merchant_record.current_address), ''),
    p_cuisine_id,
    nullif(btrim(p_comments), ''),
    p_rating
  )
  returning id into new_restaurant_id;

  insert into public.restaurant_external_merchants (
    restaurant_id,
    external_merchant_id,
    created_by
  ) values (
    new_restaurant_id,
    p_external_merchant_id,
    auth.uid()
  );

  return new_restaurant_id;
end;
$$;

revoke all on function public.admin_unmatched_external_merchants() from public;
revoke all on function public.admin_create_restaurant_from_external_merchant(uuid, uuid, text, integer) from public;

grant execute on function public.admin_unmatched_external_merchants() to authenticated, service_role;
grant execute on function public.admin_create_restaurant_from_external_merchant(uuid, uuid, text, integer) to authenticated, service_role;
