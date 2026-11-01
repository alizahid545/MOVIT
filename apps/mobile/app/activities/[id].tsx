import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  activityInputSchema,
  sportsCatalogue,
  type ActivityInput,
  type ActivityRecord,
  type SportSkillLevel,
} from "@moveit/shared";
import { createCommunityPlatformRepository, type ActivityParticipant } from "@moveit/supabase";
import { Button, Card, Header, Page, Pill, SectionTitle } from "../../src/components/ui";
import { supabase } from "../../src/supabase";
import { useMoveitTheme } from "../../src/theme";

const skills: { value: SportSkillLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "professional", label: "Professional" },
];

export default function ActivityDetailsScreen() {
  const { colors } = useMoveitTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const activityId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [activity, setActivity] = useState<ActivityRecord | null>(null);
  const [participants, setParticipants] = useState<ActivityParticipant[]>([]);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [venueName, setVenueName] = useState("");
  const [city, setCity] = useState("");
  const [capacity, setCapacity] = useState("");
  const [requiredSkillLevel, setRequiredSkillLevel] = useState<SportSkillLevel | null>(null);
  const [visibility, setVisibility] = useState<ActivityInput["visibility"]>("public");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !activityId) {
      setError("Sign in to view this activity.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const repository = createCommunityPlatformRepository(supabase);
      const [{ data: auth }, loaded] = await Promise.all([
        supabase.auth.getUser(),
        repository.loadActivity(activityId),
      ]);
      const memberRows = await repository.loadActivityParticipants(activityId);
      setUserId(auth.user?.id ?? "");
      setActivity(loaded);
      setParticipants(memberRows);
      setTitle(loaded.title);
      setDescription(loaded.description);
      setStartsAt(loaded.startsAt);
      setVenueName(loaded.venueName);
      setCity(loaded.city);
      setCapacity(String(loaded.capacity));
      setRequiredSkillLevel(loaded.requiredSkillLevel);
      setVisibility(loaded.visibility);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The activity could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!supabase || !activity) return;
    const parsed = activityInputSchema.safeParse({
      sportId: activity.sportId,
      title,
      description,
      startsAt,
      endsAt: activity.endsAt,
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
    setBusy(true);
    setError("");
    try {
      await createCommunityPlatformRepository(supabase).updateActivity(activity.id, parsed.data);
      setEditing(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The activity could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const participate = async (action: "join" | "leave" | "cancel") => {
    if (!supabase || !activity) return;
    setBusy(true);
    setError("");
    try {
      const repository = createCommunityPlatformRepository(supabase);
      if (action === "join") await repository.joinActivity(activity.id);
      else if (action === "leave") await repository.leaveActivity(activity.id);
      else await repository.cancelActivity(activity.id);
      setConfirmCancel(false);
      setEditing(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That activity change could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const isOrganizer = activity?.organizerId === userId;
  const sportName = sportsCatalogue.find((sport) => sport.id === activity?.sportId)?.name ?? activity?.sportId;

  return (
    <Page>
      <Header
        eyebrow="ACTIVITY DETAILS"
        title={loading ? "Loading…" : activity?.title ?? "Activity"}
        action={<Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Back</Text>
        </Pressable>}
      />
      {loading ? <View accessibilityRole="progressbar" style={{ alignItems: "center", padding: 28 }}><ActivityIndicator color={colors.accent} /></View> : null}
      {error ? <Card style={{ gap: 10 }}>
        <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}>{error}</Text>
        <Button label="Try again" variant="secondary" onPress={() => void load()} />
      </Card> : null}
      {!loading && activity ? (
        <>
          <Card style={{ gap: 10 }}>
            {!editing ? (
              <>
                <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "700" }}>{sportName} · {activity.visibility}</Text>
                <Text style={{ color: colors.text, fontSize: 15, lineHeight: 23 }}>{activity.description || "No description provided."}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{new Date(activity.startsAt).toLocaleString()}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{activity.venueName} · {activity.city}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {activity.requiredSkillLevel ? `${activity.requiredSkillLevel} minimum · ` : ""}
                  {activity.participantCount}/{activity.capacity} participants · {activity.status}
                </Text>
                {activity.status === "published" && !isOrganizer ? (
                  <Button
                    label={busy ? "Saving…" : activity.joinedByCurrentUser ? "Leave activity" : "Join activity"}
                    variant={activity.joinedByCurrentUser ? "secondary" : "primary"}
                    disabled={busy || (!activity.joinedByCurrentUser && activity.participantCount >= activity.capacity)}
                    onPress={() => void participate(activity.joinedByCurrentUser ? "leave" : "join")}
                  />
                ) : null}
                {isOrganizer && activity.status === "published" ? (
                  <>
                    <Button label="Edit activity" variant="secondary" onPress={() => setEditing(true)} />
                    <Button
                      label={confirmCancel ? "Confirm cancellation" : "Cancel activity"}
                      variant="secondary"
                      disabled={busy}
                      onPress={() => confirmCancel ? void participate("cancel") : setConfirmCancel(true)}
                    />
                    {confirmCancel ? (
                      <Text style={{ color: colors.danger, fontSize: 11 }}>This will close the activity to further participation.</Text>
                    ) : null}
                  </>
                ) : null}
              </>
            ) : (
              <View style={{ gap: 12 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Editing as organizer · changes are checked by the server.</Text>
                <Field label="Title" value={title} onChangeText={setTitle} />
                <Field label="Description" value={description} onChangeText={setDescription} multiline />
                <Field label="Start time (ISO 8601)" value={startsAt} onChangeText={setStartsAt} />
                <Text style={{ color: colors.muted, fontSize: 10 }}>Use a future date and time, for example 2027-01-15T19:00:00.000Z.</Text>
                <Field label="Venue or meeting place" value={venueName} onChangeText={setVenueName} />
                <Field label="City or area" value={city} onChangeText={setCity} />
                <Field label="Capacity (2–200)" value={capacity} onChangeText={setCapacity} keyboardType="number-pad" />
                <SectionTitle title="Minimum skill" />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Pill label="Any level" selected={!requiredSkillLevel} onPress={() => setRequiredSkillLevel(null)} />
                  {skills.map((skill) => <Pill key={skill.value} label={skill.label} selected={skill.value === requiredSkillLevel} onPress={() => setRequiredSkillLevel(skill.value)} />)}
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Pill label="Public" selected={visibility === "public"} onPress={() => setVisibility("public")} />
                  <Pill label="Private" selected={visibility === "private"} onPress={() => setVisibility("private")} />
                </View>
                <Button label={busy ? "Saving…" : "Save changes"} disabled={busy} onPress={() => void save()} />
                <Button label="Discard changes" variant="secondary" disabled={busy} onPress={() => { setEditing(false); void load(); }} />
              </View>
            )}
          </Card>

          <SectionTitle title={`Participants · ${participants.length}`} />
          {participants.map((participant) => (
            <ParticipantCard
              key={participant.userId}
              participant={participant}
              organizerId={activity.organizerId}
            />
          ))}
          {!participants.length ? <Text style={{ color: colors.muted, fontSize: 12 }}>No participants yet.</Text> : null}
        </>
      ) : null}
    </Page>
  );
}

function ParticipantCard({
  participant,
  organizerId,
}: {
  participant: ActivityParticipant;
  organizerId: string;
}) {
  const { colors } = useMoveitTheme();
  const profile = participant.profile;
  return (
    <Card>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>
        {profile?.display_name || `@${profile?.username ?? "athlete"}`}
        {participant.userId === organizerId ? " · Organizer" : ""}
      </Text>
      {profile?.city ? <Text style={{ color: colors.muted, fontSize: 11 }}>{profile.city}</Text> : null}
    </Card>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline = false,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "number-pad";
}) {
  const { colors } = useMoveitTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? "top" : "center"}
        style={{
          minHeight: multiline ? 90 : 46,
          color: colors.text,
          backgroundColor: colors.field,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 13,
          paddingVertical: multiline ? 10 : 0,
        }}
      />
    </View>
  );
}
