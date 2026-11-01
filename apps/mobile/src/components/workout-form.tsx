import { useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { workoutSchema, type Workout } from "@moveit/shared";
import { Button, Card, Header, Icon, Page, SectionTitle } from "./ui";
import { saveWorkout } from "../fitness-api";
import { useMoveitTheme } from "../theme";

type ExerciseDraft = {
  name: string;
  sets: Array<{ repetitions: string; weight_kg: string }>;
};

function todayDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function toDraft(workout: Workout): ExerciseDraft[] {
  return workout.exercises.map((exercise) => ({
    name: exercise.name,
    sets: exercise.sets.map((set) => ({
      repetitions: String(set.repetitions),
      weight_kg: set.weight_kg === null ? "" : String(set.weight_kg),
    })),
  }));
}

function dateToIso(date: string) {
  return new Date(`${date}T12:00:00`).toISOString();
}

export function WorkoutForm({
  initialWorkout,
  onCancel,
  onSaved,
}: {
  initialWorkout?: Workout;
  onCancel?: () => void;
  onSaved?: (workoutId: string) => void;
}) {
  const { colors } = useMoveitTheme();
  const [workoutType, setWorkoutType] = useState(initialWorkout?.workout_type ?? "");
  const [performedOn, setPerformedOn] = useState(
    initialWorkout ? todayDateFor(initialWorkout.performed_at) : todayDate(),
  );
  const [duration, setDuration] = useState(String(initialWorkout?.duration_minutes ?? ""));
  const [notes, setNotes] = useState(initialWorkout?.notes ?? "");
  const [exercises, setExercises] = useState<ExerciseDraft[]>(initialWorkout ? toDraft(initialWorkout) : []);
  const [validationMessage, setValidationMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);

  function updateExercise(index: number, update: (current: ExerciseDraft) => ExerciseDraft) {
    setExercises((current) => current.map((exercise, itemIndex) => itemIndex === index ? update(exercise) : exercise));
  }

  function addExercise() {
    setExercises((current) => [...current, { name: "", sets: [{ repetitions: "", weight_kg: "" }] }]);
  }

  function addSet(index: number) {
    updateExercise(index, (exercise) => ({
      ...exercise,
      sets: [...exercise.sets, { repetitions: "", weight_kg: "" }],
    }));
  }

  function updateSet(index: number, setIndex: number, key: "repetitions" | "weight_kg", value: string) {
    updateExercise(index, (exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set, itemIndex) => itemIndex === setIndex ? { ...set, [key]: value } : set),
    }));
  }

  const submit = async () => {
    if (saveLock.current) return;
    let performedAt: string;
    try {
      performedAt = dateToIso(performedOn);
    } catch {
      setValidationMessage("Enter a valid workout date.");
      return;
    }
    const input = {
      workout_type: workoutType,
      performed_on: performedOn,
      duration_minutes: Number(duration),
      notes,
      exercises: exercises.map((exercise) => ({
        name: exercise.name,
        sets: exercise.sets.map((set) => ({
          repetitions: Number(set.repetitions),
          weight_kg: set.weight_kg.trim() ? Number(set.weight_kg) : null,
        })),
      })),
    };
    const parsed = workoutSchema.safeParse(input);
    if (!parsed.success) {
      setValidationMessage(parsed.error.issues[0]?.message ?? "Check the workout details and try again.");
      return;
    }

    saveLock.current = true;
    setSaving(true);
    setValidationMessage("");
    setSaveError("");
    try {
      const workoutId = await saveWorkout({
        id: initialWorkout?.id ?? null,
        workout_type: parsed.data.workout_type,
        performed_at: performedAt,
        duration_minutes: parsed.data.duration_minutes,
        notes: parsed.data.notes,
        exercises: parsed.data.exercises.map((exercise) => ({
          name: exercise.name,
          sets: exercise.sets.map((set) => ({
            repetitions: set.repetitions,
            weight_kg: set.weight_kg,
          })),
        })),
      });
      onSaved?.(workoutId);
      if (!onSaved) router.replace({ pathname: "/fitness/workouts/[id]", params: { id: workoutId } });
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Your workout could not be saved. Your entries are still here.");
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.canvas }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Page>
        <Header
          eyebrow={initialWorkout ? "FITNESS · EDIT WORKOUT" : "FITNESS · MANUAL ENTRY"}
          title={initialWorkout ? "Edit workout." : "Log a workout."}
          action={onCancel ? (
            <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={10} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Cancel</Text>
            </Pressable>
          ) : null}
        />

        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
          Enter a completed workout. This manual record is saved to your private account.
        </Text>

        <View style={{ gap: 12 }}>
          <Field label="Workout type" value={workoutType} onChangeText={setWorkoutType} placeholder="e.g. Strength, running, football" />
          <Field label="Date (YYYY-MM-DD)" value={performedOn} onChangeText={setPerformedOn} placeholder="YYYY-MM-DD" />
          <Field label="Duration (minutes)" value={duration} onChangeText={setDuration} placeholder="45" keyboardType="number-pad" />
        </View>

        <View style={{ gap: 12 }}>
          <SectionTitle title="Exercises · optional" />
          {exercises.map((exercise, index) => (
            <Card key={index}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TextInput
                  accessibilityLabel={`Exercise ${index + 1} name`}
                  value={exercise.name}
                  onChangeText={(value) => updateExercise(index, (current) => ({ ...current, name: value }))}
                  placeholder="Exercise name"
                  placeholderTextColor={colors.muted}
                  style={{ flex: 1, minHeight: 46, color: colors.text, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, fontSize: 13 }}
                />
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove exercise ${index + 1}`} onPress={() => setExercises((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="minus" size={17} color={colors.muted} />
                </Pressable>
              </View>
              {exercise.sets.map((set, setIndex) => (
                <View key={setIndex} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: colors.muted, width: 36, fontSize: 11 }}>Set {setIndex + 1}</Text>
                  <TextInput
                    accessibilityLabel={`Exercise ${index + 1}, set ${setIndex + 1}, repetitions`}
                    value={set.repetitions}
                    onChangeText={(value) => updateSet(index, setIndex, "repetitions", value)}
                    keyboardType="number-pad"
                    placeholder="Reps"
                    placeholderTextColor={colors.muted}
                    style={{ flex: 1, minHeight: 42, color: colors.text, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, fontSize: 12 }}
                  />
                  <TextInput
                    accessibilityLabel={`Exercise ${index + 1}, set ${setIndex + 1}, weight in kilograms`}
                    value={set.weight_kg}
                    onChangeText={(value) => updateSet(index, setIndex, "weight_kg", value)}
                    keyboardType="decimal-pad"
                    placeholder="kg"
                    placeholderTextColor={colors.muted}
                    style={{ width: 70, minHeight: 42, color: colors.text, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, fontSize: 12 }}
                  />
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove set ${setIndex + 1}`} onPress={() => updateExercise(index, (current) => ({ ...current, sets: current.sets.filter((_, itemIndex) => itemIndex !== setIndex) }))} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
                    <Icon name="minus" size={16} color={colors.muted} />
                  </Pressable>
                </View>
              ))}
              <Pressable accessibilityRole="button" accessibilityLabel={`Add a set to exercise ${index + 1}`} onPress={() => addSet(index)} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Icon name="plus" size={15} color={colors.accent} />
                <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600" }}>Add set</Text>
              </Pressable>
            </Card>
          ))}
          <Button label="Add exercise" icon="plus" variant="secondary" onPress={addExercise} />
        </View>

        <View style={{ gap: 7 }}>
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>Notes · optional</Text>
          <TextInput
            accessibilityLabel="Workout notes"
            accessibilityHint="Optional notes, up to 2,000 characters."
            value={notes}
            onChangeText={(value) => setNotes(value.slice(0, 2000))}
            maxLength={2000}
            multiline
            textAlignVertical="top"
            placeholder="How did it go?"
            placeholderTextColor={colors.muted}
            style={{ minHeight: 96, color: colors.text, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 19 }}
          />
          <Text style={{ color: colors.muted, fontSize: 10, textAlign: "right" }}>{notes.length}/2,000</Text>
        </View>

        {validationMessage ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{validationMessage}</Text> : null}
        {saveError ? (
          <Card>
            <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}>{saveError}</Text>
          </Card>
        ) : null}
        <Button label={saving ? "Saving…" : initialWorkout ? "Save changes" : "Save workout"} icon={saving ? undefined : "check"} disabled={saving} onPress={() => void submit()} />
        {saving ? <ActivityIndicator accessibilityLabel="Saving workout" color={colors.primary} /> : null}
      </Page>
    </KeyboardAvoidingView>
  );
}

function todayDateFor(timestamp: string) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "number-pad";
}) {
  const { colors } = useMoveitTheme();
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        style={{ minHeight: 48, color: colors.text, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, fontSize: 14 }}
      />
    </View>
  );
}
