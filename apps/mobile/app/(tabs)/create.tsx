import { useMemo, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { activityInputSchema, sportsCatalogue, type ActivityInput, type SportSkillLevel } from "@moveit/shared";
import { createCommunityPlatformRepository } from "@moveit/supabase";
import { Button, Header, Page, Pill, SectionTitle } from "../../src/components/ui";
import { supabase } from "../../src/supabase";
import { useMoveitTheme } from "../../src/theme";

const skillLevels: { value: SportSkillLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "professional", label: "Professional" },
];

export default function CreateScreen() {
  const { colors } = useMoveitTheme();
  const startOptions = useMemo(() => {
    const today = new Date();
    today.setHours(19, 0, 0, 0);
    if (today <= new Date()) today.setDate(today.getDate() + 1);
    return Array.from({ length: 3 }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      return date;
    });
  }, []);
  const [sportId, setSportId] = useState(sportsCatalogue[0]?.id ?? "football");
  const [startsAt, setStartsAt] = useState(startOptions[0]?.toISOString() ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("");
  const [capacity, setCapacity] = useState("12");
  const [requiredSkillLevel, setRequiredSkillLevel] = useState<SportSkillLevel | null>(null);
  const [visibility, setVisibility] = useState<ActivityInput["visibility"]>("public");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const publish = async () => {
    setError("");
    const parsed = activityInputSchema.safeParse({
      sportId,
      title,
      description,
      startsAt,
      endsAt: null,
      venueName,
      city,
      capacity: Number(capacity),
      requiredSkillLevel,
      visibility,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the activity details.");
      return;
    }
    if (!supabase) {
      setError("Sign in to publish activities to MOVEIT.");
      return;
    }
    setSaving(true);
    try {
      const activityId = await createCommunityPlatformRepository(supabase).createActivity(parsed.data);
      router.replace({ pathname: "/activities/[id]", params: { id: activityId } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The activity could not be published.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <Header eyebrow="MAKE THE FIRST MOVE" title="Create an activity." />
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19 }}>
        Publish a real activity for MOVEIT athletes. You’ll be added as its organizer and first participant.
      </Text>

      <SectionTitle title="Choose a sport" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {sportsCatalogue.filter((sport) => sport.popular).slice(0, 12).map((sport) => (
          <Pill key={sport.id} label={sport.name} selected={sport.id === sportId} onPress={() => setSportId(sport.id)} />
        ))}
      </View>

      <Field label="Activity title" value={title} onChangeText={setTitle} placeholder="Saturday morning football" />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="What should participants know?" multiline />
      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Date and time</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {startOptions.map((date) => (
            <Pill
              key={date.toISOString()}
              label={date.toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              selected={date.toISOString() === startsAt}
              onPress={() => setStartsAt(date.toISOString())}
            />
          ))}
        </View>
      </View>
      <Field label="Venue or meeting place" value={venueName} onChangeText={setVenueName} placeholder="Sports ground or public landmark" />
      <Field label="City or area" value={city} onChangeText={setCity} placeholder="e.g. Lahore" />
      <Field label="Participant capacity (2–200)" value={capacity} onChangeText={setCapacity} placeholder="12" keyboardType="number-pad" />

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Minimum skill level (optional)</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pill label="Any level" selected={!requiredSkillLevel} onPress={() => setRequiredSkillLevel(null)} />
          {skillLevels.map((level) => (
            <Pill key={level.value} label={level.label} selected={level.value === requiredSkillLevel} onPress={() => setRequiredSkillLevel(level.value)} />
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Visibility</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pill label="Public" selected={visibility === "public"} onPress={() => setVisibility("public")} />
          <Pill label="Private" selected={visibility === "private"} onPress={() => setVisibility("private")} />
        </View>
        {visibility === "private" ? (
          <Text style={{ color: colors.muted, fontSize: 11 }}>Private activities are visible only to you. Invitations are not available yet.</Text>
        ) : null}
      </View>

      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
      <Button label={saving ? "Publishing…" : "Publish activity"} disabled={saving} onPress={() => void publish()} />
      <Button label="Write a community post" icon="edit-3" variant="secondary" onPress={() => router.push("/posts/create")} />
    </Page>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: "default" | "number-pad";
}) {
  const { colors } = useMoveitTheme();
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? "top" : "center"}
        style={{
          minHeight: multiline ? 104 : 48,
          color: colors.text,
          backgroundColor: colors.field,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
        }}
      />
    </View>
  );
}
