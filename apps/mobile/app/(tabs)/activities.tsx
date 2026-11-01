import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { sportsCatalogue, type ActivityRecord } from "@moveit/shared";
import { createCommunityPlatformRepository } from "@moveit/supabase";
import { Button, Card, Header, Page, Pill, SectionTitle } from "../../src/components/ui";
import { supabase } from "../../src/supabase";
import { useMoveitTheme } from "../../src/theme";

export default function ActivitiesTab() {
  const { colors } = useMoveitTheme();
  const [sportId, setSportId] = useState("");
  const [city, setCity] = useState("");
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const filtersRef = useRef({ city, sportId });
  filtersRef.current = { city, sportId };

  const load = useCallback(async () => {
    setError("");
    if (!supabase) {
      setActivities([]);
      setError("Sign in and configure Supabase to browse published activities.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setActivities(await createCommunityPlatformRepository(supabase).discoverActivities({
        city: filtersRef.current.city.trim() || undefined,
        sportId: filtersRef.current.sportId || undefined,
        limit: 50,
        offset: 0,
      }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Activities could not be loaded.");
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <Page refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.accent} />}>
      <Header eyebrow="MAKE PLANS · SHOW UP" title="Activities." action={<Button label="Create" icon="plus" onPress={() => router.push("/(tabs)/create")} />} />
      <View style={{ gap: 10 }}>
        <TextInput
          accessibilityLabel="Filter activities by city"
          value={city}
          onChangeText={setCity}
          onSubmitEditing={() => void load()}
          returnKeyType="search"
          placeholder="City or area"
          placeholderTextColor={colors.muted}
          style={inputStyle(colors)}
        />
        <SectionTitle title="Sport" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pill label="All sports" selected={!sportId} onPress={() => setSportId("")} />
          {sportsCatalogue.filter((sport) => sport.popular).slice(0, 12).map((sport) => (
            <Pill key={sport.id} label={sport.name} selected={sport.id === sportId} onPress={() => setSportId((current) => current === sport.id ? "" : sport.id)} />
          ))}
        </View>
        <Button label="Search activities" icon="search" variant="secondary" onPress={() => void load()} />
      </View>
      {error ? (
        <Card style={{ gap: 10 }}>
          <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}>{error}</Text>
          {error.includes("Sign in") ? <Button label="Sign in" onPress={() => router.push("/auth")} /> : <Button label="Try again" variant="secondary" onPress={() => void load()} />}
        </Card>
      ) : null}
      {loading ? <ActivityIndicator accessibilityLabel="Loading activities" color={colors.accent} /> : null}
      <View style={{ gap: 10 }}>
        <SectionTitle title="Upcoming public activities" />
        {activities.map((activity) => (
          <Card key={activity.id} style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{activity.title}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {sportsCatalogue.find((sport) => sport.id === activity.sportId)?.name ?? activity.sportId}
              {activity.requiredSkillLevel ? ` · ${activity.requiredSkillLevel}` : ""}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{activity.venueName} · {activity.city}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {new Date(activity.startsAt).toLocaleString()} · {activity.participantCount}/{activity.capacity} joined
            </Text>
            <Button
              label={activity.joinedByCurrentUser ? "View your activity" : "View activity"}
              variant="secondary"
              onPress={() => router.push({ pathname: "/activities/[id]", params: { id: activity.id } })}
            />
          </Card>
        ))}
        {!loading && !error && !activities.length ? (
          <Card>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>No activities match yet</Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Try another sport or city, or create a plan for your community.</Text>
            <Button label="Create an activity" icon="plus" onPress={() => router.push("/(tabs)/create")} />
          </Card>
        ) : null}
      </View>
    </Page>
  );
}

function inputStyle(colors: ReturnType<typeof useMoveitTheme>["colors"]) {
  return {
    minHeight: 48,
    color: colors.text,
    backgroundColor: colors.field,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
  } as const;
}
