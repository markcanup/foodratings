# Dish links to ordered menu items

The add/edit dish page can link a dish to an imported ordered menu item, one or
more of that line's customizations, or both. Each menu-item or customization
component can belong to only one dish. An ordered line remains selectable until
its menu item and every customization have been linked.

Available order lines come only from external merchants already associated with
the dish's restaurant. They are shown most-recent order first. Cancelled orders
are excluded. The selector can also copy the imported menu-item name or a
selected customization name into the dish name.

Linking an ordered item also sets the newest unsaved rating's date to the local
calendar date of the order. If every displayed rating is already saved, the
last displayed rating is updated. Each rating date field also has a **Today**
button for quickly restoring the current local date.

## Database setup

Apply `supabase/migrations/20261030130000_dish_order_component_linkages.sql`
after the external-order and restaurant-merchant association migrations. It
creates the component linkage table and authenticated functions used by the
dish form. Imported order tables remain inaccessible directly from the browser.
