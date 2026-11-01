alter table public.profiles
  add column avatar_url text,
  add column sports_interests text[] not null default '{}';

alter table public.profiles
  add constraint profiles_avatar_url_length
    check (
      avatar_url is null
      or (
        char_length(avatar_url) <= 2048
        and avatar_url ~* '^https?://'
      )
    ),
  add constraint profiles_sports_interests_limit
    check (
      cardinality(sports_interests) <= 20
      and array_position(sports_interests, null) is null
    );

create table public.profile_fitness_goals (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  fitness_goals text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profile_fitness_goals_limit
    check (
      cardinality(fitness_goals) <= 12
      and array_position(fitness_goals, null) is null
    )
);

create trigger profile_fitness_goals_set_updated_at
before update on public.profile_fitness_goals
for each row execute function public.set_updated_at();

alter table public.profile_fitness_goals enable row level security;

revoke all on table public.profile_fitness_goals
  from public, anon, authenticated;

create policy "Users can read their own profile fitness goals"
on public.profile_fitness_goals for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can create their own profile fitness goals"
on public.profile_fitness_goals for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own profile fitness goals"
on public.profile_fitness_goals for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

grant update (avatar_url, sports_interests)
  on public.profiles to authenticated;
grant select, insert, update
  on public.profile_fitness_goals to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_username text;
  safe_username text;
  created_profile_id uuid;
  fallback_attempt integer := 0;
begin
  requested_username := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));

  if requested_username ~ '^[a-z0-9_]{3,24}$' then
    insert into public.profiles (id, username, display_name)
    values (
      new.id,
      requested_username,
      left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60)
    )
    on conflict (username) do nothing
    returning id into created_profile_id;
  end if;

  while created_profile_id is null loop
    fallback_attempt := fallback_attempt + 1;
    if fallback_attempt > 10 then
      raise exception 'Could not allocate a unique MOVEIT username';
    end if;

    safe_username := 'moveit_' || substr(
      replace(
        case
          when fallback_attempt = 1 then new.id
          else pg_catalog.gen_random_uuid()
        end::text,
        '-',
        ''
      ),
      1,
      16
    );

    insert into public.profiles (id, username, display_name)
    values (
      new.id,
      safe_username,
      left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 60)
    )
    on conflict (username) do nothing
    returning id into created_profile_id;
  end loop;

  insert into public.user_roles (user_id, role) values (new.id, 'athlete');
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.save_my_athlete_profile(
  p_username text,
  p_display_name text,
  p_bio text,
  p_city text,
  p_avatar_url text,
  p_sports_interests text[],
  p_fitness_goals text[]
)
returns table (
  id uuid,
  username text,
  display_name text,
  bio text,
  city text,
  visibility public.profile_visibility,
  avatar_url text,
  sports_interests text[],
  fitness_goals text[],
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;

  update public.profiles as profile
  set username = lower(btrim(p_username)),
      display_name = btrim(p_display_name),
      bio = btrim(p_bio),
      city = btrim(p_city),
      avatar_url = p_avatar_url,
      sports_interests = coalesce(p_sports_interests, '{}'::text[])
  where profile.id = owner_id;

  if not found then
    raise exception 'Profile not found or access denied';
  end if;

  insert into public.profile_fitness_goals (user_id, fitness_goals)
  values (owner_id, coalesce(p_fitness_goals, '{}'::text[]))
  on conflict (user_id)
  do update set fitness_goals = excluded.fitness_goals;

  return query
  select
    profile.id,
    profile.username,
    profile.display_name,
    profile.bio,
    profile.city,
    profile.visibility,
    profile.avatar_url,
    profile.sports_interests,
    goals.fitness_goals,
    profile.created_at,
    profile.updated_at
  from public.profiles as profile
  join public.profile_fitness_goals as goals on goals.user_id = profile.id
  where profile.id = owner_id;
end;
$$;

revoke all on function public.save_my_athlete_profile(text, text, text, text, text, text[], text[])
  from public, anon;
grant execute on function public.save_my_athlete_profile(text, text, text, text, text, text[], text[])
  to authenticated;
