create type public.app_role as enum (
  'athlete',
  'coach',
  'venue_owner',
  'moderator',
  'administrator'
);

create type public.profile_visibility as enum ('public', 'private');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text not null default '',
  bio text not null default '',
  city text not null default 'Lahore',
  visibility public.profile_visibility not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_display_name_length check (char_length(display_name) <= 60),
  constraint profiles_bio_length check (char_length(bio) <= 280),
  constraint profiles_city_length check (char_length(city) between 1 and 80)
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users (id) on delete set null,
  primary key (user_id, role)
);

create index profiles_city_idx on public.profiles (city);
create index user_roles_role_idx on public.user_roles (role);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  safe_username text;
begin
  requested_username := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  if requested_username !~ '^[a-z0-9_]{3,24}$' then
    safe_username := 'moveit_' || substr(replace(new.id::text, '-', ''), 1, 16);
  else
    safe_username := requested_username;
  end if;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    safe_username,
    left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60)
  );
  insert into public.user_roles (user_id, role) values (new.id, 'athlete');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.has_app_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = required_role
  );
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create policy "Users can read public profiles or their own"
on public.profiles for select to authenticated
using (visibility = 'public' or id = (select auth.uid()));

create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Users can read their own roles"
on public.user_roles for select to authenticated
using (user_id = (select auth.uid()));

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.has_app_role(public.app_role) from public, anon;
grant execute on function public.has_app_role(public.app_role) to authenticated;

grant select on public.profiles to authenticated;
grant update (username, display_name, bio, city, visibility) on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
