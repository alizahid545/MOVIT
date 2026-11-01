import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { createCommunityPlatformRepository, type PlatformNotification } from "@moveit/supabase";
import { Button, Card, Header, Icon, Page } from "../src/components/ui";
import { supabase } from "../src/supabase";
import { useMoveitTheme } from "../src/theme";

const descriptions: Record<PlatformNotification["type"], string> = {
  post_like: "liked your post",
  post_comment: "commented on your post",
  new_follower: "started following you",
  connection_request: "sent you a connection request",
  connection_accepted: "accepted your connection request",
  venue_inquiry: "sent an inquiry about your venue",
  coach_inquiry: "sent a coaching inquiry",
};

export default function NotificationsScreen() {
  const { colors } = useMoveitTheme();
  const [notifications, setNotifications] = useState<PlatformNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setError("Sign in to view your account notifications.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await createCommunityPlatformRepository(supabase).loadNotifications(50);
      setNotifications(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Notifications could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markRead = async (item: PlatformNotification) => {
    if (!supabase || item.readAt) return;
    try {
      await createCommunityPlatformRepository(supabase).markNotificationRead(item.id);
      setNotifications((current) => current.map((notification) =>
        notification.id === item.id ? { ...notification, readAt: new Date().toISOString() } : notification,
      ));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The notification could not be marked as read.");
    }
  };

  return (
    <Page>
      <Header
        eyebrow="ACTIVITY"
        title="Notifications."
        action={<Button label="Back" variant="quiet" onPress={() => router.back()} />}
      />
      {loading ? (
        <View accessibilityRole="progressbar" style={{ alignItems: "center", padding: 28 }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}
      {error ? (
        <Card style={{ gap: 10 }}>
          <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}>{error}</Text>
          <Button label="Try again" variant="secondary" onPress={() => void load()} />
        </Card>
      ) : null}
      {!loading && !error && !notifications.length ? (
        <View style={{ alignItems: "center", paddingTop: 26, gap: 14 }}>
          <View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.surfaceAlt, alignItems: "center", justifyContent: "center" }}>
            <Icon name="bell" size={23} color={colors.accent} />
          </View>
          <Card>
            <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" }}>You’re all caught up</Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19, textAlign: "center" }}>
              Likes, comments, follows, connections and directory inquiries appear here when other MOVEIT players interact with your account.
            </Text>
          </Card>
        </View>
      ) : null}
      {notifications.map((item) => {
        const name = item.actor?.display_name || (item.actor?.username ? `@${item.actor.username}` : "A MOVEIT player");
        return (
          <Pressable key={item.id} accessibilityRole="button" onPress={() => void markRead(item)}>
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, borderColor: item.readAt ? colors.border : colors.accent }}>
              <Icon
                name={item.type === "new_follower" || item.type === "connection_request" || item.type === "connection_accepted"
                  ? "user-plus"
                  : item.type === "post_like" ? "heart" : "message-circle"}
                color={colors.accent}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.text, fontSize: 12, fontWeight: item.readAt ? "500" : "700" }}>{name} {descriptions[item.type]}.</Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>{new Date(item.createdAt).toLocaleString()}</Text>
              </View>
              {!item.readAt ? <View accessibilityLabel="Unread" style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} /> : null}
            </Card>
          </Pressable>
        );
      })}
      <Button label="Explore community" icon="users" variant="secondary" onPress={() => router.navigate("/(tabs)/community")} />
    </Page>
  );
}
