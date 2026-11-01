import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  searchSports,
  sportsCatalogue,
  type ActivityRecord,
  type DiscoveredAthlete,
  type SportSkillLevel,
} from "@moveit/shared";
import { createCommunityPlatformRepository } from "@moveit/supabase";
import { Button, Card, Header, Icon, Page, Pill, SectionTitle } from "../../src/components/ui";
import { supabase } from "../../src/supabase";
import { useMoveitTheme } from "../../src/theme";

type DiscoverKind = "activities" | "athletes" | "sports" | "venues" | "coaches";
const PAGE_SIZE = 20;
const kinds: { id: DiscoverKind; label: string }[] = [
  { id: "activities", label: "Activities" },
  { id: "athletes", label: "Athletes" },
  { id: "sports", label: "Sports" },
  { id: "venues", label: "Venues" },
  { id: "coaches", label: "Coaches" },
];
const skillLevels: { value: SportSkillLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "professional", label: "Professional" },
];

export default function DiscoverScreen() {
  const { colors } = useMoveitTheme();
  const params = useLocalSearchParams<{ sport?: string }>();
  const [kind, setKind] = useState<DiscoverKind>("activities");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [sportId, setSportId] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [athletes, setAthletes] = useState<DiscoveredAthlete[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [sportsQuery, setSportsQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyFollowId, setBusyFollowId] = useState("");
  const filtersRef = useRef({ query, city, sportId, skillLevel, kind });
  filtersRef.current = { query, city, sportId, skillLevel, kind };

  const refresh = useCallback(async (nextOffset = 0, append = false) => {
    if (!supabase) {
      setError("Sign in to discover real MOVEIT members and activities.");
      setAthletes([]);
      setActivities([]);
      return;
    }
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const repository = createCommunityPlatformRepository(supabase);
      const currentFilters = filtersRef.current;
      const filters = {
        query: currentFilters.query.trim() || undefined,
        city: currentFilters.city.trim() || undefined,
        sportId: currentFilters.sportId || undefined,
        requiredSkillLevel: currentFilters.skillLevel ? currentFilters.skillLevel as SportSkillLevel : undefined,
        limit: PAGE_SIZE,
        offset: nextOffset,
      };
      if (filtersRef.current.kind === "athletes") {
        const results = await repository.discoverAthletes(filters);
        const currentFollowed = await repository.loadFollowedPlayerIds(results.map(({ id }) => id));
        if (append) {
          setAthletes((current) => {
            const ids = new Set(current.map(({ id }) => id));
            return [...current, ...results.filter(({ id }) => !ids.has(id))];
          });
        } else {
          setAthletes(results);
        }
        setFollowedIds((current) => {
          const next = new Set(append ? current : []);
          currentFollowed.forEach((id) => next.add(id));
          return next;
        });
        setHasMore(results.length === PAGE_SIZE);
      } else {
        const results = await repository.discoverActivities(filters);
        if (append) {
          setActivities((current) => {
            const ids = new Set(current.map(({ id }) => id));
            return [...current, ...results.filter(({ id }) => !ids.has(id))];
          });
        } else {
          setActivities(results);
        }
        setHasMore(results.length === PAGE_SIZE);
      }
      setOffset(nextOffset);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Discovery results could not be loaded.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (params.sport) {
      const sport = sportsCatalogue.find((item) => item.name.toLowerCase() === params.sport?.toLowerCase());
      if (sport) {
        filtersRef.current = { ...filtersRef.current, sportId: sport.id, kind: "activities" };
        setSportId(sport.id);
        setKind("activities");
      }
    }
    void refresh();
  }, [params.sport, refresh]));

  const search = () => {
    void refresh(0, false);
  };

  const selectKind = (nextKind: DiscoverKind) => {
    filtersRef.current = { ...filtersRef.current, kind: nextKind };
    setKind(nextKind);
    setError("");
    if (nextKind === "athletes" || nextKind === "activities") void refresh(0, false);
  };

  const toggleFollow = async (athlete: DiscoveredAthlete) => {
    if (!supabase) return;
    setBusyFollowId(athlete.id);
    setActionError("");
    try {
      const repository = createCommunityPlatformRepository(supabase);
      if (followedIds.has(athlete.id)) {
        await repository.unfollowPlayer(athlete.id);
        setFollowedIds((current) => {
          const next = new Set(current);
          next.delete(athlete.id);
          return next;
        });
      } else {
        await repository.followPlayer(athlete.id);
        setFollowedIds((current) => new Set(current).add(athlete.id));
      }
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Follow change could not be saved.");
    } finally {
      setBusyFollowId("");
    }
  };

  const visibleSports = useMemo(() => searchSports(sportsQuery).slice(0, 30), [sportsQuery]);
  const onRefresh = () => {
    setRefreshing(true);
    void refresh(0, false);
  };

  return (
    <Page refreshControl={
      <RefreshControl
        refreshing={refreshing}
        onRefresh={onRefresh}
        tintColor={colors.accent}
        colors={[colors.accent]}
        progressBackgroundColor={colors.surface}
      />
    }>
      <Header eyebrow="REAL PEOPLE · REAL PLANS" title="Find your game." />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {kinds.map((item) => (
          <Pill key={item.id} label={item.label} selected={kind === item.id} onPress={() => selectKind(item.id)} />
        ))}
      </View>

      {kind === "sports" ? (
        <View style={{ gap: 12 }}>
          <TextInput
            accessibilityLabel="Search MOVEIT sports"
            value={sportsQuery}
            onChangeText={setSportsQuery}
            placeholder="Search sports"
            placeholderTextColor={colors.muted}
            style={inputStyle(colors)}
          />
          {visibleSports.map((sport) => (
            <Pressable
              key={sport.id}
              accessibilityRole="button"
              onPress={() => {
                filtersRef.current = { ...filtersRef.current, sportId: sport.id, query: "", kind: "activities" };
                setSportId(sport.id);
                setKind("activities");
                setQuery("");
                void refresh(0, false);
              }}
            >
              <Card style={{ gap: 4 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{sport.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{sport.category}</Text>
              </Card>
            </Pressable>
          ))}
          {!visibleSports.length ? <Empty message="No MOVEIT sports match that search." /> : null}
          <Text style={{ color: colors.muted, fontSize: 10 }}>
            MOVEIT’s sport catalogue · select a sport to find matching activities.
          </Text>
        </View>
      ) : kind === "venues" || kind === "coaches" ? (
        <Empty message={kind === "venues"
          ? "No verified venue directory is connected to the public backend yet. We are not showing demo listings as real venues."
          : "No verified coach directory is connected to the public backend yet. We are not showing demo listings as real coaches."} />
      ) : (
        <>
          <View style={{ gap: 10 }}>
            <TextInput
              accessibilityLabel={kind === "athletes" ? "Search athletes" : "Search activities"}
              value={query}
              onChangeText={setQuery}
              placeholder={kind === "athletes" ? "Name or username" : "Activity title"}
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              onSubmitEditing={search}
              style={inputStyle(colors)}
            />
            <TextInput
              accessibilityLabel="Filter by city or area"
              value={city}
              onChangeText={setCity}
              placeholder="City or area"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              onSubmitEditing={search}
              style={inputStyle(colors)}
            />
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Sport</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Pill label="All sports" selected={!sportId} onPress={() => setSportId("")} />
              {sportsCatalogue.filter((sport) => sport.popular).slice(0, 9).map((sport) => (
                <Pill
                  key={sport.id}
                  label={sport.name}
                  selected={sportId === sport.id}
                  onPress={() => setSportId((current) => current === sport.id ? "" : sport.id)}
                />
              ))}
            </View>
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Skill level</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Pill label="Any level" selected={!skillLevel} onPress={() => setSkillLevel("")} />
              {skillLevels.map((level) => (
                <Pill
                  key={level.value}
                  label={level.label}
                  selected={skillLevel === level.value}
                  onPress={() => setSkillLevel((current) => current === level.value ? "" : level.value)}
                />
              ))}
            </View>
            <Button label="Search" icon="search" onPress={search} />
          </View>

          {loading && !refreshing ? <Loading /> : null}
          {error ? (
            <Card style={{ gap: 10 }}>
              <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Text>
              <Button label="Try again" variant="secondary" onPress={() => void refresh()} />
            </Card>
          ) : null}
          {actionError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{actionError}</Text> : null}

          {!loading && !error && kind === "athletes" ? (
            <>
              <SectionTitle title="Athletes" />
              {athletes.map((athlete) => (
                <Card key={athlete.id} style={{ gap: 12 }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: "/players/[id]", params: { id: athlete.id } })}
                    style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                  >
                    {athlete.avatarPublicUrl
                      ? <Image accessibilityLabel={`${athlete.display_name} profile photo`} source={{ uri: athlete.avatarPublicUrl }} style={{ width: 48, height: 48, borderRadius: 24 }} />
                      : <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.softGreen, alignItems: "center", justifyContent: "center" }}>
                        <Text style={{ color: colors.accent, fontWeight: "700" }}>{athlete.display_name.charAt(0).toUpperCase()}</Text>
                      </View>}
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>{athlete.display_name || `@${athlete.username}`}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>@{athlete.username} · {athlete.city}</Text>
                      {athlete.bio ? <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11 }}>{athlete.bio}</Text> : null}
                    </View>
                    <Icon name="chevron-right" color={colors.muted} />
                  </Pressable>
                  <Button
                    label={busyFollowId === athlete.id ? "Saving…" : followedIds.has(athlete.id) ? "Following" : "Follow"}
                    variant={followedIds.has(athlete.id) ? "secondary" : "primary"}
                    disabled={busyFollowId === athlete.id}
                    onPress={() => void toggleFollow(athlete)}
                  />
                </Card>
              ))}
              {!athletes.length ? <Empty message="No public athletes match these filters. Try another city, sport, or search term." /> : null}
            </>
          ) : null}

          {!loading && !error && kind === "activities" ? (
            <>
              <SectionTitle title="Upcoming activities" />
              {activities.map((activity) => (
                <Pressable
                  key={activity.id}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${activity.title}`}
                  onPress={() => router.push({ pathname: "/activities/[id]", params: { id: activity.id } })}
                >
                  <Card style={{ gap: 6 }}>
                    <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{activity.title}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {sportsCatalogue.find((sport) => sport.id === activity.sportId)?.name ?? activity.sportId}
                      {activity.requiredSkillLevel ? ` · ${activity.requiredSkillLevel}` : ""}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{activity.venueName} · {activity.city}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {new Date(activity.startsAt).toLocaleString()} · {activity.participantCount}/{activity.capacity} participants
                    </Text>
                  </Card>
                </Pressable>
              ))}
              {!activities.length ? <Empty message="No upcoming public activities match these filters yet. Create one or try a broader search." /> : null}
            </>
          ) : null}

          {hasMore && !loading && !error ? (
            <Button
              label={loadingMore ? "Loading…" : "Load more"}
              variant="secondary"
              disabled={loadingMore}
              onPress={() => void refresh(offset + PAGE_SIZE, true)}
            />
          ) : null}
        </>
      )}
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

function Loading() {
  const { colors } = useMoveitTheme();
  return (
    <View accessibilityRole="progressbar" style={{ alignItems: "center", gap: 10, padding: 28 }}>
      <ActivityIndicator color={colors.accent} />
      <Text style={{ color: colors.muted }}>Searching real MOVEIT accounts…</Text>
    </View>
  );
}

function Empty({ message }: { message: string }) {
  const { colors } = useMoveitTheme();
  return (
    <Card>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 19 }}>{message}</Text>
    </Card>
  );
}
