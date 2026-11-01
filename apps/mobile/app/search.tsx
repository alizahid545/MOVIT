import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  sportsCatalogue,
  type ActivityRecord,
  type DiscoveredAthlete,
  type SportSkillLevel,
} from "@moveit/shared";
import {
  createCommunityPlatformRepository,
  createDirectoryRepository,
  type CoachListing,
  type VenueListing,
} from "@moveit/supabase";
import { Button, Card, Header, Icon, Page, Pill, SectionTitle } from "../src/components/ui";
import { UniversalSearchBar } from "../src/components/universal-search-bar";
import { supabase } from "../src/supabase";
import { searchSports } from "../src/sports-catalogue";
import { useMoveitTheme } from "../src/theme";

type SearchCategory = "all" | "players" | "sports" | "events" | "venues" | "coaches";
const categories: Array<{ id: SearchCategory; label: string }> = [
  { id: "all", label: "All" },
  { id: "players", label: "Athletes" },
  { id: "sports", label: "Sports" },
  { id: "events", label: "Activities" },
  { id: "venues", label: "Venues & gyms" },
  { id: "coaches", label: "Coaches" },
];
const skillLevels: SportSkillLevel[] = ["beginner", "intermediate", "advanced", "professional"];
const suggestions = ["basketball", "football", "personal trainer", "courts"];

export default function UniversalSearchScreen() {
  const { colors } = useMoveitTheme();
  const params = useLocalSearchParams<{ q?: string }>();
  const initialQuery = typeof params.q === "string" ? params.q : "";
  const [text, setText] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);
  const [category, setCategory] = useState<SearchCategory>("all");
  const [sportId, setSportId] = useState("");
  const [city, setCity] = useState("");
  const [skill, setSkill] = useState<SportSkillLevel | "">("");
  const [athletes, setAthletes] = useState<DiscoveredAthlete[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [venues, setVenues] = useState<VenueListing[]>([]);
  const [coaches, setCoaches] = useState<CoachListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sports = useMemo(() => submittedQuery.trim() ? searchSports(submittedQuery) : sportsCatalogue, [submittedQuery]);

  const submit = useCallback(async (value: string, selectedCategory: SearchCategory = category) => {
    const query = value.trim();
    setText(value);
    setSubmittedQuery(query);
    setError("");
    setAthletes([]);
    setActivities([]);
    setVenues([]);
    setCoaches([]);

    if (selectedCategory === "sports") return;
    if (!supabase) {
      setError("Sign in and configure Supabase to search live athletes, activities, venues, and coaches.");
      return;
    }

    setLoading(true);
    try {
      const filters = {
        query,
        city,
        sportId: sportId || undefined,
        requiredSkillLevel: skill || undefined,
        limit: 20,
        offset: 0,
      };
      const requests: Array<Promise<void>> = [];
      if (selectedCategory === "all" || selectedCategory === "players") {
        requests.push(createCommunityPlatformRepository(supabase).discoverAthletes(filters).then(setAthletes));
      }
      if (selectedCategory === "all" || selectedCategory === "events") {
        requests.push(createCommunityPlatformRepository(supabase).discoverActivities(filters).then(setActivities));
      }
      if (selectedCategory === "all" || selectedCategory === "venues") {
        requests.push(createDirectoryRepository(supabase).discoverVenues({
          query,
          city,
          sportId: sportId || undefined,
          limit: 20,
          offset: 0,
        }).then(setVenues));
      }
      if (selectedCategory === "all" || selectedCategory === "coaches") {
        requests.push(createDirectoryRepository(supabase).discoverCoaches({
          query,
          city,
          sportId: sportId || undefined,
          limit: 20,
          offset: 0,
        }).then(setCoaches));
      }
      await Promise.all(requests);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Live search could not be completed.");
    } finally {
      setLoading(false);
    }
  }, [category, city, sportId, skill]);

  useEffect(() => {
    if (initialQuery) void submit(initialQuery);
  }, [initialQuery, submit]);

  const hasSubmitted = submittedQuery.trim().length > 0;
  const noResults = !athletes.length && !activities.length && !venues.length && !coaches.length
    && (category === "sports" || hasSubmitted);

  return (
    <Page>
      <Header eyebrow="MOVEIT · LIVE SEARCH" title="Find your next move." action={<Button label="Close" variant="quiet" onPress={() => router.back()} />} />
      <UniversalSearchBar
        value={text}
        onChangeText={setText}
        onSubmit={submit}
        accessibilityLabel="Search athletes, sports, activities, venues, gyms and coaches"
      />
      <Button label="Search" icon="search" variant="secondary" disabled={loading} onPress={() => void submit(text)} />

      <View style={{ gap: 10 }}>
        <SectionTitle title="Search across" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {categories.map((item) => <Pill key={item.id} label={item.label} selected={category === item.id} onPress={() => {
            setCategory(item.id);
            if (submittedQuery) void submit(text, item.id);
            else {
              setAthletes([]);
              setActivities([]);
              setVenues([]);
              setCoaches([]);
              setError("");
            }
          }} />)}
        </View>
      </View>
      {category !== "sports" ? (
        <View style={{ gap: 10 }}>
          <SectionTitle title="Filters" />
          <TextInput accessibilityLabel="Filter by city or area" value={city} onChangeText={setCity} placeholder="City or area" placeholderTextColor={colors.muted} style={inputStyle(colors)} />
          <TextInput
            accessibilityLabel="Filter by sport"
            value={sportId}
            onChangeText={(value) => setSportId(value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            placeholder="Sport catalogue ID · e.g. football"
            placeholderTextColor={colors.muted}
            style={inputStyle(colors)}
          />
          {(category === "all" || category === "players" || category === "events") ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Pill label="Any skill" selected={!skill} onPress={() => setSkill("")} />
              {skillLevels.map((level) => <Pill key={level} label={level} selected={skill === level} onPress={() => setSkill(level)} />)}
            </View>
          ) : null}
          <Text style={{ color: colors.muted, fontSize: 10 }}>Skill filtering applies to activities and athletes; the backend currently has no separate activity-type field.</Text>
        </View>
      ) : null}

      {!hasSubmitted && category !== "sports" ? (
        <View style={{ gap: 10 }}>
          <SectionTitle title="Try a search" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {suggestions.map((suggestion) => <Pill key={suggestion} label={suggestion} onPress={() => void submit(suggestion)} />)}
          </View>
          <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>Live searches use MOVEIT records. Sports are read from the shared catalogue. Local preview data is never mixed into these results.</Text>
        </View>
      ) : null}

      {category === "sports" ? (
        <View style={{ gap: 12 }}>
          <SectionTitle title={hasSubmitted ? `Sports matching “${submittedQuery}”` : "Browse the sports catalogue"} />
          <View style={{ gap: 8 }}>
            {sports.slice(0, 60).map((sport) => (
              <Card key={sport.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name="activity" size={17} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{sport.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 10 }}>{sport.category}</Text>
                </View>
              </Card>
            ))}
          </View>
          {hasSubmitted && sports.length === 0 ? (
            <Card>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>No sports match this search</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Try a catalogue name or alias.</Text>
            </Card>
          ) : null}
        </View>
      ) : hasSubmitted ? (
        <View style={{ gap: 12 }}>
          <SectionTitle title={`Live results for “${submittedQuery}”`} />
          {loading ? <ActivityIndicator accessibilityLabel="Searching live MOVEIT records" color={colors.accent} /> : null}
          {error ? <Card><Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}>{error}</Text></Card> : null}

          {athletes.length ? <ResultSection title="Athletes" icon="users">{athletes.map((athlete) => (
            <ResultRow key={athlete.id} title={athlete.display_name || `@${athlete.username}`} detail={`${athlete.username} · ${athlete.city}`} onPress={() => router.push({ pathname: "/players/[id]", params: { id: athlete.id } })} />
          ))}</ResultSection> : null}
          {activities.length ? <ResultSection title="Activities" icon="activity">{activities.map((activity) => (
            <ResultRow key={activity.id} title={activity.title} detail={`${activity.city} · ${new Date(activity.startsAt).toLocaleString()} · ${activity.participantCount}/${activity.capacity}`} onPress={() => router.push({ pathname: "/activities/[id]", params: { id: activity.id } })} />
          ))}</ResultSection> : null}
          {venues.length ? <ResultSection title="Venues & gyms" icon="map-pin">{venues.map((venue) => (
            <View key={venue.id} style={{ gap: 4 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{venue.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{venue.businessName} · {[venue.area, venue.city].filter(Boolean).join(", ")}</Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>Owner-listed · not independently verified</Text>
            </View>
          ))}</ResultSection> : null}
          {coaches.length ? <ResultSection title="Coaches" icon="user-check">{coaches.map((coach) => (
            <View key={coach.userId} style={{ gap: 4 }}>
              <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{coach.displayName || `@${coach.username}`}</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>{coach.headline} · {[coach.area, coach.city].filter(Boolean).join(", ")}</Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>Self-published · credentials not verified</Text>
            </View>
          ))}</ResultSection> : null}
          {!loading && !error && noResults ? (
            <Card>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>No matching live results</Text>
              <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Try another search or remove a filter. This does not imply there are no real-world players, activities, venues, or coaches nearby.</Text>
            </Card>
          ) : null}
        </View>
      ) : null}
    </Page>
  );
}

function ResultSection({ title, icon, children }: { title: string; icon: "users" | "activity" | "map-pin" | "user-check"; children: ReactNode }) {
  const { colors } = useMoveitTheme();
  return (
    <View style={{ gap: 8 }}>
      <SectionTitle title={title} />
      <Card style={{ gap: 12 }}>
        <Icon name={icon} size={17} color={colors.accent} />
        {children}
      </Card>
    </View>
  );
}

function ResultRow({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  const { colors } = useMoveitTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 48, justifyContent: "center", gap: 3 }}>
      <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{title}</Text>
      <Text style={{ color: colors.muted, fontSize: 10 }}>{detail}</Text>
    </Pressable>
  );
}

function inputStyle(colors: ReturnType<typeof useMoveitTheme>["colors"]) {
  return {
    minHeight: 46,
    color: colors.text,
    backgroundColor: colors.field,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
  } as const;
}
