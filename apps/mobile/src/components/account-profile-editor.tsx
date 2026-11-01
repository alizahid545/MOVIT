import { useCallback, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import type { AthleteProfile as CanonicalAthleteProfile } from "@moveit/shared";
import { AthleteProfile, loadMyAthleteProfile } from "../athlete-profile-api";
import { useMoveitTheme } from "../theme";
import { Button, Card, Header, Icon, Page } from "./ui";
import { PersonalInformationForm } from "./personal-information-form";
import { SportsPreferencesForm } from "./sports-preferences-form";
import { AthletePreferencesForm } from "./athlete-preferences-form";

export function AccountProfileEditor() {
  const { colors } = useMoveitTheme();
  const [profile, setProfile] = useState<AthleteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const saved = await loadMyAthleteProfile();
      setProfile(saved);
    } catch (caught) {
      setProfile(null);
      setError(caught instanceof Error ? caught.message : "Your profile could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const syncPersonalInformation = (saved: CanonicalAthleteProfile | null) => {
    if (!saved) return;
    setProfile((current) => current ? {
      ...current,
      username: saved.username,
      display_name: saved.displayName,
      bio: saved.bio,
      city: saved.city,
    } : current);
  };

  return (
    <Page>
      <Header
        eyebrow="YOUR ACCOUNT · SUPABASE"
        title="Athlete profile."
        action={<Button label="Back" variant="quiet" onPress={() => router.back()} />}
      />

      {loading ? (
        <View accessibilityRole="progressbar" style={{ alignItems: "center", gap: 10, padding: 28 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>Loading your saved profile…</Text>
        </View>
      ) : profile ? (
        <>
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Icon name="user" size={20} color={colors.accent} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{profile.display_name || "Your athlete profile"}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>@{profile.username} · {profile.visibility} profile</Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>Account profile · changes save to Supabase</Text>
              </View>
            </View>
          </Card>

          <PersonalInformationForm onSaved={syncPersonalInformation} />

          <SportsPreferencesForm />
          <AthletePreferencesForm />

          {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}>{error}</Text> : null}
        </>
      ) : (
        <Card style={{ gap: 12 }}>
          <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13, lineHeight: 19 }}>{error}</Text>
          <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
            The profile screen only reads and updates the signed-in account. Local demo profile data is kept separate.
          </Text>
          <Button label="Try again" variant="secondary" onPress={() => void refresh()} />
        </Card>
      )}
    </Page>
  );
}
