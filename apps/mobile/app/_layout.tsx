import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useMoveitTheme } from "../src/theme";
import { hydrateChallengePreview } from "../src/challenge-preview";
import { hydrateDevelopmentProfile } from "../src/development-profile";
import { hydrateDevelopmentActivities } from "../src/development-activity-preview";
import { hydrateProfileSocialPreview } from "../src/profile-social-preview";
import { getDevelopmentStorageStatus, subscribeDevelopmentStorageStatus } from "../src/local-development-repository";
import { hydrateVenuePreview } from "../src/venue-preview";
import { hydrateLocalCommunityRepository } from "../src/local-community-repository";
import { hydrateRewardsRepository } from "../src/rewards";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppNavigator() {
  const { colors, isDark } = useMoveitTheme();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [storageError, setStorageError] = useState(getDevelopmentStorageStatus().error);

  const initialize = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      await Promise.all([
        hydrateChallengePreview(),
        hydrateDevelopmentProfile(),
        hydrateDevelopmentActivities(),
        hydrateProfileSocialPreview(),
        hydrateVenuePreview(),
        hydrateLocalCommunityRepository(),
        hydrateRewardsRepository(),
      ]);
      setReady(true);
    } catch (caught) {
      setLoadError(caught instanceof Error ? caught.message : "Local development data could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => subscribeDevelopmentStorageStatus(() => {
    setStorageError(getDevelopmentStorageStatus().error);
  }), []);

  if (loading || !ready) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24, backgroundColor: colors.canvas }}>
        {loading ? <ActivityIndicator color={colors.accent} /> : null}
        <Text accessibilityRole={loadError ? "alert" : undefined} style={{ color: loadError ? colors.danger : colors.muted, fontSize: 13, textAlign: "center" }}>
          {loading ? "Loading saved local development data…" : loadError}
        </Text>
        {!loading ? (
          <Pressable accessibilityRole="button" onPress={() => void initialize()} style={{ minHeight: 48, justifyContent: "center", paddingHorizontal: 18 }}>
            <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "600" }}>Try again</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {storageError ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger, backgroundColor: colors.surfaceAlt, padding: 10, fontSize: 11 }}>
          Local demo changes may not persist: {storageError}
        </Text>
      ) : null}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
        }}
      />
    </View>
  );
}
