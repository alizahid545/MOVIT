import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { Button, Card, Header, Icon, Page, SectionTitle } from "../../src/components/ui";
import { getPointsLedger, getPointsSummary, resolvePointsTier } from "../../src/rewards";
import { listOwnedPreviewVenues } from "../../src/venue-preview";
import { useMoveitTheme } from "../../src/theme";

export default function VenueRewardsScreen() {
  const { colors } = useMoveitTheme();
  const params = useLocalSearchParams<{ venueId?: string }>();
  const venueId = typeof params.venueId === "string" ? params.venueId : "";
  const venue = listOwnedPreviewVenues().find((item) => item.id === venueId);

  if (!venue) {
    return <Page><Header eyebrow="VENUE PERFORMANCE" title="Venue unavailable." action={<Button label="Dashboard" variant="quiet" onPress={() => router.replace("/business/dashboard")} />} /><Card><Text style={{ color: colors.muted }}>Choose an owned venue from the business dashboard. Venue accounts are kept separate by venue ID.</Text></Card></Page>;
  }

  const summary = getPointsSummary("venue", venue.id);
  const entries = getPointsLedger("venue", venue.id);
  const tier = resolvePointsTier("venue", summary.earnedPoints, entries.length > 0);

  return (
    <Page>
      <Header eyebrow="VENUE POINTS · LOCAL ONLY" title={venue.name} action={<Button label="Dashboard" variant="quiet" onPress={() => router.replace("/business/dashboard")} />} />
      <Card style={{ backgroundColor: colors.hero }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <Icon name="award" size={20} color={colors.accent} />
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>Venue performance</Text>
        </View>
        <Text style={{ color: colors.text, fontSize: 23, fontWeight: "800" }}>{entries.length ? `${summary.availablePoints} points` : "No qualifying points yet"}</Text>
        <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
          {tier ? `${tier.current.name} tier · ${tier.next ? `${Math.max(0, tier.next.minimumPoints - summary.earnedPoints)} points to ${tier.next.name}` : "Top configured tier"}` : "No tier assigned without qualifying completed venue activity."}
        </Text>
      </Card>
      <View style={{ gap: 10 }}>
        <SectionTitle title="Performance indicators" />
        <Card>
          <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>Completed qualifying bookings · unavailable</Text>
          <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>Fulfilment reliability · unavailable</Text>
          <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>Genuine customer reviews · unavailable</Text>
          <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>Discovery ranking · not calculated (insufficient verified dataset)</Text>
        </Card>
      </View>
      <Button label="Venue points history" icon="clock" variant="secondary" onPress={() => router.push({ pathname: "/business/rewards/history", params: { venueId: venue.id } })} />
      <SectionTitle title="How this venue can qualify" />
      <Card>
        <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 18 }}>
          Only completed eligible bookings, verified payments, fulfilled visits, and genuine customer experience may qualify under future configured rules. Draft bookings, cancelled requests, owner edits, and local preview actions do not award points.
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 18 }}>
          Venue balances are per venue, not shared across sibling locations. Owners cannot edit points or verification status in this screen.
        </Text>
      </Card>
      <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 16 }}>No verified transactions, reviews, or ranking snapshots are connected. This screen does not assign points or promise discovery placement.</Text>
    </Page>
  );
}
