import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { athleteFitnessGoalOptions } from "@moveit/shared";
import { createAthleteProfileRepository } from "@moveit/supabase";
import { supabase } from "../supabase";
import { useMoveitTheme } from "../theme";
import { Button, Card, SectionTitle } from "./ui";

type ReviewData = {
  displayName: string;
  username: string;
  city: string;
  sports: string[];
  goals: string[];
  visibility: string;
  discoveryRadiusKm: number | null;
};

export function AthleteOnboardingReview({ onComplete }: { onComplete: () => void | Promise<void> }) {
  const { colors } = useMoveitTheme();
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!supabase) throw new Error("Sign in to review your saved profile.");
      const repository = createAthleteProfileRepository(supabase);
      const [profile, sports, preferences] = await Promise.all([
        repository.loadMyProfile(),
        repository.loadMySportPreferences(),
        repository.loadMyAthletePreferences(),
      ]);
      setData({
        displayName: profile.displayName,
        username: profile.username,
        city: profile.city,
        sports: sports.map(({ sportId }) => sportId),
        goals: preferences.fitnessGoals,
        visibility: preferences.visibility,
        discoveryRadiusKm: preferences.discoveryRadiusKm,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your profile review could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const finish = async () => {
    setFinishing(true);
    setError("");
    try {
      await onComplete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Onboarding could not be completed.");
    } finally {
      setFinishing(false);
    }
  };

  if (loading) {
    return (
      <View accessibilityRole="progressbar" style={{ alignItems: "center", gap: 10, padding: 28 }}>
        <ActivityIndicator color={colors.accent} />
        <Text style={{ color: colors.muted }}>Loading your saved details…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <Card style={{ gap: 12 }}>
        {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
        <Button label="Try again" variant="secondary" onPress={() => void load()} />
      </Card>
    );
  }

  const goalLabels = data.goals.map((goal) =>
    athleteFitnessGoalOptions.find((option) => option.value === goal)?.label ?? goal,
  );
  return (
    <Card style={{ gap: 14 }}>
      <SectionTitle title="Your profile" />
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>{data.displayName} · @{data.username}</Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>City or area: {data.city}</Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>Visibility: {data.visibility}</Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        Discovery radius: {data.discoveryRadiusKm ? `${data.discoveryRadiusKm} km` : "Any distance"}
      </Text>
      <SectionTitle title="Sports" />
      <Text style={{ color: colors.muted, fontSize: 12 }}>{data.sports.length ? data.sports.join(", ") : "No sports selected yet"}</Text>
      <SectionTitle title="Fitness goals" />
      <Text style={{ color: colors.muted, fontSize: 12 }}>{goalLabels.length ? goalLabels.join(", ") : "No optional goals selected"}</Text>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{error}</Text> : null}
      <Button label={finishing ? "Finishing…" : "Complete onboarding"} icon="check" disabled={finishing} onPress={() => void finish()} />
    </Card>
  );
}
