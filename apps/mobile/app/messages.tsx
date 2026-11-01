import { Text, View } from "react-native";
import { router } from "expo-router";
import { Button, Card, Header, Icon, Page } from "../src/components/ui";
import { useMoveitTheme } from "../src/theme";

export default function MessagesScreen() {
  const { colors } = useMoveitTheme();

  return (
    <Page>
      <Header eyebrow="YOUR CONVERSATIONS" title="Messages." action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} />
      <View style={{ alignItems: "center", gap: 14, paddingTop: 24 }}>
        <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
          <Icon name="message-circle" size={23} color={colors.accent} />
        </View>
        <Card style={{ gap: 8 }}>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" }}>Private messaging is not connected yet</Text>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: "center" }}>
            Your conversations are not stored or shared by this screen. Secure messaging needs conversation membership, message storage, RLS policies and realtime authorization before messages can appear here.
          </Text>
        </Card>
      </View>
    </Page>
  );
}
