import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { athleteFitnessGoalOptions, type ActivityRecord, type AthleteProfile, type SportPreference } from "@moveit/shared";
import { createAthleteProfileRepository } from "@moveit/supabase";
import { createCommunityPlatformRepository, type MySocialSummary, type PlatformNotification } from "@moveit/supabase";
import { loadFitnessData } from "../../src/fitness-api";
import { Button, Card, Header, IconButton, Page, SectionTitle } from "../../src/components/ui";
import { supabase } from "../../src/supabase";
import { useMoveitTheme } from "../../src/theme";

type DashboardData = {
  profile: AthleteProfile;
  sports: SportPreference[];
  fitnessGoals: string[];
  activities: ActivityRecord[];
  workoutsThisWeek: number;
  workoutMinutesThisWeek: number;
  social: MySocialSummary;
  recentNotifications: PlatformNotification[];
};

export default function HomeScreen() {
  const { colors } = useMoveitTheme();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) {
      setError("Sign in to see your MOVEIT dashboard.");
      setData(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) {
        setData(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const profileRepository = createAthleteProfileRepository(supabase);
      const platform = createCommunityPlatformRepository(supabase);
      const [profile, sports, preferences, activities, fitness, social, recentNotifications] = await Promise.all([
        profileRepository.loadMyProfile(),
        profileRepository.loadMySportPreferences(),
        profileRepository.loadMyAthletePreferences(),
        platform.loadMyActivities(),
        loadFitnessData(),
        platform.loadMySocialSummary(),
        platform.loadNotifications(5),
      ]);
      setData({
        profile,
        sports,
        fitnessGoals: preferences.fitnessGoals,
        activities,
        workoutsThisWeek: fitness.summaryWorkouts.length,
        workoutMinutesThisWeek: fitness.summaryWorkouts.reduce((total, workout) => total + workout.duration_minutes, 0),
        social,
        recentNotifications,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your MOVEIT dashboard could not be loaded.");
      setData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const upcoming = (data?.activities ?? [])
    .filter((activity) => activity.status === "published" && Date.parse(activity.startsAt) >= Date.now())
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  const history = (data?.activities ?? [])
    .filter((activity) => activity.status === "cancelled" || Date.parse(activity.startsAt) < Date.now())
    .slice(0, 5);

  return (
    <Page refreshControl={
      <RefreshControl
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); void load(); }}
        tintColor={colors.accent}
        colors={[colors.accent]}
        progressBackgroundColor={colors.surface}
      />
    }>
      <Header
        eyebrow="MOVEIT · YOUR SPORTS LIFE"
        title="Your dashboard."
        action={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <IconButton
              name="bell"
              label={`Open notifications${data?.social.unreadNotifications ? `, ${data.social.unreadNotifications} unread` : ""}`}
              onPress={() => router.push("/notifications")}
            />
            <IconButton name="user" label="Open your profile" onPress={() => router.navigate("/(tabs)/profile")} />
          </View>
        }
      />

      {loading ? (
        <View accessibilityRole="progressbar" style={{ alignItems: "center", padding: 28, gap: 10 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted }}>Loading your saved MOVEIT data…</Text>
        </View>
      ) : null}
      {error ? (
        <Card style={{ gap: 10 }}>
          <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}>{error}</Text>
          <Button label="Try again" variant="secondary" onPress={() => void load()} />
        </Card>
      ) : null}
      {!loading && !error && !data ? (
        <Card style={{ gap: 10 }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>Your account is ready when you are.</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Sign in to see your activities, sports and personal fitness history.</Text>
          <Button label="Sign in" onPress={() => router.push("/auth")} />
        </Card>
      ) : null}
      {data ? (
        <>
          <Card style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {data.profile.avatarPublicUrl
                ? <Image accessibilityLabel="Your profile photo" source={{ uri: data.profile.avatarPublicUrl }} style={{ width: 54, height: 54, borderRadius: 27 }} />
                : <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: colors.softGreen, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ color: colors.accent, fontSize: 18, fontWeight: "800" }}>{data.profile.displayName.charAt(0).toUpperCase()}</Text>
                </View>}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>{data.profile.displayName}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>@{data.profile.username} · {data.profile.city}</Text>
              </View>
            </View>
            {data.profile.bio ? <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{data.profile.bio}</Text> : null}
            <Button label="Edit profile" variant="secondary" onPress={() => router.navigate("/(tabs)/profile")} />
          </Card>

          <Card style={{ gap: 10 }}>
            <SectionTitle title="Your sports" action="Edit" onAction={() => router.navigate("/(tabs)/profile")} />
            {data.sports.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {data.sports.map((sport) => (
                  <View key={sport.sportId} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 8 }}>
                    <Text style={{ color: colors.text, fontSize: 11 }}>
                      {sportName(sport.sportId)} · {sport.skillLevel ?? "skill not set"}{sport.isPreferred ? " · favourite" : ""}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 12 }}>No sports saved yet. Add sports and skill levels to improve activity matching.</Text>
            )}
          </Card>

          <Card style={{ gap: 10 }}>
            <SectionTitle title="Fitness goals" />
            {data.fitnessGoals.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {data.fitnessGoals.map((goal) => (
                  <Text key={goal} style={{ color: colors.text, backgroundColor: colors.surfaceAlt, borderRadius: 99, paddingHorizontal: 11, paddingVertical: 8, fontSize: 11 }}>
                    {athleteFitnessGoalOptions.find((option) => option.value === goal)?.label ?? goal}
                  </Text>
                ))}
              </View>
            ) : <Text style={{ color: colors.muted, fontSize: 12 }}>No fitness goals saved.</Text>}
          </Card>

          <Card style={{ gap: 12 }}>
            <SectionTitle title="This week" />
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>
              {data.workoutsThisWeek} saved {data.workoutsThisWeek === 1 ? "workout" : "workouts"} · {data.workoutMinutesThisWeek} minutes
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>From your private fitness tracker for the last seven days.</Text>
            <Button label="Open fitness tracker" icon="activity" variant="secondary" onPress={() => router.push("/fitness")} />
          </Card>

          <View style={{ gap: 12 }}>
            <SectionTitle title="Your upcoming activities" action="Discover" onAction={() => router.navigate("/(tabs)/discover")} />
            {upcoming.slice(0, 5).map((activity) => (
              <ActivitySummary key={activity.id} activity={activity} />
            ))}
            {!upcoming.length ? (
              <Card style={{ gap: 10 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>No upcoming activities saved. Find a game or organize one yourself.</Text>
                <Button label="Discover activities" variant="secondary" onPress={() => router.navigate("/(tabs)/discover")} />
                <Button label="Create activity" onPress={() => router.navigate("/(tabs)/create")} />
              </Card>
            ) : null}
          </View>

          <View style={{ gap: 12 }}>
            <SectionTitle title="Recent activity history" />
            {history.map((activity) => <ActivitySummary key={activity.id} activity={activity} />)}
            {!history.length ? <Text style={{ color: colors.muted, fontSize: 12 }}>Your past activity history will appear here.</Text> : null}
          </View>

          <Card style={{ gap: 10 }}>
            <SectionTitle title="Community" />
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {data.social.unreadNotifications
                ? `${data.social.unreadNotifications} unread notification${data.social.unreadNotifications === 1 ? "" : "s"}`
                : "No unread notifications"}
            </Text>
            <Text style={{ color: colors.text, fontSize: 12 }}>
              {data.social.followers} followers · following {data.social.following} · {data.social.connections} connections · {data.social.posts} posts
            </Text>
            <Button label="Open community" icon="users" variant="secondary" onPress={() => router.navigate("/(tabs)/community")} />
            <Button label="View notifications" icon="bell" variant="secondary" onPress={() => router.push("/notifications")} />
            {data.recentNotifications.slice(0, 3).map((notification) => (
              <Text key={notification.id} style={{ color: colors.muted, fontSize: 11 }}>
                {notification.actor?.display_name ?? "A MOVEIT player"} · {notification.type.replaceAll("_", " ")}
              </Text>
            ))}
          </Card>
        </>
      ) : null}
    </Page>
  );
}

function ActivitySummary({ activity }: { activity: ActivityRecord }) {
  const { colors } = useMoveitTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`View ${activity.title}`}
      onPress={() => router.push({ pathname: "/activities/[id]", params: { id: activity.id } })}
    >
      <Card style={{ gap: 5 }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{activity.title}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{sportName(activity.sportId)} · {activity.city} · {activity.status}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{new Date(activity.startsAt).toLocaleString()}</Text>
      </Card>
    </Pressable>
  );
}

function sportName(id: string) {
  return id.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
