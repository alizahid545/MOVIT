import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { router } from "expo-router";
import { Button, Card, Header, Page, Pill, SectionTitle } from "../../src/components/ui";
import { supabase } from "../../src/supabase";
import { useMoveitTheme, type ThemeMode } from "../../src/theme";

const themeModes: ThemeMode[] = ["system", "light", "dark"];

export default function ProfileSettingsScreen() {
  const { colors, mode, modeLoaded, modeError, setMode } = useMoveitTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  const signOut = () => {
    Alert.alert("Sign out of MOVEIT?", "Your saved profile and activity records will remain in your account.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          setSigningOut(true);
          setError("");
          void supabase?.auth.signOut()
            .then(({ error: signOutError }) => {
              if (signOutError) throw signOutError;
              router.replace("/auth");
            })
            .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "You could not be signed out."))
            .finally(() => setSigningOut(false));
        },
      },
    ]);
  };

  return (
    <Page>
      <Header eyebrow="PROFILE · PREFERENCES" title="Settings." action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} />
      <View style={{ gap: 10 }}>
        <SectionTitle title="Appearance" />
        <Card style={{ gap: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Choose a theme for MOVEIT. Your choice is saved on this device.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {themeModes.map((item) => (
              <Pill key={item} label={`${item[0]?.toUpperCase()}${item.slice(1)}`} selected={mode === item} onPress={() => setMode(item)} />
            ))}
          </View>
          {!modeLoaded ? <Text style={{ color: colors.muted, fontSize: 10 }}>Loading saved preference…</Text> : null}
          {modeError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 11 }}>{modeError}</Text> : null}
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Profile and privacy" />
        <Card style={{ gap: 10 }}>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Update your public profile, sports, goals, visibility and location preferences. Fitness records remain private to your account.</Text>
          <Button label="Edit profile and privacy" icon="user" variant="secondary" onPress={() => router.push("/profile/edit")} />
          <Button label="Switch or add a profile" icon="repeat" variant="secondary" onPress={() => router.push("/role-selection")} />
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Account" />
        <Card style={{ gap: 10 }}>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Signing out does not delete your data. Account deletion is not offered in this app yet; no reset or deletion action is performed here.</Text>
          {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
          <Button label={signingOut ? "Signing out…" : "Sign out"} icon="log-out" variant="secondary" disabled={signingOut} onPress={signOut} />
        </Card>
      </View>
    </Page>
  );
}
