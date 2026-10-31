# App-triggered Postmates sync

Food Ratings administrators can request a Postmates history sync from the admin
page. The browser only inserts a queue record through an admin-only Supabase RPC.
It never receives the Postmates session or the Supabase server secret.

The `postmates-sync` helper subscribes to the selected development or production
queue from the Ubuntu server and uses mealtime-aware fallback polling for missed
events or requests queued while it was offline. It claims one request at a time,
reads provider history with the encrypted saved session, and loads the provider
order IDs already stored for that external account. It imports only history
records whose provider order ID is absent from `external_orders`.
The database uniqueness constraint on `(external_account_id, provider_order_id)`
remains the final duplicate-write safeguard.

## Deployment order

1. Apply `supabase/migrations/20261027120000_external_sync_requests.sql` to the
   development Supabase project.
2. Apply `supabase/migrations/20261030120000_external_sync_requests_realtime.sql`
   to add the request queue to the Supabase Realtime publication.
3. Add both projects' URLs and corresponding server secret keys to the protected
   `postmates-sync` `supabase.json`, then rebuild and restart that service. Its
   dashboard shows the URLs but never the keys.
4. In the helper dashboard, select **Development** for local testing. The selected
   environment controls the Realtime subscription, fallback checks, and imports
   and persists across restarts. Configure the mealtime window, time zone, and
   separate fallback frequencies there as needed.
5. Rebuild Food Ratings, sign in as an allowlisted app administrator, open Admin,
   and select **Sync Postmates now**.

A request stays queued while the helper is offline. Failed requests display a
safe error in the app. A request left running for more than 30 minutes is eligible
for retry; repeat safety comes from filtering stored order IDs and the database
unique constraint.
