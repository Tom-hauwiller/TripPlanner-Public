# TripPlanner

Personal AI working files for trip planning experiments.

## Spain 2026 Dashboard

This repo contains a static, no-build public dashboard for the Spain trip:

- `index.html` opens the dashboard.
- `styles.css` controls the responsive layout.
- `app.js` renders the timeline, filters, route maps, lists, and copy actions.
- Supabase is the editable source of truth for private itinerary/list data once configured.

The dashboard is designed for GitHub Pages as a static shell. Private itinerary/list data loads from Supabase after sign-in.

For shared mobile access, the app can connect to Supabase. If `supabase-config.js` has a project URL and anon key, all users must sign in before entering. Traveler accounts can edit packing, to-do, and bucket-list items; guest accounts can view everything but cannot edit. If Supabase is not configured, list edits stay local to the browser.

## Supabase Shared Editing

1. Create a Supabase project.
2. In the Supabase SQL editor, run `supabase/schema.sql`.
3. Create Auth users for Tom, Charley, and the shared guest login.
4. Insert Tom/Charley user IDs into `trip_members` for `spain-2026` with role `owner` or `editor`.
5. Insert the shared guest user ID into `trip_members` for `spain-2026` with role `guest`.
6. Fill in `supabase-config.js`:

```js
window.TRIP_SUPABASE_CONFIG = {
  url: "https://your-project.supabase.co",
  anonKey: "your-public-anon-key",
  tripSlug: "spain-2026"
};
```

The anon key is intended to be public in browser apps, but Row Level Security must stay enabled. Do not put a Supabase service-role key in this repo.

If the app reports `permission denied for table trip_list_items`, re-run the schema or run the `grant` statements near the top of `supabase/schema.sql`. The grants allow the authenticated API role to reach the table; RLS policies still decide which rows it can read or change.

If you set up the database before guest roles existed, run `supabase/migrate-guest-roles.sql` once.

If you set up the database before scheduled bucket-list items existed, run `supabase/migrate-custom-itinerary.sql` once.

If you set up the database before private itinerary hosting existed, run `supabase/migrate-private-trip-items.sql` once. Then run the generated private seed file `incoming/seed-trip-items.sql` in Supabase SQL Editor. That seed file is intentionally ignored by git.

Bucket-list ideas can be added into the main itinerary with the Add button. The app places them on the open full day for that city, with zero initial duration. Inserted items are stored in Supabase, appear chronologically in the timeline, and can be edited or deleted by traveler accounts.

Open the app normally and sign in. Travelers use Tom/Charley accounts with `owner` or `editor` roles. Guests use the shared guest account with the `guest` role.

When Supabase is configured, the normal app URL is private by default: signed-out users see only the sign-in/sync panel, not the full itinerary. Guest users can see the full dashboard and details but edit controls are hidden.

For local testing, prefer an HTTP server instead of opening `index.html` with `file://`:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8765/`.

Signed-out users cannot enter the app when Supabase is configured.

## Private Data Policy

Private itinerary details belong in Supabase, not in static files committed to the public frontend.

Do not commit confirmation codes, PINs, ticket numbers, payment card fragments, private booking links, account links, passport details, or other sensitive personal data.
