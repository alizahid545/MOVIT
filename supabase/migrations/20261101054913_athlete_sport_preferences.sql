create table public.profile_sports_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  sport_id text not null,
  skill_level text,
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, sport_id),
  constraint profile_sports_preferences_sport_id_format
    check (sport_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  constraint profile_sports_preferences_skill_level
    check (skill_level is null or skill_level in ('beginner', 'intermediate', 'advanced'))
);

insert into public.profile_sports_preferences (user_id, sport_id, skill_level)
select profile.id, sport_id, null
from public.profiles as profile
cross join lateral unnest(profile.sports_interests) as legacy(sport_id)
where sport_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'
on conflict (user_id, sport_id) do nothing;

alter table public.profile_sports_preferences enable row level security;

revoke all on table public.profile_sports_preferences
  from public, anon, authenticated;

create policy "Users can read their own or public profile sports"
on public.profile_sports_preferences for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.profiles as profile
    where profile.id = user_id
      and profile.visibility = 'public'
  )
);

create policy "Users can add sports to their own profile"
on public.profile_sports_preferences for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can remove sports from their own profile"
on public.profile_sports_preferences for delete to authenticated
using (user_id = (select auth.uid()));

grant select on public.profile_sports_preferences to authenticated;
grant insert, delete on public.profile_sports_preferences to authenticated;

create function public.save_my_sports_preferences(p_preferences jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
  submitted_sports text[];
  preference_count integer;
  unique_sport_count integer;
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;

  if pg_catalog.jsonb_typeof(p_preferences) is distinct from 'array' then
    raise exception 'Sports preferences must be an array';
  end if;

  if pg_catalog.jsonb_array_length(p_preferences) > 20 then
    raise exception 'Choose no more than 20 sports';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_preferences) as preference(value)
    where pg_catalog.jsonb_typeof(preference.value) is distinct from 'object'
      or coalesce(preference.value ->> 'sportId', '') !~ '^[a-z0-9][a-z0-9-]{0,79}$'
      or coalesce(preference.value ->> 'skillLevel', '') not in ('beginner', 'intermediate', 'advanced')
      or pg_catalog.jsonb_typeof(preference.value -> 'isPreferred') is distinct from 'boolean'
  ) then
    raise exception 'One or more sports preferences are invalid';
  end if;

  select count(*), count(distinct preference.value ->> 'sportId')
    into preference_count, unique_sport_count
  from pg_catalog.jsonb_array_elements(p_preferences) as preference(value);

  if preference_count <> unique_sport_count then
    raise exception 'Choose each sport only once';
  end if;

  select coalesce(
    pg_catalog.array_agg(preference.value ->> 'sportId' order by preference.ordinality),
    '{}'::text[]
  )
    into submitted_sports
  from pg_catalog.jsonb_array_elements(p_preferences)
    with ordinality as preference(value, ordinality);

  delete from public.profile_sports_preferences
  where user_id = owner_id;

  insert into public.profile_sports_preferences (
    user_id,
    sport_id,
    skill_level,
    is_preferred
  )
  select
    owner_id,
    preference.value ->> 'sportId',
    preference.value ->> 'skillLevel',
    (preference.value ->> 'isPreferred')::boolean
  from pg_catalog.jsonb_array_elements(p_preferences) as preference(value);

  update public.profiles
  set sports_interests = submitted_sports
  where id = owner_id;

  if not found then
    raise exception 'Profile not found or access denied';
  end if;
end;
$$;

revoke all on function public.save_my_sports_preferences(jsonb)
  from public, anon;
grant execute on function public.save_my_sports_preferences(jsonb)
  to authenticated;