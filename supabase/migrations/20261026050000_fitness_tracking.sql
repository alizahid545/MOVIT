create type public.fitness_metric as enum (
  'steps',
  'distance_meters',
  'active_minutes',
  'workout_minutes'
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_type text not null,
  performed_at timestamptz not null,
  duration_minutes integer not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workouts_type_length check (char_length(btrim(workout_type)) between 1 and 60),
  constraint workouts_duration check (duration_minutes between 1 and 1440),
  constraint workouts_notes_length check (char_length(notes) <= 2000)
);

create index workouts_owner_history_idx on public.workouts (user_id, performed_at desc, id desc);
create trigger workouts_set_updated_at
before update on public.workouts
for each row execute function public.set_updated_at();

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  constraint workout_exercises_name_length check (char_length(btrim(name)) between 1 and 80),
  constraint workout_exercises_sort_order check (sort_order >= 0)
);

create index workout_exercises_order_idx on public.workout_exercises (workout_id, sort_order, id);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  set_number integer not null,
  repetitions integer not null,
  weight_kg numeric(7, 2),
  constraint workout_sets_set_number check (set_number between 1 and 100),
  constraint workout_sets_repetitions check (repetitions between 1 and 1000),
  constraint workout_sets_weight check (weight_kg is null or weight_kg between 0 and 10000),
  constraint workout_sets_unique_number unique (exercise_id, set_number)
);

create index workout_sets_exercise_idx on public.workout_sets (exercise_id, set_number);

create table public.fitness_goals (
  user_id uuid not null references auth.users (id) on delete cascade,
  metric public.fitness_metric not null,
  target numeric(12, 2) not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, metric),
  constraint fitness_goals_target_positive check (target > 0),
  constraint fitness_goals_target_bound check (target <= 100000000),
  constraint fitness_goals_whole_number_metrics check (
    metric not in ('steps', 'active_minutes', 'workout_minutes') or target = trunc(target)
  )
);

create trigger fitness_goals_set_updated_at
before update on public.fitness_goals
for each row execute function public.set_updated_at();

create table public.fitness_daily_metrics (
  user_id uuid not null references auth.users (id) on delete cascade,
  metric_date date not null,
  metric public.fitness_metric not null,
  value numeric(12, 2) not null,
  source text not null default 'manual',
  updated_at timestamptz not null default now(),
  primary key (user_id, metric_date, metric),
  constraint fitness_daily_metrics_value check (value >= 0 and value <= 100000000),
  constraint fitness_daily_metrics_no_workout_time check (metric <> 'workout_minutes'),
  constraint fitness_daily_metrics_whole_number_metrics check (
    metric not in ('steps', 'active_minutes') or value = trunc(value)
  ),
  constraint fitness_daily_metrics_manual_only check (source = 'manual')
);

create trigger fitness_daily_metrics_set_updated_at
before update on public.fitness_daily_metrics
for each row execute function public.set_updated_at();

create table public.body_weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_at timestamptz not null,
  weight_kg numeric(6, 2) not null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  constraint body_weight_entries_range check (weight_kg between 1 and 1000),
  constraint body_weight_entries_notes_length check (char_length(notes) <= 500)
);

create index body_weight_entries_owner_history_idx on public.body_weight_entries (user_id, measured_at desc);

alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.fitness_goals enable row level security;
alter table public.fitness_daily_metrics enable row level security;
alter table public.body_weight_entries enable row level security;

create policy "Users manage their own workouts"
on public.workouts for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users manage exercises in their own workouts"
on public.workout_exercises for all to authenticated
using (
  exists (
    select 1 from public.workouts
    where workouts.id = workout_exercises.workout_id
      and workouts.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.workouts
    where workouts.id = workout_exercises.workout_id
      and workouts.user_id = (select auth.uid())
  )
);

create policy "Users manage sets in their own workouts"
on public.workout_sets for all to authenticated
using (
  exists (
    select 1
    from public.workout_exercises
    join public.workouts on workouts.id = workout_exercises.workout_id
    where workout_exercises.id = workout_sets.exercise_id
      and workouts.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.workout_exercises
    join public.workouts on workouts.id = workout_exercises.workout_id
    where workout_exercises.id = workout_sets.exercise_id
      and workouts.user_id = (select auth.uid())
  )
);

create policy "Users manage their own fitness goals"
on public.fitness_goals for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users manage their own daily fitness metrics"
on public.fitness_daily_metrics for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users manage their own private body weight entries"
on public.body_weight_entries for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function public.save_workout(
  p_workout_id uuid,
  p_workout_type text,
  p_performed_at timestamptz,
  p_duration_minutes integer,
  p_notes text,
  p_exercises jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  saved_id uuid;
  exercise_item jsonb;
  set_item jsonb;
  saved_exercise_id uuid;
  exercise_order integer := 0;
  set_order integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_workout_type is null or char_length(btrim(p_workout_type)) not between 1 and 60 then
    raise exception 'Workout type must be between 1 and 60 characters';
  end if;
  if p_performed_at is null or p_duration_minutes not between 1 and 1440 then
    raise exception 'Workout date and duration are required';
  end if;
  if char_length(coalesce(p_notes, '')) > 2000 or jsonb_typeof(p_exercises) is distinct from 'array' then
    raise exception 'Invalid workout details';
  end if;

  if p_workout_id is null then
    insert into public.workouts (user_id, workout_type, performed_at, duration_minutes, notes)
    values (auth.uid(), btrim(p_workout_type), p_performed_at, p_duration_minutes, coalesce(p_notes, ''))
    returning id into saved_id;
  else
    update public.workouts
    set workout_type = btrim(p_workout_type),
        performed_at = p_performed_at,
        duration_minutes = p_duration_minutes,
        notes = coalesce(p_notes, '')
    where id = p_workout_id and user_id = auth.uid()
    returning id into saved_id;

    if saved_id is null then
      raise exception 'Workout not found or access denied';
    end if;
    delete from public.workout_exercises where workout_id = saved_id;
  end if;

  for exercise_item in select value from jsonb_array_elements(p_exercises)
  loop
    insert into public.workout_exercises (workout_id, name, sort_order)
    values (saved_id, exercise_item ->> 'name', exercise_order)
    returning id into saved_exercise_id;

    set_order := 0;
    for set_item in select value from jsonb_array_elements(coalesce(exercise_item -> 'sets', '[]'::jsonb))
    loop
      insert into public.workout_sets (exercise_id, set_number, repetitions, weight_kg)
      values (
        saved_exercise_id,
        coalesce((set_item ->> 'set_number')::integer, set_order + 1),
        (set_item ->> 'repetitions')::integer,
        nullif(set_item ->> 'weight_kg', '')::numeric
      );
      set_order := set_order + 1;
    end loop;
    exercise_order := exercise_order + 1;
  end loop;

  return saved_id;
end;
$$;

revoke all on table public.workouts, public.workout_exercises, public.workout_sets,
  public.fitness_goals, public.fitness_daily_metrics, public.body_weight_entries
  from public, anon, authenticated;

grant select, insert, update, delete on table public.workouts to authenticated;
grant select, insert, update, delete on table public.workout_exercises to authenticated;
grant select, insert, update, delete on table public.workout_sets to authenticated;
grant select, insert, update, delete on table public.fitness_goals to authenticated;
grant select, insert, update, delete on table public.fitness_daily_metrics to authenticated;
grant select, insert, update, delete on table public.body_weight_entries to authenticated;

revoke all on function public.save_workout(uuid, text, timestamptz, integer, text, jsonb) from public, anon;
grant execute on function public.save_workout(uuid, text, timestamptz, integer, text, jsonb) to authenticated;
