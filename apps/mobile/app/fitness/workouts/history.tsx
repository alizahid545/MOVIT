import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import type { Workout } from "@moveit/shared";
import { Button, Header, Icon, Page } from "../../../src/components/ui";
import { loadFitnessData } from "../../../src/fitness-api";
import { useMoveitTheme } from "../../../src/theme";

export default function WorkoutHistoryScreen() {
  const { colors } = useMoveitTheme();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await loadFitnessData();
      setWorkouts(data.workouts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Workout history could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  return (
    <Page>
      <Header
        eyebrow="FITNESS · PRIVATE HISTORY"
        title="Your workouts."
        action={
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Back</Text>
          </Pressable>
        }
      />
      {loading ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Loading workout history" style={{ alignItems: "center", padding: 28 }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13, lineHeight: 19 }}>{error}</Text>
          <Button label="Try again" variant="secondary" onPress={() => void refresh()} />
          {error.includes("Sign in") ? <Button label="Sign in" onPress={() => router.push("/auth")} /> : null}
        </View>
      ) : workouts.length ? (
        <>
          {workouts.map((workout) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${workout.workout_type}, ${workout.duration_minutes} minutes`}
              key={workout.id}
              onPress={() => router.push({ pathname: "/fitness/workouts/[id]", params: { id: workout.id } })}
              style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "500" }}>{workout.workout_type}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{new Date(workout.performed_at).toLocaleDateString()} · {workout.exercises.length} exercises</Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 13 }}>{workout.duration_minutes} min</Text>
              <Icon name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          ))}
          {workouts.length >= 100 ? <Text style={{ color: colors.muted, fontSize: 11, paddingTop: 10 }}>Showing the 100 most recent workouts.</Text> : null}
        </>
      ) : (
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>No workouts yet.</Text>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>Your saved workouts will appear here.</Text>
          <Button label="Log your first workout" onPress={() => router.push("/fitness/workouts/new")} />
        </View>
      )}
    </Page>
  );
}
