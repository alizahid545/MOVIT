create or replace function public.save_my_athlete_preferences(
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
      visibility = p_visibility::public.profile_visibility
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