import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { Button, Header, Page, Pill, SectionTitle } from "../../src/components/ui";
import { createPreviewChallenge, challengeSchema, updatePreviewChallenge, getPreviewOwnerId, listPreviewChallenges, type ChallengeAudience, type ChallengeMetric, type ChallengeRewardType } from "../../src/challenge-preview";
import { searchSports, type CatalogueSport } from "../../src/sports-catalogue";
import { useMoveitTheme } from "../../src/theme";

const metrics: { id: ChallengeMetric; label: string; unit: string }[] = [
  { id: "workout_count", label: "Workouts", unit: "sessions" },
  { id: "duration_minutes", label: "Duration", unit: "minutes" },
  { id: "distance_meters", label: "Distance", unit: "meters" },
  { id: "steps", label: "Steps", unit: "steps" },
  { id: "custom", label: "Custom", unit: "units" },
];

function localDate(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function CreateChallengeScreen() {
  const { colors } = useMoveitTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const challengeId = typeof params.id === "string" ? params.id : "";
  const existing = challengeId ? listPreviewChallenges().find((item) => item.id === challengeId) : undefined;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [sportQuery, setSportQuery] = useState("");
  const [sport, setSport] = useState<CatalogueSport | undefined>(searchSports().find((item) => item.id === existing?.sportId));
  const [startsOn, setStartsOn] = useState(existing?.startsOn ?? localDate(1));
  const [endsOn, setEndsOn] = useState(existing?.endsOn ?? localDate(8));
  const [metric, setMetric] = useState<ChallengeMetric>(existing?.metric ?? "workout_count");
  const [target, setTarget] = useState(existing ? String(existing.target) : "3");
  const [unit, setUnit] = useState(existing?.unit ?? "sessions");
  const [eligibilityRules, setEligibilityRules] = useState(existing?.eligibilityRules ?? "Open to participants who can safely take part.");
  const [completionRules, setCompletionRules] = useState(existing?.completionRules ?? "Count completed activity reported by each participant.");
  const [participantLimit, setParticipantLimit] = useState(existing?.participantLimit ? String(existing.participantLimit) : "");
  const [rewardType, setRewardType] = useState<ChallengeRewardType>(existing?.rewardType ?? "none");
  const [rewardPoints, setRewardPoints] = useState(existing?.rewardPoints ? String(existing.rewardPoints) : "");
  const [reward, setReward] = useState(existing?.reward ?? "");
  const [audience, setAudience] = useState<ChallengeAudience>(existing?.audience ?? "public");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const matchingSports = useMemo(() => searchSports(sportQuery).slice(0, 12), [sportQuery]);

  const save = () => {
    const candidate = {
      title,
      description,
      sportId: sport?.id ?? "",
      startsOn,
      endsOn,
      metric,
      target: Number(target),
      unit,
      eligibilityRules,
      completionRules,
      participantLimit: participantLimit.trim() ? Number(participantLimit) : undefined,
      rewardType,
      rewardPoints: rewardType === "points" && rewardPoints.trim() ? Number(rewardPoints) : undefined,
      reward: rewardType === "none" ? undefined : reward.trim() || undefined,
      audience,
    };
    const parsed = challengeSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Review the challenge details.");
      setSuccess(false);
      return;
    }
    try {
      const saved = existing
        ? updatePreviewChallenge(existing.id, getPreviewOwnerId(), parsed.data)
        : createPreviewChallenge(parsed.data);
      setError("");
      setSuccess(true);
      router.replace({ pathname: "/challenges/[id]", params: { id: saved.id } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The challenge preview could not be saved.");
    }
  };

  return (
    <Page>
      <Header eyebrow="LOCAL PREVIEW · NOT PUBLISHED" title={existing ? "Edit challenge." : "Create a challenge."} action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} />
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
        This challenge is held in temporary app memory only and is not published or saved to an account. Invitations only simulate fictional sample recipients. Progress will be self-reported, not verified.
      </Text>
      <Field label="Title" value={title} onChangeText={setTitle} placeholder="A manageable goal for your community" />
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="What is the challenge about?" multiline />

      <View style={{ gap: 8 }}>
        <SectionTitle title={sport ? `Sport · ${sport.name}` : "Choose a sport"} />
        <TextInput accessibilityLabel="Search sports catalogue" value={sportQuery} onChangeText={setSportQuery} placeholder="Search sport name or alias" placeholderTextColor={colors.muted} style={inputStyle(colors)} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {matchingSports.map((item) => <Pill key={item.id} label={item.name} selected={sport?.id === item.id} onPress={() => setSport(item)} />)}
        </View>
      </View>

      <View style={{ gap: 9 }}>
        <SectionTitle title="Dates" />
        <Field label="Start date · YYYY-MM-DD" value={startsOn} onChangeText={setStartsOn} placeholder="2026-01-01" />
        <Field label="End date · YYYY-MM-DD" value={endsOn} onChangeText={setEndsOn} placeholder="2026-01-08" />
      </View>

      <View style={{ gap: 8 }}>
        <SectionTitle title="Goal" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {metrics.map((item) => <Pill key={item.id} label={item.label} selected={metric === item.id} onPress={() => { setMetric(item.id); setUnit(item.unit); }} />)}
        </View>
        <Field label="Target value" value={target} onChangeText={setTarget} placeholder="3" keyboardType="number-pad" />
        <Field label="Unit" value={unit} onChangeText={setUnit} placeholder="sessions" />
      </View>

      <Field label="Eligibility rules" value={eligibilityRules} onChangeText={setEligibilityRules} placeholder="Who can participate?" multiline />
      <Field label="Completion rules" value={completionRules} onChangeText={setCompletionRules} placeholder="What counts toward the target?" multiline />
      <Field label="Participant limit · optional" value={participantLimit} onChangeText={(value) => setParticipantLimit(value.replace(/[^\d]/g, ""))} placeholder="No limit" keyboardType="number-pad" />
      <View style={{ gap: 8 }}>
        <SectionTitle title="Optional proposed recognition" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {([
            ["none", "None"],
            ["badge", "Badge"],
            ["points", "Points"],
            ["achievement", "Achievement"],
          ] as const).map(([id, label]) => (
            <Pill key={id} label={label} selected={rewardType === id} onPress={() => setRewardType(id)} />
          ))}
        </View>
        {rewardType === "points" ? (
          <Field label="Proposed points · 1–1000" value={rewardPoints} onChangeText={(value) => setRewardPoints(value.replace(/[^\d]/g, ""))} placeholder="100" keyboardType="number-pad" />
        ) : null}
        {rewardType !== "none" ? (
          <Field label="Recognition description · optional" value={reward} onChangeText={setReward} placeholder="Describe the proposed recognition" />
        ) : null}
        <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
          This is only a proposal in local preview. No points, badges, achievements, or redeemable rewards are issued.
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <SectionTitle title="Who can see and join?" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {([
            ["public", "Public"],
            ["friends", "Friends"],
            ["private", "Private / invite-only"],
          ] as const).map(([id, label]) => (
            <Pill key={id} label={label} selected={audience === id} onPress={() => setAudience(id)} />
          ))}
        </View>
        <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
          Friends means mutual accepted followers. Local invitations can be managed from the challenge details; friends-audience invitations are limited to mutual followers. No invitation is sent remotely.
        </Text>
      </View>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
      {success ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12 }}>Challenge preview created locally.</Text> : null}
      <Button label={existing ? "Update local challenge" : "Create local challenge"} icon="flag" onPress={save} />
    </Page>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
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
        multiline={multiline}
        keyboardType={keyboardType}
        style={[inputStyle(colors), multiline ? { minHeight: 84, textAlignVertical: "top", paddingTop: 12 } : null]}
      />
    </View>
  );
}

function inputStyle(colors: ReturnType<typeof useMoveitTheme>["colors"]) {
  return {
    minHeight: 46,
    color: colors.text,
    backgroundColor: colors.field,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 13,
    fontSize: 13,
  } as const;
}
