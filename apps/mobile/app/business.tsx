import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text } from "react-native";
import { Button, Card, Header, Page } from "../src/components/ui";
import { getPreviewBusiness } from "../src/venue-preview";
import { useMoveitTheme } from "../src/theme";

export default function BusinessEntryScreen() {
  const { colors } = useMoveitTheme();
  const [hasBusiness, setHasBusiness] = useState(Boolean(getPreviewBusiness()));
  useFocusEffect(useCallback(() => {
    setHasBusiness(Boolean(getPreviewBusiness()));
  }, []));

  return (
    <Page>
      <Header eyebrow="MOVEIT FOR BUSINESS" title="Run your venue." action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} />
      <Card>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>One MOVEIT account, distinct experiences</Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19 }}>
          Business access will use MOVEIT's existing account authentication and business memberships. This preview does not create a second login or grant account roles.
        </Text>
        <Button label="Business sign in · existing account" icon="log-in" onPress={() => router.push("/auth")} />
        <Button label={hasBusiness ? "Open business dashboard" : "List Your Venue"} icon="home" variant="secondary" onPress={() => router.push(hasBusiness ? "/business/dashboard" : "/business/register")} />
      </Card>
      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
        Registration and venue edits are temporary local previews. Verification, staff access, publication, bookings and payments are not connected.
      </Text>
    </Page>
  );
}
