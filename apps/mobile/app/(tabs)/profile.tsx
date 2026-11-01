import { useCallback, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import type { Workout } from "@moveit/shared";
import { getWeeklyWorkoutMinutes, getWorkoutPerformanceSummary } from "@moveit/shared";
import { Button, Card, Header, Icon, Page, Pill, SectionTitle } from "../../src/components/ui";
import { loadFitnessData } from "../../src/fitness-api";
import { getDevelopmentProfile, updateDevelopmentProfile } from "../../src/development-profile";
import { AccountProfileEditor } from "../../src/components/account-profile-editor";
import { type PreviewProfileVisibility } from "../../src/challenge-preview";
import { getPreviewProfileCounts, setPreviewOwnerVisibility } from "../../src/profile-social-preview";
import { searchSports, sportCategories, sportsCatalogue, toggleSportRole, type SportCategory, type SportInterest, type SportRole } from "../../src/sports-catalogue";
import { supabase } from "../../src/supabase";
import { useMoveitTheme, type ThemeMode } from "../../src/theme";

const appearanceModes: ThemeMode[] = ["system", "light", "dark"];
const sportRoles: { id: SportRole; label: string }[] = [
  { id: "playing", label: "Play" },
  { id: "following", label: "Follow" },
  { id: "coaching", label: "Coach" },
  { id: "organising", label: "Organise" },
];

export default function ProfileScreen() {
  const { colors, mode, setMode } = useMoveitTheme();
  const [accountSessionState, setAccountSessionState] = useState<"checking" | "signed-in" | "signed-out" | "error">(
    supabase ? "checking" : "signed-out",
  );
  const [accountSessionError, setAccountSessionError] = useState("");
  const savedProfile = getDevelopmentProfile();
  const [fitnessData, setFitnessData] = useState<Awaited<ReturnType<typeof loadFitnessData>> | null>(null);
  const [fitnessLoading, setFitnessLoading] = useState(true);
  const [fitnessError, setFitnessError] = useState("");
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(savedProfile.displayName);
  const [draftName, setDraftName] = useState(displayName);
  const [username, setUsername] = useState(savedProfile.username);
  const [draftUsername, setDraftUsername] = useState("");
  const [bio, setBio] = useState(savedProfile.bio);
  const [draftBio, setDraftBio] = useState("");
  const [city, setCity] = useState(savedProfile.city);
  const [draftCity, setDraftCity] = useState("");
  const [visibility, setVisibility] = useState<PreviewProfileVisibility>(savedProfile.visibility);
  const [skillLevels, setSkillLevels] = useState<Record<string, string>>(savedProfile.skillLevels);
  const [shownSections, setShownSections] = useState<string[]>(savedProfile.shownSections);
  const [, setSocialRevision] = useState(0);
  const [selectedInterests, setSelectedInterests] = useState<SportInterest[]>(savedProfile.selectedInterests);
  const [sportQuery, setSportQuery] = useState("");
  const [sportCategory, setSportCategory] = useState<SportCategory | "All categories">("All categories");
  const modeIndex = appearanceModes.indexOf(mode);
  const nextMode = appearanceModes[(modeIndex + 1) % appearanceModes.length];
  const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1);

  const refreshAccountSession = useCallback(async () => {
    if (!supabase) {
      setAccountSessionState("signed-out");
      return;
    }
    setAccountSessionState("checking");
    setAccountSessionError("");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      setAccountSessionState(data.session ? "signed-in" : "signed-out");
    } catch (caught) {
      setAccountSessionError(caught instanceof Error ? caught.message : "The account session could not be loaded.");
      setAccountSessionState("error");
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refreshAccountSession();
  }, [refreshAccountSession]));

  const matchingSports = searchSports(sportQuery, sportCategory === "All categories" ? undefined : sportCategory).slice(0, 12);
  const toggleInterest = (sportId: string, role: SportRole) => {
    const updated = toggleSportRole(selectedInterests, sportId, role);
    setSelectedInterests(updated);
    updateDevelopmentProfile({ selectedInterests: updated });
  };

  const saveDemoName = () => {
    const cleanedName = draftName.trim();
    if (cleanedName) {
      setDisplayName(cleanedName);
      setEditing(false);
    }
  };

  const refreshFitness = useCallback(async () => {
    setFitnessError("");
    try {
      setFitnessData(await loadFitnessData());
    } catch (caught) {
      setFitnessData(null);
      setFitnessError(caught instanceof Error ? caught.message : "Saved fitness data could not be loaded.");
    } finally {
      setFitnessLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (accountSessionState !== "signed-out") return;
    void refreshFitness();
    const saved = getDevelopmentProfile();
    setDisplayName(saved.displayName);
    setDraftName(saved.displayName);
    setUsername(saved.username);
    setDraftUsername(saved.username);
    setBio(saved.bio);
    setDraftBio(saved.bio);
    setCity(saved.city);
    setDraftCity(saved.city);
    setVisibility(saved.visibility);
    setSkillLevels(saved.skillLevels);
    setShownSections(saved.shownSections);
    setSelectedInterests(saved.selectedInterests);
    setSocialRevision((revision) => revision + 1);
  }, [accountSessionState, refreshFitness]));

  const performance = fitnessData ? getWorkoutPerformanceSummary(fitnessData.workouts) : null;
  const recentWeekMinutes = fitnessData
    ? getWeeklyWorkoutMinutes(fitnessData.summaryWorkouts).reduce((total, minutes) => total + minutes, 0)
    : 0;
  const socialCounts = getPreviewProfileCounts();

  if (accountSessionState === "checking") {
    return (
      <Page>
        <View accessibilityRole="progressbar" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>Checking your account session…</Text>
        </View>
      </Page>
    );
  }

  if (accountSessionState === "error") {
    return (
      <Page>
        <Header eyebrow="ACCOUNT PROFILE" title="Could not load session." />
        <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{accountSessionError}</Text>
        <Button label="Try again" variant="secondary" onPress={() => void refreshAccountSession()} />
      </Page>
    );
  }

  if (accountSessionState === "signed-in") return <AccountProfileEditor />;

  return (
    <Page>
      <Header
        eyebrow="LOCAL PREVIEW · NOT AN ACCOUNT"
        title="Your profile."
        action={<Button label="Switch / add profile" icon="repeat" variant="secondary" onPress={() => router.push("/role-selection")} />}
      />

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: 28, backgroundColor: colors.surfaceAlt }}>
            <Icon name="user" size={23} color={colors.muted} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>{displayName || "Preview athlete"}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{username ? `@${username}` : "Choose a preview username"}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{city || "City/area not set"} · No precise location is shown</Text>
          </View>
        </View>

        {editing ? (
          <View style={{ gap: 10 }}>
            <TextInput
              accessibilityLabel="Local preview display name"
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Your name"
              placeholderTextColor={colors.muted}
              style={{ minHeight: 48, color: colors.text, backgroundColor: colors.field, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14 }}
            />
            <TextInput accessibilityLabel="Preview username" value={draftUsername} onChangeText={setDraftUsername} placeholder="Username" placeholderTextColor={colors.muted} autoCapitalize="none" style={{ minHeight: 48, color: colors.text, backgroundColor: colors.field, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14 }} />
            <TextInput accessibilityLabel="Preview city or area" value={draftCity} onChangeText={setDraftCity} placeholder="City or area · optional" placeholderTextColor={colors.muted} style={{ minHeight: 48, color: colors.text, backgroundColor: colors.field, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 14 }} />
            <TextInput accessibilityLabel="Preview profile biography" value={draftBio} onChangeText={setDraftBio} placeholder="About you · optional" placeholderTextColor={colors.muted} multiline style={{ minHeight: 76, textAlignVertical: "top", color: colors.text, backgroundColor: colors.field, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: 14 }} />
            <View style={{ flexDirection: "row", gap: 9 }}>
              <View style={{ flex: 1 }}><Button label="Save preview profile" onPress={() => {
                saveDemoName();
                const nextUsername = draftUsername.trim().replace(/^@/, "");
                const nextCity = draftCity.trim();
                const nextBio = draftBio.trim();
                setUsername(nextUsername);
                setCity(nextCity);
                setBio(nextBio);
                updateDevelopmentProfile({
                  displayName: draftName.trim() || displayName,
                  username: nextUsername,
                  city: nextCity,
                  bio: nextBio,
                });
              }} /></View>
              <View style={{ flex: 1 }}><Button label="Cancel" variant="secondary" onPress={() => { setDraftName(displayName); setEditing(false); }} /></View>
            </View>
          </View>
        ) : (
          <Button label="Edit preview details" variant="secondary" onPress={() => {
            setDraftName(displayName);
            setDraftUsername(username);
            setDraftCity(city);
            setDraftBio(bio);
            setEditing(true);
          }} />
        )}
        {bio ? <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{bio}</Text> : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name={visibility === "public" ? "globe" : "lock"} size={15} color={colors.muted} />
          <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{visibility === "public" ? "Public preview profile" : "Private preview profile"}</Text>
        </View>
      </Card>

      <Card style={{ backgroundColor: colors.hero }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Icon name="award" size={20} color={colors.accent} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>MOVEIT Rewards</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>No eligible points activity yet · no tier assigned</Text>
          </View>
        </View>
        <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
          Points are not issued in this local preview. Earned balance, progress, and approved offers will appear after qualifying activity is connected.
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button label="Rewards & history" icon="clock" variant="secondary" onPress={() => router.push("/rewards")} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Explore venues" icon="map-pin" variant="secondary" onPress={() => router.push("/venues")} />
          </View>
        </View>
      </Card>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Profile visibility" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pill label="Public" selected={visibility === "public"} onPress={() => { setVisibility("public"); setPreviewOwnerVisibility("public"); updateDevelopmentProfile({ visibility: "public" }); }} />
          <Pill label="Private" selected={visibility === "private"} onPress={() => { setVisibility("private"); setPreviewOwnerVisibility("private"); updateDevelopmentProfile({ visibility: "private" }); }} />
        </View>
        <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
          Preview setting only. Basic fields would be discoverable on a public profile; private profiles would require an approved follow. Workout, post, and sensitive-field permissions must be enforced separately by the backend.
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pill label={`Followers · ${socialCounts.followers}`} selected={false} />
          <Pill label={`Following · ${socialCounts.following}`} selected={false} />
          <Pill label={`Requests · ${socialCounts.incomingRequests}`} selected={false} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Button label="Manage lists" variant="secondary" onPress={() => router.push("/profile/social")} /></View>
          <View style={{ flex: 1 }}><Button label="Sample players" variant="secondary" onPress={() => router.push("/profiles")} /></View>
        </View>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Fictional sample relationships only · no account-backed follows are connected.</Text>
      </View>

      <View style={{ gap: 12 }}>
        <SectionTitle title="Activity" />
        <Button label="Open fitness tracker" icon="activity" variant="secondary" onPress={() => router.push("/fitness")} />
        <AthletePerformance
          loading={fitnessLoading}
          error={fitnessError}
          workouts={fitnessData?.workouts ?? []}
          workoutCount={performance?.workoutCount ?? 0}
          totalMinutes={performance?.totalMinutes ?? 0}
          recentWeekMinutes={recentWeekMinutes}
          records={performance?.exerciseRecords ?? []}
          onRetry={() => void refreshFitness()}
        />
      </View>

      <View style={{ gap: 12 }}>
        <SectionTitle title="Sports and roles" />
        <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
          Select multiple sports and choose how you take part. These preferences stay local in this preview.
        </Text>
        {selectedInterests.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {selectedInterests.map((interest) => {
              const sport = sportsCatalogue.find((item) => item.id === interest.sportId);
              const role = sportRoles.find((item) => item.id === interest.role)?.label.toLowerCase();
              if (!sport) return null;
              return (
                <Pill
                  key={`${interest.sportId}-${interest.role}`}
                  label={`${sport.name} · ${role}`}
                  selected
                  onPress={() => toggleInterest(interest.sportId, interest.role)}
                />
              );
            })}
          </View>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 12 }}>No sports selected yet.</Text>
        )}
        <TextInput
          accessibilityLabel="Search sports catalogue"
          value={sportQuery}
          onChangeText={setSportQuery}
          placeholder="Find a sport by name or alias"
          placeholderTextColor={colors.muted}
          style={{ minHeight: 46, color: colors.text, backgroundColor: colors.field, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 13 }}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          <Pill label="All categories" selected={sportCategory === "All categories"} onPress={() => setSportCategory("All categories")} />
          {sportCategories.map((item) => (
            <Pill key={item} label={item} selected={sportCategory === item} onPress={() => setSportCategory(item)} />
          ))}
        </View>
        <View style={{ gap: 10 }}>
          {matchingSports.map((sport) => (
            <View key={sport.id} style={{ gap: 7, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                <Icon name={sport.icon} size={16} color={colors.muted} />
                <Text style={{ flex: 1, color: colors.text, fontSize: 13, fontWeight: "600" }}>{sport.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 10 }}>{sport.category}</Text>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {sportRoles.map((role) => {
                  const selected = selectedInterests.some((interest) => interest.sportId === sport.id && interest.role === role.id);
                  return (
                    <Pill
                      key={role.id}
                      label={role.label}
                      selected={selected}
                      onPress={() => toggleInterest(sport.id, role.id)}
                    />
                  );
                })}
              </View>
                  {selectedInterests.some((interest) => interest.sportId === sport.id && interest.role === "playing") ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, paddingLeft: 25 }}>
                      {["Beginner", "Intermediate", "Advanced"].map((level) => (
                        <Pill
                          key={level}
                          label={skillLevels[sport.id] === level ? `${level} · self-reported` : level}
                          selected={skillLevels[sport.id] === level}
                          onPress={() => {
                            const updated = { ...skillLevels, [sport.id]: skillLevels[sport.id] === level ? "" : level };
                            setSkillLevels(updated);
                            updateDevelopmentProfile({ skillLevels: updated });
                          }}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              ))}
          {!matchingSports.length ? (
            <Text style={{ color: colors.muted, fontSize: 12 }}>No sports match that name or alias in this category.</Text>
          ) : null}
        </View>
        <Text style={{ color: colors.muted, fontSize: 10 }}>Skill levels are self-reported, not verified coaching qualifications.</Text>
      </View>

      <View style={{ gap: 10 }}>
        <SectionTitle title="Profile sections" />
        <Text style={{ color: colors.muted, fontSize: 11 }}>Choose what a future profile could display. These preview choices do not change workout or post access.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {["About", "Sports", "Achievements", "Selected posts", "Activity summary"].map((section) => {
            const selected = shownSections.includes(section);
            return (
              <Pill
                key={section}
                label={section}
                selected={selected}
                onPress={() => {
                  const updated = selected ? shownSections.filter((item) => item !== section) : [...shownSections, section];
                  setShownSections(updated);
                  updateDevelopmentProfile({ shownSections: updated });
                }}
              />
            );
          })}
        </View>
        <Text style={{ color: colors.muted, fontSize: 10 }}>
          Selected for preview: {shownSections.length ? shownSections.join(" · ") : "No profile sections selected"}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>No challenges have been completed in this preview. There are no achievements to display yet.</Text>
      </View>

      <View style={{ gap: 12 }}>
        <SectionTitle title="App appearance" />
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <Icon name="sliders" size={18} color={colors.muted} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>Theme</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Current setting: {modeLabel}</Text>
              </View>
            </View>
            <Pill label={`Switch to ${nextMode}`} selected={false} onPress={() => setMode(nextMode)} />
          </View>
          <Text style={{ color: colors.muted, fontSize: 10 }}>System follows your device. Manual theme changes last for this app session.</Text>
        </Card>
      </View>

      <Button
        label="Go to account sign-in"
        variant="secondary"
        onPress={() => router.push("/auth")}
      />
      <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 16 }}>
        Profile details, sports interests, and edits in this preview are local only. Sign in to use an account profile.
      </Text>
    </Page>
  );
}

function AthletePerformance({
  loading,
  error,
  workouts,
  workoutCount,
  totalMinutes,
  recentWeekMinutes,
  records,
  onRetry,
}: {
  loading: boolean;
  error: string;
  workouts: Workout[];
  workoutCount: number;
  totalMinutes: number;
  recentWeekMinutes: number;
  records: Array<{ name: string; weight_kg: number; repetitions: number }>;
  onRetry: () => void;
}) {
  const { colors } = useMoveitTheme();

  if (loading) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel="Loading saved athlete performance" style={{ alignItems: "center", padding: 22 }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <Card>
        <Text accessibilityRole="alert" style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
          Saved performance is unavailable: {error}
        </Text>
        <Button label="Retry performance" variant="secondary" onPress={onRetry} />
        {error.includes("Sign in") ? <Button label="Sign in" onPress={() => router.push("/auth")} /> : null}
      </Card>
    );
  }

  if (!workouts.length) {
    return (
      <Card>
        <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>Your athlete record starts with a workout</Text>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
          Saved workouts will contribute to your history, personal bests, and milestones. No activity is counted from venue visits.
        </Text>
      </Card>
    );
  }

  const milestones = [
    { title: "First workout", unlocked: workoutCount >= 1 },
    { title: "Five workouts logged", unlocked: workoutCount >= 5 },
    { title: "Ten workouts logged", unlocked: workoutCount >= 10 },
  ];

  return (
    <View style={{ gap: 14 }}>
      <Card>
        <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "600", letterSpacing: 0.7 }}>
          SAVED WORKOUTS · LATEST {workouts.length >= 100 ? "100" : workouts.length}
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <PerformanceStat label="Workouts" value={workoutCount >= 100 ? "100+" : String(workoutCount)} />
          <PerformanceStat label="Recent 7 days" value={`${recentWeekMinutes} min`} />
          <PerformanceStat label="Recent total" value={`${totalMinutes} min`} />
        </View>
        <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}>
          Counts use saved records from the latest 100 workouts. The seven-day value uses a separate bounded query.
        </Text>
      </Card>

      <View style={{ gap: 8 }}>
        <SectionTitle title="Personal bests" />
        <Text style={{ color: colors.muted, fontSize: 10 }}>Highest logged weight per exercise · latest 100 workouts</Text>
        {records.length ? records.slice(0, 4).map((record) => (
          <View key={record.name} style={{ minHeight: 40, flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Icon name="award" size={15} color={colors.primary} />
            <Text style={{ flex: 1, color: colors.text, fontSize: 12 }}>{record.name}</Text>
            <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{record.weight_kg} kg · {record.repetitions} reps</Text>
          </View>
        )) : (
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            No weighted sets have been saved yet. Bodyweight exercises are not ranked in this summary.
          </Text>
        )}
      </View>

      <View style={{ gap: 8 }}>
        <SectionTitle title="Milestones" />
        {milestones.map((milestone) => (
          <View key={milestone.title} style={{ minHeight: 38, flexDirection: "row", alignItems: "center", gap: 9 }}>
            <Icon
              name={milestone.unlocked ? "check-circle" : "circle"}
              size={16}
              color={milestone.unlocked ? colors.primary : colors.muted}
            />
            <Text style={{ color: milestone.unlocked ? colors.text : colors.muted, fontSize: 12 }}>
              {milestone.title}{milestone.unlocked ? " · reached" : " · not yet"}
            </Text>
          </View>
        ))}
        <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}>
          Milestones reflect workout counts, not streaks or training volume. They are not redeemable rewards.
        </Text>
      </View>
    </View>
  );
}

function PerformanceStat({ label, value }: { label: string; value: string }) {
  const { colors } = useMoveitTheme();

  return (
    <View style={{ flex: 1, minWidth: 0, gap: 5, paddingVertical: 8 }}>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 10 }}>{label}</Text>
    </View>
  );
}
