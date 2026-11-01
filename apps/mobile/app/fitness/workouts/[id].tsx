import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import type { Workout } from "@moveit/shared";
import { Button, Card, Header, Page, SectionTitle } from "../../../src/components/ui";
import { WorkoutForm } from "../../../src/components/workout-form";
import { deleteWorkout, loadWorkout } from "../../../src/fitness-api";
import { useMoveitTheme } from "../../../src/theme";

export default function WorkoutDetailScreen() {
  const { colors } = useMoveitTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const workoutId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);

  const refresh = useCallback(async () => {
    if (!workoutId) {
      setError("This workout is unavailable.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setWorkout(await loadWorkout(workoutId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This workout could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [workoutId]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const remove = async () => {
    if (!workout || deleting) return;
    setDeleting(true);
    setError("");
    try {
      await deleteWorkout(workout.id);
      router.replace("/fitness");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This workout could not be deleted.");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (editing && workout) {
    return (
      <WorkoutForm
        initialWorkout={workout}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void refresh();
        }}
      />
    );
  }

  return (
    <Page>
      <Header
        eyebrow="FITNESS · WORKOUT DETAIL"
        title={workout?.workout_type ?? "Workout."}
        action={
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>Back</Text>
          </Pressable>
        }
      />
      {loading ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Loading workout" style={{ alignItems: "center", padding: 28 }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error && !workout ? (
        <Card>
          <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>
          <Button label="Try again" variant="secondary" onPress={() => void refresh()} />
        </Card>
      ) : workout ? (
        <>
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{new Date(workout.performed_at).toLocaleDateString()} · {workout.duration_minutes} minutes</Text>
            {workout.notes ? <Text selectable style={{ color: colors.text, fontSize: 14, lineHeight: 21 }}>{workout.notes}</Text> : null}
          </View>
          <View style={{ gap: 10 }}>
            <SectionTitle title="Exercises" />
            {workout.exercises.length ? workout.exercises.map((exercise) => (
              <View key={exercise.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{exercise.name}</Text>
                {exercise.sets.map((set) => (
                  <Text key={set.id} style={{ color: colors.muted, fontSize: 12 }}>
                    Set {set.set_number} · {set.repetitions} reps{set.weight_kg === null ? "" : ` · ${set.weight_kg} kg`}
                  </Text>
                ))}
              </View>
            )) : <Text style={{ color: colors.muted, fontSize: 12 }}>No exercises were added to this workout.</Text>}
          </View>
          {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
          {confirmDelete ? (
            <Card>
              <Text style={{ color: colors.text, fontSize: 13 }}>Delete this workout and its exercise details?</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><Button label="Keep workout" variant="secondary" onPress={() => setConfirmDelete(false)} /></View>
                <View style={{ flex: 1 }}><Button label={deleting ? "Deleting…" : "Delete"} disabled={deleting} onPress={() => void remove()} /></View>
              </View>
            </Card>
          ) : (
            <View style={{ gap: 8 }}>
              <Button label="Edit workout" variant="secondary" onPress={() => setEditing(true)} />
              <Button label="Delete workout" variant="quiet" onPress={() => setConfirmDelete(true)} />
            </View>
          )}
        </>
      ) : null}
    </Page>
  );
}
