create table if not exists public.trips (
  slug text primary key,
  title text not null,
  share_token text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.trip_members (
  trip_slug text not null references public.trips(slug) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner', 'editor', 'guest')),
  created_at timestamptz not null default now(),
  primary key (trip_slug, user_id)
);

create table if not exists public.trip_list_items (
  id text primary key,
  trip_slug text not null references public.trips(slug) on delete cascade,
  list_name text not null check (list_name in ('packing', 'todos', 'bucketList')),
  person text,
  city text,
  text text not null,
  done boolean not null default false,
  is_public boolean not null default false,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_items (
  id text primary key,
  trip_slug text not null references public.trips(slug) on delete cascade,
  sort_start text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create index if not exists trip_list_items_trip_idx
  on public.trip_list_items (trip_slug, list_name, sort_order, created_at);

create index if not exists trip_items_trip_idx
  on public.trip_items (trip_slug, sort_start);

create index if not exists trip_itinerary_items_trip_idx
  on public.trip_itinerary_items (trip_slug, start_at, created_at);

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_list_items enable row level security;
alter table public.trip_items enable row level security;
alter table public.trip_itinerary_items enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.trips to authenticated;
grant select on public.trip_members to authenticated;
grant select, insert, update, delete on public.trip_list_items to authenticated;
grant select, insert, update, delete on public.trip_items to authenticated;
grant select, insert, update, delete on public.trip_itinerary_items to authenticated;

create or replace function public.is_trip_member(p_trip_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_members
    where trip_slug = p_trip_slug
      and user_id = auth.uid()
  );
$$;

create or replace function public.trip_member_role(p_trip_slug text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.trip_members
  where trip_slug = p_trip_slug
    and user_id = auth.uid()
  limit 1;
$$;

create or replace function public.can_edit_trip(p_trip_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.trip_member_role(p_trip_slug) in ('owner', 'editor'), false);
$$;

drop policy if exists "members can read their trips" on public.trips;
create policy "members can read their trips"
on public.trips
for select
to authenticated
using (public.is_trip_member(slug));

drop policy if exists "members can read their memberships" on public.trip_members;
create policy "members can read their memberships"
on public.trip_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "members can read trip list items" on public.trip_list_items;
create policy "members can read trip list items"
on public.trip_list_items
for select
to authenticated
using (public.is_trip_member(trip_slug));

drop policy if exists "members can insert trip list items" on public.trip_list_items;
create policy "members can insert trip list items"
on public.trip_list_items
for insert
to authenticated
with check (public.can_edit_trip(trip_slug));

drop policy if exists "members can update trip list items" on public.trip_list_items;
create policy "members can update trip list items"
on public.trip_list_items
for update
to authenticated
using (public.can_edit_trip(trip_slug))
with check (public.can_edit_trip(trip_slug));

drop policy if exists "members can delete trip list items" on public.trip_list_items;
create policy "members can delete trip list items"
on public.trip_list_items
for delete
to authenticated
using (public.can_edit_trip(trip_slug));

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

create or replace function public.set_trip_list_item_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trip_list_items_updated_at on public.trip_list_items;
create trigger trip_list_items_updated_at
before insert or update on public.trip_list_items
for each row execute function public.set_trip_list_item_updated_at();

drop trigger if exists trip_items_updated_at on public.trip_items;
create trigger trip_items_updated_at
before insert or update on public.trip_items
for each row execute function public.set_updated_at();

drop trigger if exists trip_itinerary_items_updated_at on public.trip_itinerary_items;
create trigger trip_itinerary_items_updated_at
before insert or update on public.trip_itinerary_items
for each row execute function public.set_trip_list_item_updated_at();

create or replace function public.public_trip_list_items(p_share_token text)
returns table (
  id text,
  trip_slug text,
  list_name text,
  person text,
  city text,
  text text,
  done boolean,
  is_public boolean,
  sort_order integer,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    item.id,
    item.trip_slug,
    item.list_name,
    item.person,
    item.city,
    item.text,
    item.done,
    item.is_public,
    item.sort_order,
    item.created_at
  from public.trip_list_items item
  join public.trips trip on trip.slug = item.trip_slug
  where trip.share_token = p_share_token
    and item.is_public = true
  order by item.list_name, item.sort_order, item.created_at;
$$;

revoke all on function public.public_trip_list_items(text) from public;
grant execute on function public.public_trip_list_items(text) to anon, authenticated;

insert into public.trips (slug, title, share_token)
values ('spain-2026', 'Spain 2026', 'replace-with-a-long-random-share-token')
on conflict (slug) do nothing;

-- After creating Tom/Charley auth users in Supabase Auth, run one insert per editor:
-- insert into public.trip_members (trip_slug, user_id, role)
-- values ('spain-2026', '<auth.users.id>', 'owner');
--
-- After creating the shared guest Auth user, run:
-- insert into public.trip_members (trip_slug, user_id, role)
-- values ('spain-2026', '<guest auth.users.id>', 'guest');
