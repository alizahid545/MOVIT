alter table public.profiles
  add column discovery_radius_km smallint,
  add constraint profiles_discovery_radius_km_range
    check (discovery_radius_km is null or discovery_radius_km between 1 and 100);

alter table public.profile_sports_preferences
  drop constraint profile_sports_preferences_skill_level,
  add constraint profile_sports_preferences_skill_level
    check (skill_level is null or skill_level in ('beginner', 'intermediate', 'advanced', 'professional'));

create or replace function public.save_my_sports_preferences(p_preferences jsonb)
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
      or coalesce(preference.value ->> 'skillLevel', '') not in ('beginner', 'intermediate', 'advanced', 'professional')
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

alter table public.user_onboarding
  add column athlete_onboarding_version integer not null default 0,
  add column athlete_onboarding_step text,
  add column athlete_onboarding_completed_at timestamptz,
  add constraint user_onboarding_athlete_version_nonnegative
    check (athlete_onboarding_version >= 0),
  add constraint user_onboarding_athlete_step
    check (
      athlete_onboarding_step is null
      or athlete_onboarding_step in ('personal', 'sports', 'fitness', 'location', 'review', 'complete')
    );

update public.user_onboarding
set athlete_onboarding_version = 1,
    athlete_onboarding_step = 'complete',
    athlete_onboarding_completed_at = coalesce(updated_at, now())
where 'athlete' = any (completed_roles);

grant update (discovery_radius_km) on public.profiles to authenticated;
grant update (visibility) on public.profiles to authenticated;

create function public.save_my_athlete_preferences(
  p_fitness_goals text[],
  p_discovery_radius_km smallint,
  p_visibility text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;

  if p_fitness_goals is null
    or cardinality(p_fitness_goals) > 12
    or array_position(p_fitness_goals, null) is not null
    or exists (
      select 1
      from pg_catalog.unnest(p_fitness_goals) as goal(value)
      where char_length(btrim(goal.value)) not between 1 and 120
    )
  then
    raise exception 'Choose up to 12 fitness goals, each between 1 and 120 characters';
  end if;

  if cardinality(p_fitness_goals) <> (
    select count(distinct lower(btrim(goal.value)))
    from pg_catalog.unnest(p_fitness_goals) as goal(value)
  ) then
    raise exception 'Choose each fitness goal only once';
  end if;

  if p_discovery_radius_km is not null
    and p_discovery_radius_km not between 1 and 100
  then
    raise exception 'Discovery radius must be between 1 and 100 km';
  end if;

  if p_visibility is null or p_visibility not in ('public', 'private') then
    raise exception 'Profile visibility must be public or private';
  end if;

  update public.profiles
  set discovery_radius_km = p_discovery_radius_km,
      visibility = p_visibility
  where id = owner_id;

  if not found then
    raise exception 'Profile not found or access denied';
  end if;

  insert into public.profile_fitness_goals (user_id, fitness_goals)
  values (
    owner_id,
    coalesce(
      array(
        select btrim(goal.value)
        from pg_catalog.unnest(p_fitness_goals) as goal(value)
      ),
      '{}'::text[]
    )
  )
  on conflict (user_id)
  do update set fitness_goals = excluded.fitness_goals;
end;
$$;

revoke all on function public.save_my_athlete_preferences(text[], smallint, text)
  from public, anon;
grant execute on function public.save_my_athlete_preferences(text[], smallint, text)
  to authenticated;

create function public.save_my_athlete_onboarding_state(
  p_step text,
  p_completed boolean default false
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid := (select auth.uid());
begin
  if owner_id is null then
    raise exception 'Authentication required';
  end if;

  if p_step is null or p_step not in ('personal', 'sports', 'fitness', 'location', 'review') then
    raise exception 'Invalid athlete onboarding step';
  end if;

  if p_completed and p_step <> 'review' then
    raise exception 'Complete the review step before finishing onboarding';
  end if;

  if p_completed and not exists (
    select 1
    from public.profiles
    where id = owner_id
      and char_length(btrim(display_name)) between 1 and 60
      and char_length(btrim(city)) between 1 and 80
  ) then
    raise exception 'Complete your name and city before finishing onboarding';
  end if;

  insert into public.user_onboarding (
    user_id,
    selected_roles,
    completed_roles,
    active_role,
    athlete_onboarding_version,
    athlete_onboarding_step,
    athlete_onboarding_completed_at
  )
  values (
    owner_id,
    array['athlete']::text[],
    case when p_completed then array['athlete']::text[] else '{}'::text[] end,
    'athlete',
    2,
    case when p_completed then 'complete' else p_step end,
    case when p_completed then now() else null end
  )
  on conflict (user_id)
  do update set
    selected_roles = case
      when 'athlete' = any (public.user_onboarding.selected_roles)
        then public.user_onboarding.selected_roles
      else pg_catalog.array_append(public.user_onboarding.selected_roles, 'athlete')
    end,
    completed_roles = case
      when p_completed and not ('athlete' = any (public.user_onboarding.completed_roles))
        then pg_catalog.array_append(public.user_onboarding.completed_roles, 'athlete')
      else public.user_onboarding.completed_roles
    end,
    active_role = 'athlete',
    athlete_onboarding_version = 2,
    athlete_onboarding_step = case when p_completed then 'complete' else p_step end,
    athlete_onboarding_completed_at = case
      when p_completed then coalesce(public.user_onboarding.athlete_onboarding_completed_at, now())
      else public.user_onboarding.athlete_onboarding_completed_at
    end,
    updated_at = now();
end;
$$;

revoke all on function public.save_my_athlete_onboarding_state(text, boolean)
  from public, anon;
grant execute on function public.save_my_athlete_onboarding_state(text, boolean)
  to authenticated;