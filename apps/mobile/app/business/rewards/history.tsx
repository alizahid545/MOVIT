import { router, useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { Button, Card, Header, Page, SectionTitle } from "../../../src/components/ui";
import { getPointsLedger } from "../../../src/rewards";
import { listOwnedPreviewVenues } from "../../../src/venue-preview";
import { useMoveitTheme } from "../../../src/theme";

export default function VenuePointsHistoryScreen() {
  const { colors } = useMoveitTheme();
  const params = useLocalSearchParams<{ venueId?: string }>();
  const venueId = typeof params.venueId === "string" ? params.venueId : "";
  const venue = listOwnedPreviewVenues().find((item) => item.id === venueId);
  const entries = venue ? getPointsLedger("venue", venue.id) : [];

  return (
    <Page>
      <Header
        eyebrow="VENUE REWARDS"
        title="Points history."
        action={<Button label="Venue points" variant="quiet" onPress={() => router.replace({ pathname: "/business/rewards", params: { venueId } })} />}
      />
      <SectionTitle title={venue ? venue.name : "Venue unavailable"} />
      {!venue ? (
        <Card><Text style={{ color: colors.muted }}>The requested venue is not part of this local business preview.</Text></Card>
      ) : entries.length ? entries.map((entry) => (
        <Card key={entry.id}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{entry.reason}</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{entry.eventType.replace(/_/g, " ")} · {entry.status} · {new Date(entry.createdAt).toLocaleDateString()}</Text>
          <Text style={{ color: entry.points < 0 ? colors.danger : colors.accent, fontSize: 14, fontWeight: "800" }}>{entry.points > 0 ? "+" : ""}{entry.points} points</Text>
        </Card>
      )) : (
        <Card>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>No points ledger entries</Text>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>No qualifying activity is available for this venue. Preview booking requests are not qualifying transactions.</Text>
        </Card>
      )}
    </Page>
  );
}
