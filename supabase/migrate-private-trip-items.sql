create table if not exists public.trip_items (
  id text primary key,
  trip_slug text not null references public.trips(slug) on delete cascade,
  sort_start text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_items_trip_idx
  on public.trip_items (trip_slug, sort_start);

alter table public.trip_items enable row level security;

grant select, insert, update, delete on public.trip_items to authenticated;

drop policy if exists "members can read trip items" on public.trip_items;
create policy "members can read trip items"
on public.trip_items
for select
to authenticated
using (public.is_trip_member(trip_slug));

drop policy if exists "members can insert trip items" on public.trip_items;
create policy "members can insert trip items"
on public.trip_items
for insert
to authenticated
with check (public.can_edit_trip(trip_slug));

drop policy if exists "members can update trip items" on public.trip_items;
create policy "members can update trip items"
on public.trip_items
for update
to authenticated
using (public.can_edit_trip(trip_slug))
with check (public.can_edit_trip(trip_slug));

drop policy if exists "members can delete trip items" on public.trip_items;
create policy "members can delete trip items"
on public.trip_items
for delete
to authenticated
using (public.can_edit_trip(trip_slug));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trip_items_updated_at on public.trip_items;
create trigger trip_items_updated_at
before insert or update on public.trip_items
for each row execute function public.set_updated_at();
