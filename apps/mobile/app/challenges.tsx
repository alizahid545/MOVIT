import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Text, View } from "react-native";
import { Button, Card, Header, Icon, Page, SectionTitle } from "../src/components/ui";
import { previewChallenges } from "../src/sports-preview-data";
import { sportsCatalogue } from "../src/sports-catalogue";
import { getChallengeStatus, getPreviewOwnerId, listPreviewChallenges, type PreviewChallengeRecord } from "../src/challenge-preview";
import { useMoveitTheme } from "../src/theme";

export default function ChallengesScreen() {
  const { colors } = useMoveitTheme();
  const [interested, setInterested] = useState<string[]>([]);
  const [createdChallenges, setCreatedChallenges] = useState<PreviewChallengeRecord[]>([]);

  useFocusEffect(useCallback(() => {
    setCreatedChallenges(listPreviewChallenges().filter((challenge) =>
      challenge.creatorId === getPreviewOwnerId() || challenge.audience === "public",
    ));
  }, []));

  const toggleInterest = (id: string) => {
    setInterested((current) => current.includes(id)
      ? current.filter((challengeId) => challengeId !== id)
      : [...current, id]);
  };

  return (
    <Page>
      <Header eyebrow="SPORTS PREVIEW · DEMO CONCEPTS" title="Challenges." />
      <Button label="Create a challenge" icon="plus" onPress={() => router.push("/challenges/create")} />
      {createdChallenges.length ? (
        <View style={{ gap: 12 }}>
          <SectionTitle title="Your local challenges" />
          {createdChallenges.map((challenge) => {
            const sportName = sportsCatalogue.find((sport) => sport.id === challenge.sportId)?.name ?? "Sport unavailable";
            const status = getChallengeStatus(challenge);
            return (
              <Card key={challenge.id}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{challenge.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{sportName} · {challenge.audience.toUpperCase()} · {status}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{challenge.target} {challenge.unit} · {challenge.participantIds.length} local participants</Text>
                <Button label="Open challenge" variant="secondary" onPress={() => router.push({ pathname: "/challenges/[id]", params: { id: challenge.id } })} />
              </Card>
            );
          })}
        </View>
      ) : null}
      <Card>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>Not live challenges</Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
          These concepts and deadlines are examples. Interest stays in this screen’s temporary local state; no challenge entry, progress, or completion is saved.
        </Text>
      </Card>
      <SectionTitle title="Participation concepts" />
      {previewChallenges.map((challenge) => {
        const selected = interested.includes(challenge.id);
        return (
          <Card key={challenge.id}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <Icon name="flag" size={18} color={colors.primary} />
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{challenge.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{challenge.sportId ? sportsCatalogue.find((sport) => sport.id === challenge.sportId)?.name ?? "Sport unavailable" : "All sports"} · {challenge.deadline}</Text>
              </View>
            </View>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{challenge.target}</Text>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={`Illustrative example progress for ${challenge.title}`}
              accessibilityValue={{ min: 0, max: challenge.sampleTarget, now: challenge.sampleProgress }}
              style={{ height: 4, overflow: "hidden", borderRadius: 2, backgroundColor: colors.surfaceAlt }}
            >
              <View style={{
                width: `${(challenge.sampleProgress / challenge.sampleTarget) * 100}%`,
                height: "100%",
                backgroundColor: colors.primary,
              }} />
            </View>
            <Text style={{ color: colors.muted, fontSize: 10 }}>
              Example progress · {challenge.sampleProgress}/{challenge.sampleTarget} · {challenge.sampleProgress === challenge.sampleTarget ? "complete in sample" : challenge.sampleProgress === 0 ? "not started in sample" : "in progress in sample"}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{challenge.description}</Text>
            <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>{challenge.safetyNote}</Text>
            <Button
              label={selected ? "Selected in preview · local only" : "Preview participation · local only"}
              variant="secondary"
              onPress={() => toggleInterest(challenge.id)}
            />
          </Card>
        );
      })}
      <View style={{ gap: 8 }}>
        <SectionTitle title="How completion should work" />
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
          Future challenge progress should come from completed workouts, not arrival, attendance, or check-ins. Give participants flexible deadlines and rest options; do not reward excessive volume.
        </Text>
        <Button label="Find players" icon="users" onPress={() => router.navigate({ pathname: "/(tabs)/community", params: { view: "players" } })} />
      </View>
    </Page>
  );
}
