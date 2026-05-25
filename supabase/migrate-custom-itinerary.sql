create table if not exists public.trip_itinerary_items (
  id text primary key,
  trip_slug text not null references public.trips(slug) on delete cascade,
  item_type text not null default 'stop' check (item_type in ('stop', 'wishlist')),
  status text not null default 'planned',
  title text not null,
  city text not null,
  start_at text not null,
  end_at text,
  summary text,
  notes jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_itinerary_items_trip_idx
  on public.trip_itinerary_items (trip_slug, start_at, created_at);

alter table public.trip_itinerary_items enable row level security;

grant select, insert, update, delete on public.trip_itinerary_items to authenticated;

drop policy if exists "members can read trip itinerary items" on public.trip_itinerary_items;
create policy "members can read trip itinerary items"
on public.trip_itinerary_items
for select
to authenticated
using (public.is_trip_member(trip_slug));

drop policy if exists "members can insert trip itinerary items" on public.trip_itinerary_items;
create policy "members can insert trip itinerary items"
on public.trip_itinerary_items
for insert
to authenticated
with check (public.can_edit_trip(trip_slug));

drop policy if exists "members can update trip itinerary items" on public.trip_itinerary_items;
create policy "members can update trip itinerary items"
on public.trip_itinerary_items
for update
to authenticated
using (public.can_edit_trip(trip_slug))
with check (public.can_edit_trip(trip_slug));

drop policy if exists "members can delete trip itinerary items" on public.trip_itinerary_items;
create policy "members can delete trip itinerary items"
on public.trip_itinerary_items
for delete
to authenticated
using (public.can_edit_trip(trip_slug));

drop trigger if exists trip_itinerary_items_updated_at on public.trip_itinerary_items;
create trigger trip_itinerary_items_updated_at
before insert or update on public.trip_itinerary_items
for each row execute function public.set_trip_list_item_updated_at();
