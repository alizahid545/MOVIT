import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, Header, Icon, Page, Pill, SectionTitle } from "../src/components/ui";
import { previewAthletes } from "../src/sports-preview-data";
import { sportsCatalogue } from "../src/sports-catalogue";
import { useMoveitTheme } from "../src/theme";

const sports = [
  { id: "all", name: "All sports" },
  ...Array.from(new Set(previewAthletes.map((athlete) => athlete.sportId)))
    .map((id) => sportsCatalogue.find((sport) => sport.id === id))
    .filter((sport): sport is (typeof sportsCatalogue)[number] => Boolean(sport))
    .map((sport) => ({ id: sport.id, name: sport.name })),
];

export default function LeaderboardScreen() {
  const { colors } = useMoveitTheme();
  const [sportId, setSportId] = useState("all");
  const rows = useMemo(
    () => previewAthletes.filter((athlete) => sportId === "all" || athlete.sportId === sportId),
    [sportId],
  );

  return (
    <Page>
      <Header eyebrow="SPORTS PREVIEW · DEMO DATA" title="Leaderboard." />
      <Card>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>Illustrative rankings only</Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
          These example athletes and points are not MOVEIT users or live rankings. A proposed score is 10 points per completed, logged workout, capped at one scored workout per day. Venue visits, steps alone, and joining a challenge do not score.
        </Text>
      </Card>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Sport" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {sports.map((item) => (
            <Pill key={item.id} label={item.name} selected={sportId === item.id} onPress={() => setSportId(item.id)} />
          ))}
        </View>
      </View>

      <View style={{ gap: 0 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>DEMO ATHLETE</Text>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>POINTS · CHANGE</Text>
        </View>
        {rows.map((athlete, index) => (
          <View key={athlete.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 58, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ width: 24, color: colors.muted, fontSize: 13, fontWeight: "600" }}>{index + 1}</Text>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{athlete.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{sportsCatalogue.find((item) => item.id === athlete.sportId)?.name ?? "Sport unavailable"}</Text>
            </View>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{athlete.points}</Text>
            <Icon
              name={athlete.movement === "up" ? "trending-up" : athlete.movement === "down" ? "trending-down" : "minus"}
              size={16}
              color={athlete.movement === "same" ? colors.muted : colors.primary}
            />
          </View>
        ))}
      </View>
      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
        Future rankings should count completed activity, use daily caps, and avoid rewarding unsafe training volume. This preview does not record scores.
      </Text>
      <Button label="Explore challenge concepts" variant="secondary" icon="flag" onPress={() => router.push("/challenges")} />
    </Page>
  );
}
