import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button, Card, Header, Icon, Page, SectionTitle } from "../src/components/ui";
import { getLocalPreviewAccountId } from "../src/account-onboarding";
import { getPointsRules, getPointsSummary, resolvePointsTier } from "../src/rewards";
import { useMoveitTheme } from "../src/theme";

export default function AthleteRewardsScreen() {
  const { colors } = useMoveitTheme();
  const summary = getPointsSummary("athlete", getLocalPreviewAccountId());
  const tier = resolvePointsTier("athlete", summary.earnedPoints, summary.entries.length > 0);
  const enabledRules = getPointsRules().filter((rule) => rule.ownerType === "athlete" && rule.enabled);

  return (
    <Page>
      <Header
        eyebrow="ATHLETE · LOCAL PREVIEW"
        title="MOVEIT Rewards."
        action={<Button label="Back" variant="quiet" onPress={() => router.back()} />}
      />
      <Card style={{ backgroundColor: colors.hero }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Icon name="award" size={21} color={colors.accent} />
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "800" }}>Athlete rewards</Text>
        </View>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800" }}>
          {summary.entries.length ? `${summary.availablePoints} points` : "No eligible points yet"}
        </Text>
        {tier ? (
          <>
            <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "700" }}>{tier.current.name} tier · local ledger</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {tier.next ? `${Math.max(0, tier.next.minimumPoints - summary.earnedPoints)} points to ${tier.next.name}. ${tier.current.advancementCriteria}` : "Highest configured tier reached."}
            </Text>
          </>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            No confirmed qualifying activity exists, so no balance or tier is assigned. Local preview actions do not earn points.
          </Text>
        )}
      </Card>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Button label="Points history" icon="clock" variant="secondary" onPress={() => router.push("/rewards/history")} /></View>
        <View style={{ flex: 1 }}><Button label="Explore venues" icon="map-pin" variant="secondary" onPress={() => router.push("/venues")} /></View>
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Venue offers" />
        <Card>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>No active offers</Text>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            No venue has configured an approved reward in this preview. Demo venues are not represented as offering discounts.
          </Text>
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="How points work" />
        <Card>
          {enabledRules.length ? enabledRules.map((rule) => (
            <Text key={rule.id} style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>{rule.points} points · {rule.reason}</Text>
          )) : (
            <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
              Points require completed eligible activity confirmed by a trusted booking or payment service. No earning rules are active in this local preview. Screen views, taps, and preview bookings never earn points.
            </Text>
          )}
        </Card>
      </View>
      <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 16 }}>
        Local-only accounting is not an authoritative balance. Future rewards require server-side validation, idempotent ledger updates, and trusted booking/payment events.
      </Text>
    </Page>
  );
}
