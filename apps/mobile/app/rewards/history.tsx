import { router } from "expo-router";
import { Text } from "react-native";
import { Button, Card, Header, Page, SectionTitle } from "../../src/components/ui";
import { getLocalPreviewAccountId } from "../../src/account-onboarding";
import { getPointsLedger } from "../../src/rewards";
import { useMoveitTheme } from "../../src/theme";

export default function AthletePointsHistoryScreen() {
  const { colors } = useMoveitTheme();
  const entries = getPointsLedger("athlete", getLocalPreviewAccountId());

  return (
    <Page>
      <Header eyebrow="ATHLETE REWARDS" title="Points history." action={<Button label="Rewards" variant="quiet" onPress={() => router.replace("/rewards")} />} />
      <SectionTitle title="Ledger entries" />
      {entries.length ? entries.map((entry) => (
        <Card key={entry.id}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{entry.reason}</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{entry.eventType.replace(/_/g, " ")} · {entry.status} · {new Date(entry.createdAt).toLocaleDateString()}</Text>
          <Text style={{ color: entry.points < 0 ? colors.danger : colors.accent, fontSize: 14, fontWeight: "800" }}>
            {entry.points > 0 ? "+" : ""}{entry.points} points
          </Text>
        </Card>
      )) : (
        <Card>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>No points activity</Text>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>The ledger is empty. Local preview bookings, profile edits, and button taps do not create point entries.</Text>
        </Card>
      )}
      <Text style={{ color: colors.muted, fontSize: 10 }}>This device-local preview ledger is not a secure account balance and has no remote synchronization.</Text>
    </Page>
  );
}
