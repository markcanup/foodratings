-- Link curated dishes to individual parts of imported ordered menu items.
-- A component is either the menu item itself or one selected customization.
create table public.dish_external_order_components (
  dish_id uuid not null
    references public.dishes(id) on delete cascade,
  external_order_item_id uuid not null
    references public.external_order_items(id) on delete cascade,
  component_key text not null,
  component_kind text not null,
  component_name text not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint dish_external_order_components_pkey
    primary key (external_order_item_id, component_key),
  constraint dish_external_order_components_kind_check
    check (component_kind in ('menu_item', 'customization')),
  constraint dish_external_order_components_key_check
    check (
      (component_kind = 'menu_item' and component_key = 'menu-item')
      or
      (component_kind = 'customization' and component_key ~ '^customization:[^[:space:]]+$')
    ),
  constraint dish_external_order_components_name_check
    check (btrim(component_name) <> ''),
  constraint dish_external_order_components_key_length_check
    check (length(component_key) <= 512)
);

create index dish_external_order_components_dish_idx
  on public.dish_external_order_components (dish_id, created_at);

alter table public.dish_external_order_components enable row level security;
revoke all on table public.dish_external_order_components from anon, authenticated;
grant select, insert, update, delete on table public.dish_external_order_components to service_role;

comment on table public.dish_external_order_components is
  'Authenticated app-managed links from dishes to menu-item and customization components of imported order lines.';

-- Keep imported order tables private while returning only order lines belonging
-- to an external merchant associated with this dish's restaurant.
create function public.dish_order_linkages(p_dish_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  dish_restaurant_id uuid;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select dish.restaurant_id
    into dish_restaurant_id
    from public.dishes as dish
   where dish.id = p_dish_id;

  if dish_restaurant_id is null then
    raise exception 'Dish not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'linkedComponents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'orderItemId', linkage.external_order_item_id,
          'componentKey', linkage.component_key,
          'componentKind', linkage.component_kind,
          'componentName', linkage.component_name,
          'menuItemName', order_item.name_snapshot,
          'merchantName', external_order.merchant_name_snapshot,
          'orderedAt', coalesce(
            external_order.completed_at,
            external_order.source_created_at,
            external_order.first_seen_at
          )
        )
        order by
          coalesce(
            external_order.completed_at,
            external_order.source_created_at,
            external_order.first_seen_at
          ) desc,
          order_item.line_index,
          linkage.created_at
      )
      from public.dish_external_order_components as linkage
      join public.external_order_items as order_item
        on order_item.id = linkage.external_order_item_id
      join public.external_orders as external_order
        on external_order.id = order_item.external_order_id
      where linkage.dish_id = p_dish_id
    ), '[]'::jsonb),
    'availableItems', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', available_item.id,
          'menuItemName', available_item.menu_item_name,
          'merchantName', available_item.merchant_name,
          'orderedAt', available_item.ordered_at,
          'quantity', available_item.quantity,
          'customizations', available_item.customizations,
          'associations', available_item.associations
        )
        order by available_item.ordered_at desc, available_item.line_index
      )
      from (
        select
          order_item.id,
          order_item.name_snapshot as menu_item_name,
          external_order.merchant_name_snapshot as merchant_name,
          coalesce(
            external_order.completed_at,
            external_order.source_created_at,
            external_order.first_seen_at
          ) as ordered_at,
          order_item.line_index,
          order_item.quantity,
          order_item.customizations,
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'componentKey', linkage.component_key,
                'dishId', linkage.dish_id,
                'dishName', linked_dish.name
              )
              order by linkage.component_key
            )
            from public.dish_external_order_components as linkage
            join public.dishes as linked_dish
              on linked_dish.id = linkage.dish_id
            where linkage.external_order_item_id = order_item.id
          ), '[]'::jsonb) as associations
        from public.external_order_items as order_item
        join public.external_orders as external_order
          on external_order.id = order_item.external_order_id
        join public.restaurant_external_merchants as merchant_linkage
          on merchant_linkage.external_merchant_id = external_order.external_merchant_id
         and merchant_linkage.restaurant_id = dish_restaurant_id
        where external_order.cancelled is not true
      ) as available_item
    ), '[]'::jsonb)
  );
end;
$$;

create function public.associate_dish_order_components(
  p_dish_id uuid,
  p_external_order_item_id uuid,
  p_components jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  dish_restaurant_id uuid;
  menu_item_name text;
  component jsonb;
  requested_component_key text;
  requested_component_kind text;
  requested_component_name text;
  existing_dish_id uuid;
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_components is null
     or jsonb_typeof(p_components) <> 'array'
     or jsonb_array_length(p_components) = 0 then
    raise exception 'Select at least one menu-item component' using errcode = '22023';
  end if;

  select dish.restaurant_id
    into dish_restaurant_id
    from public.dishes as dish
   where dish.id = p_dish_id;

  if dish_restaurant_id is null then
    raise exception 'Dish not found' using errcode = 'P0002';
  end if;

  select order_item.name_snapshot
    into menu_item_name
    from public.external_order_items as order_item
    join public.external_orders as external_order
      on external_order.id = order_item.external_order_id
    join public.restaurant_external_merchants as merchant_linkage
      on merchant_linkage.external_merchant_id = external_order.external_merchant_id
     and merchant_linkage.restaurant_id = dish_restaurant_id
   where order_item.id = p_external_order_item_id
     and external_order.cancelled is not true;

  if menu_item_name is null then
    raise exception 'Ordered menu item not found for this restaurant' using errcode = 'P0002';
  end if;

  for component in select value from jsonb_array_elements(p_components)
  loop
    requested_component_key := component ->> 'key';
    requested_component_kind := component ->> 'kind';
    requested_component_name := nullif(btrim(component ->> 'name'), '');

    if requested_component_kind = 'menu_item' then
      if requested_component_key <> 'menu-item' then
        raise exception 'Invalid menu-item component' using errcode = '22023';
      end if;
      requested_component_name := menu_item_name;
    elsif requested_component_kind = 'customization' then
      if requested_component_key is null
         or requested_component_key !~ '^customization:[^[:space:]]+$'
         or length(requested_component_key) > 512
         or requested_component_name is null then
        raise exception 'Invalid customization component' using errcode = '22023';
      end if;
    else
      raise exception 'Invalid component kind' using errcode = '22023';
    end if;

    select linkage.dish_id
      into existing_dish_id
     from public.dish_external_order_components as linkage
     where linkage.external_order_item_id = p_external_order_item_id
       and linkage.component_key = requested_component_key;

    if existing_dish_id is not null and existing_dish_id <> p_dish_id then
      raise exception 'That menu-item component is already linked to another dish'
        using errcode = '23505';
    end if;

    insert into public.dish_external_order_components (
      dish_id,
      external_order_item_id,
      component_key,
      component_kind,
      component_name,
      created_by
    ) values (
      p_dish_id,
      p_external_order_item_id,
      requested_component_key,
      requested_component_kind,
      requested_component_name,
      auth.uid()
    )
    on conflict (external_order_item_id, component_key) do nothing;
  end loop;
end;
$$;

create function public.remove_dish_order_component(
  p_dish_id uuid,
  p_external_order_item_id uuid,
  p_component_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  delete from public.dish_external_order_components
   where dish_id = p_dish_id
     and external_order_item_id = p_external_order_item_id
     and component_key = p_component_key;
end;
$$;

revoke all on function public.dish_order_linkages(uuid) from public;
revoke all on function public.associate_dish_order_components(uuid, uuid, jsonb) from public;
revoke all on function public.remove_dish_order_component(uuid, uuid, text) from public;

grant execute on function public.dish_order_linkages(uuid) to authenticated, service_role;
grant execute on function public.associate_dish_order_components(uuid, uuid, jsonb) to authenticated, service_role;
grant execute on function public.remove_dish_order_component(uuid, uuid, text) to authenticated, service_role;
