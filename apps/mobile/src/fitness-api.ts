import {
  getLocalDateKey,
  type FitnessDailyMetric,
  type FitnessGoal,
  type WorkoutExercise,
  type Workout,
  type WorkoutSet,
} from "@moveit/shared";
import { SUPABASE_SETUP_ERROR } from "@moveit/supabase";
import { supabase } from "./supabase";

const HISTORY_LIMIT = 100;
const SUMMARY_WORKOUT_LIMIT = 500;

export class FitnessSessionError extends Error {}

type WorkoutRow = Omit<Workout, "exercises"> & {
  workout_exercises: Array<Omit<WorkoutExercise, "sets"> & { workout_sets: WorkoutSet[] }> | null;
};

function normalizeWorkout(workout: WorkoutRow): Workout {
  const { workout_exercises: exerciseRows, ...record } = workout;
  return {
    ...record,
    exercises: [...(exerciseRows ?? [])]
      .sort((left, right) => left.sort_order - right.sort_order)
      .map((exercise) => ({
        ...exercise,
        sets: [...(exercise.workout_sets ?? [])].sort((left, right) => left.set_number - right.set_number),
      })),
  };
}

function client() {
  if (!supabase) throw new Error(SUPABASE_SETUP_ERROR);
  return supabase;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await client().auth.getUser();
  if (error) throw error;
  if (!data.user) throw new FitnessSessionError("Sign in to use your private fitness tracker.");
  return data.user.id;
}

function localDateOffset(base: Date, days: number): string {
  return getLocalDateKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, 12));
}

export async function loadFitnessData(): Promise<{
  workouts: Workout[];
  summaryWorkouts: Array<Pick<Workout, "performed_at" | "duration_minutes">>;
  goals: FitnessGoal[];
  metrics: FitnessDailyMetric[];
}> {
  const userId = await currentUserId();
  const today = new Date();
  const startDate = localDateOffset(today, -6);
  const endDate = getLocalDateKey(today);
  const startTimestamp = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).toISOString();
  const endTimestamp = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();
  const [workoutResult, summaryWorkoutResult, goalsResult, metricsResult] = await Promise.all([
    client()
      .from("workouts")
      .select("*, workout_exercises(*, workout_sets(*))")
      .eq("user_id", userId)
      .order("performed_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(HISTORY_LIMIT),
    client()
      .from("workouts")
      .select("performed_at, duration_minutes")
      .eq("user_id", userId)
      .gte("performed_at", startTimestamp)
      .lt("performed_at", endTimestamp)
      .order("performed_at", { ascending: false })
      .limit(SUMMARY_WORKOUT_LIMIT),
    client().from("fitness_goals").select("*").eq("user_id", userId),
    client()
      .from("fitness_daily_metrics")
      .select("user_id, metric_date, metric, value, source")
      .eq("user_id", userId)
      .gte("metric_date", startDate)
      .lte("metric_date", endDate),
  ]);
  if (workoutResult.error) throw workoutResult.error;
  if (summaryWorkoutResult.error) throw summaryWorkoutResult.error;
  if (goalsResult.error) throw goalsResult.error;
  if (metricsResult.error) throw metricsResult.error;

  const workouts = ((workoutResult.data ?? []) as WorkoutRow[]).map(normalizeWorkout);

  return {
    workouts,
    summaryWorkouts: (summaryWorkoutResult.data ?? []) as Array<Pick<Workout, "performed_at" | "duration_minutes">>,
    goals: (goalsResult.data ?? []) as FitnessGoal[],
    metrics: (metricsResult.data ?? []) as FitnessDailyMetric[],
  };
}

export async function loadWorkout(workoutId: string): Promise<Workout> {
  const userId = await currentUserId();
  const { data, error } = await client()
    .from("workouts")
    .select("*, workout_exercises(*, workout_sets(*))")
    .eq("user_id", userId)
    .eq("id", workoutId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This workout is unavailable.");
  return normalizeWorkout(data as WorkoutRow);
}

export async function saveWorkout(input: {
  id: string | null;
  workout_type: string;
  performed_at: string;
  duration_minutes: number;
  notes: string;
  exercises: Array<{
    name: string;
    sets: Array<{ repetitions: number; weight_kg: number | null }>;
  }>;
}): Promise<string> {
  await currentUserId();
  const { data, error } = await client().rpc("save_workout", {
    p_workout_id: input.id,
    p_workout_type: input.workout_type,
    p_performed_at: input.performed_at,
    p_duration_minutes: input.duration_minutes,
    p_notes: input.notes,
    p_exercises: input.exercises,
  });
  if (error) throw error;
  if (typeof data !== "string") throw new Error("The workout was not saved. Please try again.");
  return data;
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  const userId = await currentUserId();
  const { error, count } = await client()
    .from("workouts")
    .delete({ count: "exact" })
    .eq("user_id", userId)
    .eq("id", workoutId);
  if (error) throw error;
  if (count === 0) throw new Error("This workout is unavailable or has already been removed.");
}

export async function saveFitnessGoal(metric: FitnessGoal["metric"], target: number): Promise<void> {
  const userId = await currentUserId();
  const { error } = await client()
    .from("fitness_goals")
    .upsert({ user_id: userId, metric, target }, { onConflict: "user_id,metric" });
  if (error) throw error;
}

export async function saveDailyMetric(
  metric: FitnessDailyMetric["metric"],
  value: number,
  metricDate = getLocalDateKey(new Date()),
): Promise<void> {
  const userId = await currentUserId();
  const { error } = await client()
    .from("fitness_daily_metrics")
    .upsert(
      { user_id: userId, metric_date: metricDate, metric, value, source: "manual" },
      { onConflict: "user_id,metric_date,metric" },
    );
  if (error) throw error;
}

export async function loadBodyWeightEntries(): Promise<Array<{
  id: string;
  measured_at: string;
  weight_kg: number;
  notes: string;
}>> {
  const userId = await currentUserId();
  const { data, error } = await client()
    .from("body_weight_entries")
    .select("id, measured_at, weight_kg, notes")
    .eq("user_id", userId)
    .order("measured_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function saveBodyWeight(weightKg: number, notes: string): Promise<void> {
  const userId = await currentUserId();
  const { error } = await client()
    .from("body_weight_entries")
    .insert({ user_id: userId, measured_at: new Date().toISOString(), weight_kg: weightKg, notes });
  if (error) throw error;
}
