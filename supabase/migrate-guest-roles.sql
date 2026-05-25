alter table public.trip_members
drop constraint if exists trip_members_role_check;

alter table public.trip_members
add constraint trip_members_role_check
check (role in ('owner', 'editor', 'guest'));

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

-- After creating the shared guest Auth user, run this separately:
-- insert into public.trip_members (trip_slug, user_id, role)
-- values ('spain-2026', '<guest auth.users.id>', 'guest')
-- on conflict (trip_slug, user_id) do update set role = excluded.role;
