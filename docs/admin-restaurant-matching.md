# Admin restaurant matching

The admin area starts at `/admin`. Its first tool compares curated `restaurants`
with imported `external_merchants` and saves one-to-many associations.

## Database setup

Apply the Supabase migrations in chronological order through
`supabase/migrations/20261027130000_create_restaurant_from_external_merchant.sql`
to development before testing the pages. After they are verified in development,
promote the same migrations to production before deploying the UI.

The migration creates `restaurant_external_merchants`. A restaurant can have
many external merchants, but each external merchant can belong to only one
restaurant.

The external import tables remain inaccessible through the browser API. The
page uses narrowly scoped security-definer functions that verify the current
authenticated user is present in `app_admins` before returning comparison data
or changing associations.

Add an administrator separately in each environment because Auth user IDs may
differ between development and production:

```sql
insert into public.app_admins (user_id)
select id
from auth.users
where email = 'your-admin-email@example.com';
```

## Comparison groups

Restaurants appear in the first matching group that applies:

1. Already associated with one or more external merchants.
2. Case-insensitive exact name match.
3. Similar normalized name, using token, substring, and bigram similarity.
4. No automatic suggestion.

Every group includes a manual merchant selector so unusual names and multiple
provider records can still be associated.

## Creating a restaurant from a merchant

For allowlisted admins, the Add Restaurant form includes a dropdown containing
only external merchants that are not already associated. Selecting one fills the
restaurant name and location from the merchant. Saving creates the restaurant and
association atomically, so a linkage failure cannot leave behind an extra curated
restaurant.
