import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { Button, Page } from "../src/components/ui";
import { design, useMoveitTheme } from "../src/theme";

export default function WelcomeScreen() {
  const { colors } = useMoveitTheme();

  return (
    <Page>
        <View style={{ flex: 1, justifyContent: "flex-start", gap: 32, paddingBottom: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Brand />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Browse the MOVEIT demo"
              onPress={() => router.replace("/(tabs)")}
              hitSlop={12}
            >
              <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Skip</Text>
            </Pressable>
          </View>

          <View style={{ gap: 18 }}>
            <View style={{ height: 1, backgroundColor: colors.border }} />
            <View style={{ gap: 16 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", letterSpacing: 1.5 }}>
                YOUR CITY. YOUR PEOPLE. YOUR GAME.
              </Text>
              <Text
                accessibilityRole="header"
                style={[design.typography.display, { color: colors.text }]}
              >
                Make room{"\n"}for more play.
              </Text>
              <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 24, maxWidth: 390 }}>
                Find a game, meet your people, and make your next move.
              </Text>
            </View>
          </View>

          <View style={{ gap: 14 }}>
            <Button label="Explore the demo" icon="arrow-right" onPress={() => router.replace("/(tabs)")} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in with your MOVEIT account"
              onPress={() => router.push("/auth")}
              style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                Already have an account? <Text style={{ color: colors.accent }}>Sign in</Text>
              </Text>
            </Pressable>
            <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center" }}>
              Preview content is demo-only. No activity or booking is submitted.
            </Text>
          </View>
        </View>
    </Page>
  );
}

function Brand() {
  const { colors } = useMoveitTheme();

  return (
    <Text accessibilityRole="header" style={{ color: colors.text, fontWeight: "700", fontSize: 19, letterSpacing: 1.4 }}>
      MOVEIT<Text style={{ color: colors.accent }}>.</Text>
    </Text>
  );
}
