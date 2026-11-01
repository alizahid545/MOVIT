import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ConnectionControls } from "../../src/components/connection-controls";
import { Button, Card, Header, Page, SportArtwork } from "../../src/components/ui";
import { loadPlayerDetail, type PlayerDetail } from "../../src/community-api";
import { useMoveitTheme } from "../../src/theme";

export default function PlayerProfileScreen() {
  const { colors } = useMoveitTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const playerId = Array.isArray(id) ? id[0] : id;
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  const refresh = useCallback(async () => {
    if (!playerId) {
      setUnavailable(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await loadPlayerDetail(playerId);
      setPlayer(result);
      setUnavailable(result === null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This profile could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Page>
      <Header
        eyebrow="PUBLIC PLAYER PROFILE"
        title="Player."
        action={
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Back</Text>
          </Pressable>
        }
      />
      {loading ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Loading player profile" style={{ alignItems: "center", padding: 24 }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <Card>
          <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}>{error}</Text>
          <Button label="Retry" variant="secondary" onPress={() => void refresh()} />
          <Button label="Sign in" onPress={() => router.push("/auth")} />
        </Card>
      ) : unavailable || !player ? (
        <Card>
          <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 17, fontWeight: "800" }}>Profile unavailable</Text>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            This profile may be private, deleted, or no longer available.
          </Text>
          <Button label="Back to community" onPress={() => router.replace("/(tabs)/community")} />
        </Card>
      ) : (
        <Card>
          <View style={{ alignItems: "center", gap: 12, paddingVertical: 8 }}>
            <SportArtwork glyph={(player.display_name.trim() || player.username).charAt(0).toUpperCase()} size={76} />
            <View style={{ alignItems: "center", gap: 5 }}>
              <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 21, fontWeight: "800" }}>
                {player.display_name.trim() || `@${player.username}`}
              </Text>
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "600" }}>@{player.username}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{player.city}</Text>
            </View>
          </View>
          {player.bio ? (
            <Text style={{ color: colors.text, fontSize: 13, lineHeight: 20 }}>{player.bio}</Text>
          ) : (
            <Text style={{ color: colors.muted, fontSize: 12 }}>This player hasn’t added a bio yet.</Text>
          )}
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <ConnectionControls playerId={player.id} connection={player.connection} onChanged={refresh} />
          <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 16 }}>
            Only public profile details are shown. Connection requests stay pending until the other player responds.
          </Text>
        </Card>
      )}
    </Page>
  );
}
