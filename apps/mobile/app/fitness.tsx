import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import {
  bodyWeightSchema,
  dailyMetricSchema,
  fitnessGoalSchema,
  getDailyFitnessTotals,
  getLocalDateKey,
  getWeeklyWorkoutMinutes,
  type FitnessMetric,
  type Workout,
} from "@moveit/shared";
import { Button, Card, Header, Icon, IconButton, Page, SectionTitle } from "../src/components/ui";
import {
  FitnessSessionError,
  loadBodyWeightEntries,
  loadFitnessData,
  saveBodyWeight,
  saveDailyMetric,
  saveFitnessGoal,
} from "../src/fitness-api";
import { useMoveitTheme } from "../src/theme";

const metrics: Array<{
  key: FitnessMetric;
  label: string;
  unit: string;
  icon: "activity" | "clock" | "navigation" | "trending-up";
}> = [
  { key: "steps", label: "Steps", unit: "steps", icon: "trending-up" },
  { key: "distance_meters", label: "Distance", unit: "km", icon: "navigation" },
  { key: "active_minutes", label: "Active minutes", unit: "min", icon: "clock" },
  { key: "workout_minutes", label: "Workout time", unit: "min", icon: "activity" },
];
const manualMetrics = [
  { key: "steps", label: "Steps", unit: "steps" },
  { key: "distance_meters", label: "Distance (km)", unit: "km" },
  { key: "active_minutes", label: "Active minutes", unit: "min" },
] as const;

type FitnessData = Awaited<ReturnType<typeof loadFitnessData>>;
type WeightEntry = Awaited<ReturnType<typeof loadBodyWeightEntries>>[number];

export default function FitnessScreen() {
  const { colors } = useMoveitTheme();
  const [data, setData] = useState<FitnessData | null>(null);
  const [weights, setWeights] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [goalError, setGoalError] = useState("");
  const [metricError, setMetricError] = useState("");
  const [goalDrafts, setGoalDrafts] = useState<Record<FitnessMetric, string>>({
    steps: "",
    distance_meters: "",
    active_minutes: "",
    workout_minutes: "",
  });
  const [metricDrafts, setMetricDrafts] = useState({ steps: "", distance_meters: "", active_minutes: "" });
  const [savingMetric, setSavingMetric] = useState<FitnessMetric | null>(null);
  const [savingGoal, setSavingGoal] = useState<FitnessMetric | null>(null);
  const [showWeightForm, setShowWeightForm] = useState(false);
  const [weightDraft, setWeightDraft] = useState("");
  const [weightNotes, setWeightNotes] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [weightError, setWeightError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [fitness, privateWeights] = await Promise.all([loadFitnessData(), loadBodyWeightEntries()]);
      setData(fitness);
      setWeights(privateWeights);
      setGoalDrafts((current) => ({
        ...current,
        ...Object.fromEntries(fitness.goals.map((goal) => [goal.metric, String(goal.target)])),
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your fitness data could not be loaded.");
      if (caught instanceof FitnessSessionError) {
        setData(null);
        setWeights([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const today = getLocalDateKey(new Date());
  const daily = useMemo(
    () => data ? getDailyFitnessTotals(today, data.summaryWorkouts, data.metrics) : null,
    [data, today],
  );
  const weeklyMinutes = useMemo(
    () => data ? getWeeklyWorkoutMinutes(data.summaryWorkouts) : [],
    [data],
  );

  const refreshByPull = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const saveGoal = async (metric: FitnessMetric) => {
    const target = Number(goalDrafts[metric]);
    const parsed = fitnessGoalSchema.safeParse({ metric, target });
    if (!parsed.success) {
      setGoalError(parsed.error.issues[0]?.message ?? "Enter a valid goal.");
      return;
    }
    setSavingGoal(metric);
    setGoalError("");
    try {
      await saveFitnessGoal(metric, parsed.data.target);
      await refresh();
    } catch (caught) {
      setGoalError(caught instanceof Error ? caught.message : "Your goal could not be saved.");
    } finally {
      setSavingGoal(null);
    }
  };

  const saveMetric = async (metric: "steps" | "distance_meters" | "active_minutes") => {
    if (!metricDrafts[metric].trim()) {
      setMetricError("Enter a reading before saving.");
      return;
    }
    const inputValue = Number(metricDrafts[metric]);
    const value = metric === "distance_meters" ? inputValue * 1000 : inputValue;
    const parsed = dailyMetricSchema.safeParse({ metric, value });
    if (!parsed.success) {
      setMetricError(parsed.error.issues[0]?.message ?? "Enter a valid measurement.");
      return;
    }
    setSavingMetric(metric);
    setMetricError("");
    try {
      await saveDailyMetric(metric, parsed.data.value);
      setMetricDrafts((current) => ({ ...current, [metric]: "" }));
      await refresh();
    } catch (caught) {
      setMetricError(caught instanceof Error ? caught.message : "Your measurement could not be saved.");
    } finally {
      setSavingMetric(null);
    }
  };

  const addWeight = async () => {
    const parsed = bodyWeightSchema.safeParse({ weight_kg: Number(weightDraft), notes: weightNotes });
    if (!parsed.success) {
      setWeightError("Enter a weight between 1 and 1,000 kg. Notes must be 500 characters or fewer.");
      return;
    }
    setSavingWeight(true);
    setWeightError("");
    try {
      await saveBodyWeight(parsed.data.weight_kg, parsed.data.notes);
      setWeightDraft("");
      setWeightNotes("");
      setShowWeightForm(false);
      await refresh();
    } catch (caught) {
      setWeightError(caught instanceof Error ? caught.message : "Your private entry could not be saved.");
    } finally {
      setSavingWeight(false);
    }
  };

  return (
    <Page
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refreshByPull()}
          tintColor={colors.primary}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surface}
        />
      }
    >
      <Header
        eyebrow="FITNESS · PRIVATE TO YOU"
        title="Your movement."
        action={
          <IconButton
            name="plus"
            label="Add a workout"
            onPress={() => router.push("/fitness/workouts/new")}
          />
        }
      />

      {loading ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Loading fitness data" style={{ alignItems: "center", padding: 28, gap: 10 }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>Loading your fitness data…</Text>
        </View>
      ) : error ? (
        <Card>
          <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13, lineHeight: 19 }}>{error}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}><Button label="Try again" variant="secondary" onPress={() => void refresh()} /></View>
            {error.includes("Sign in") ? <View style={{ flex: 1 }}><Button label="Sign in" onPress={() => router.push("/auth")} /></View> : null}
          </View>
        </Card>
      ) : data && daily ? (
        <>
          <View style={{ gap: 10 }}>
            <SectionTitle title="Today" action="Refresh" onAction={() => void refreshByPull()} />
            <Text style={{ color: colors.muted, fontSize: 11 }}>Manual entries and logged workouts only · {today}</Text>
            {metrics.map((metric) => {
              const goal = data.goals.find((item) => item.metric === metric.key);
              const amount = daily[metric.key];
              const hasReading = metric.key === "workout_minutes" || data.metrics.some(
                (item) => item.metric === metric.key && item.metric_date === today,
              );
              const displayAmount = hasReading
                ? metric.key === "distance_meters" ? (amount / 1000).toFixed(2) : String(amount)
                : "—";
              const progress = goal ? Math.min(amount / goal.target, 1) : 0;
              const isManual = metric.key !== "workout_minutes" && data.metrics.some(
                (item) => item.metric === metric.key && item.metric_date === today && item.source === "manual",
              );
              return (
                <View key={metric.key} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                      <Icon name={metric.icon} size={16} color={colors.muted} />
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>{metric.label}</Text>
                    </View>
                    <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                      {displayAmount} <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "400" }}>{metric.unit}</Text>
                    </Text>
                  </View>
                  {goal ? (
                    <>
                      <View accessibilityRole="progressbar" accessibilityLabel={`${metric.label} goal progress`} accessibilityValue={{ min: 0, max: goal.target, now: Math.min(amount, goal.target) }} style={{ height: 4, backgroundColor: colors.surfaceAlt, borderRadius: 4 }}>
                        <View style={{ width: `${progress * 100}%`, height: 4, backgroundColor: colors.primary, borderRadius: 4 }} />
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 10 }}>{displayAmount} of {goal.target}{metric.key === "distance_meters" ? " m" : ` ${metric.unit}`} goal</Text>
                    </>
                  ) : (
                    <Text style={{ color: colors.muted, fontSize: 11 }}>No goal set</Text>
                  )}
                  {metric.key !== "workout_minutes" ? (
                    <Text style={{ color: colors.muted, fontSize: 10 }}>
                      {isManual ? "Manual entry" : "No reading · device sync unavailable"}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={{ gap: 12 }}>
            <SectionTitle title="Your goals" />
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Set personal daily targets. Goals are private and can be changed any time.</Text>
            {goalError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{goalError}</Text> : null}
            {metrics.map((metric) => (
              <View key={metric.key} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Icon name={metric.icon} size={15} color={colors.muted} />
                  <Text style={{ color: colors.text, flexShrink: 1, fontSize: 12 }}>{metric.label}</Text>
                </View>
                <TextInput
                  accessibilityLabel={`${metric.label} daily goal`}
                  value={goalDrafts[metric.key]}
                  onChangeText={(value) => setGoalDrafts((current) => ({ ...current, [metric.key]: value }))}
                  keyboardType="decimal-pad"
                  placeholder={metric.key === "distance_meters" ? "metres" : metric.unit}
                  placeholderTextColor={colors.muted}
                  style={{ width: 88, minHeight: 42, color: colors.text, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, fontSize: 13 }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Save ${metric.label} goal`}
                  disabled={savingGoal !== null}
                  onPress={() => void saveGoal(metric.key)}
                  style={{ minWidth: 62, minHeight: 42, alignItems: "center", justifyContent: "center", opacity: savingGoal && savingGoal !== metric.key ? 0.5 : 1 }}
                >
                  <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600" }}>{savingGoal === metric.key ? "Saving…" : "Save"}</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <View style={{ gap: 12 }}>
            <SectionTitle title="Add today’s readings" />
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
              Enter readings yourself. Saving again replaces that metric’s manual value for today.
            </Text>
            {metricError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{metricError}</Text> : null}
            {manualMetrics.map((metric) => {
              const key = metric.key;
              return (
                <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <TextInput
                    accessibilityLabel={metric.label}
                    value={metricDrafts[key]}
                    onChangeText={(value) => setMetricDrafts((current) => ({ ...current, [key]: value }))}
                    keyboardType="decimal-pad"
                    placeholder={metric.key === "distance_meters" ? "Distance in km" : `Enter ${metric.label.toLowerCase()}`}
                    placeholderTextColor={colors.muted}
                    style={{ flex: 1, minHeight: 46, color: colors.text, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, fontSize: 13 }}
                  />
                  <Button
                    label={savingMetric === key ? "Saving…" : "Save"}
                    variant="secondary"
                    disabled={savingMetric !== null}
                    onPress={() => void saveMetric(key)}
                  />
                </View>
              );
            })}
            <Text style={{ color: colors.muted, fontSize: 10 }}>Steps and distance are not read from your device. No health permissions have been requested.</Text>
          </View>

          <View style={{ gap: 12 }}>
            <SectionTitle title="This week" />
            <Text style={{ color: colors.muted, fontSize: 12 }}>Workout minutes · last seven local calendar days</Text>
            <WeeklyBars values={weeklyMinutes} />
            {data.summaryWorkouts.length >= 500 ? (
              <Text style={{ color: colors.muted, fontSize: 10 }}>Summary uses up to 500 workouts from this week.</Text>
            ) : null}
          </View>

          <View style={{ gap: 12 }}>
            <SectionTitle
              title="Workout history"
              action="See all"
              onAction={() => router.push("/fitness/workouts/history")}
            />
            {data.workouts.length ? data.workouts.slice(0, 5).map((workout) => (
              <WorkoutRow key={workout.id} workout={workout} />
            )) : (
              <View style={{ gap: 10, paddingVertical: 8 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>Your first workout starts here.</Text>
                <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Log an activity to build a history and see your weekly training time.</Text>
                <Button label="Log a workout" onPress={() => router.push("/fitness/workouts/new")} />
              </View>
            )}
            {data.workouts.length >= 100 ? <Text style={{ color: colors.muted, fontSize: 10 }}>Showing your 100 most recent workouts.</Text> : null}
          </View>

          <View style={{ gap: 12 }}>
            <SectionTitle title="Body weight · private" />
            <Text style={{ color: colors.muted, fontSize: 11 }}>Only you can view these measurements.</Text>
            <Button
              label={showWeightForm ? "Cancel entry" : "Add a measurement"}
              variant="secondary"
              onPress={() => { setShowWeightForm((value) => !value); setWeightError(""); }}
            />
            {showWeightForm ? (
              <View style={{ gap: 10 }}>
                <TextInput
                  accessibilityLabel="Weight in kilograms"
                  value={weightDraft}
                  onChangeText={setWeightDraft}
                  keyboardType="decimal-pad"
                  placeholder="Weight in kg"
                  placeholderTextColor={colors.muted}
                  style={{ minHeight: 46, color: colors.text, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12 }}
                />
                <TextInput
                  accessibilityLabel="Private measurement note"
                  value={weightNotes}
                  onChangeText={setWeightNotes}
                  placeholder="Note (optional)"
                  placeholderTextColor={colors.muted}
                  style={{ minHeight: 46, color: colors.text, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12 }}
                />
                {weightError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{weightError}</Text> : null}
                <Button label={savingWeight ? "Saving…" : "Save private measurement"} disabled={savingWeight} onPress={() => void addWeight()} />
              </View>
            ) : null}
            {weights.length ? weights.slice(0, 5).map((entry) => (
              <Text key={entry.id} style={{ color: colors.text, fontSize: 12 }}>
                {Number(entry.weight_kg).toFixed(1)} kg · {new Date(entry.measured_at).toLocaleDateString()}
              </Text>
            )) : <Text style={{ color: colors.muted, fontSize: 12 }}>No private measurements recorded.</Text>}
          </View>
        </>
      ) : null}
    </Page>
  );
}

function WorkoutRow({ workout }: { workout: Workout }) {
  const { colors } = useMoveitTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${workout.workout_type}, ${workout.duration_minutes} minutes, ${new Date(workout.performed_at).toLocaleDateString()}`}
      onPress={() => router.push({ pathname: "/fitness/workouts/[id]", params: { id: workout.id } })}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>{workout.workout_type}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{new Date(workout.performed_at).toLocaleDateString()} · {workout.exercises.length} exercises</Text>
      </View>
      <Text style={{ color: colors.text, fontSize: 13 }}>{workout.duration_minutes} min</Text>
      <Icon name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

function WeeklyBars({ values }: { values: number[] }) {
  const { colors } = useMoveitTheme();
  const max = Math.max(...values, 1);
  const today = new Date();
  return (
    <View accessibilityLabel={`Weekly workout minutes: ${values.join(", ")}`} style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 112, paddingTop: 8 }}>
      {values.map((value, index) => {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index, 12);
        const day = date.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2);
        return (
          <View key={index} style={{ flex: 1, height: "100%", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 9 }}>{value || ""}</Text>
            <View style={{ width: "100%", height: Math.max(4, (value / max) * 64), backgroundColor: value ? colors.accent : colors.surfaceAlt, borderRadius: 3 }} />
            <Text style={{ color: colors.muted, fontSize: 9 }}>{day}</Text>
          </View>
        );
      })}
    </View>
  );
}
