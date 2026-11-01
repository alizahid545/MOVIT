import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import * as Location from "expo-location";
import {
  athleteFitnessGoalOptions,
  athletePreferencesSchema,
  type AthletePreferencesInput,
} from "@moveit/shared";
import { createAthleteProfileRepository } from "@moveit/supabase";
import { supabase } from "../supabase";
import { useMoveitTheme } from "../theme";
import { Button, Card, Pill, SectionTitle } from "./ui";

type Props = {
  onComplete?: () => void | Promise<void>;
  allowSkip?: boolean;
  showGoals?: boolean;
  showLocation?: boolean;
};

const initialPreferences: AthletePreferencesInput = {
  fitnessGoals: [],
  discoveryRadiusKm: null,
  visibility: "public",
};

const radiusOptions = [5, 10, 25, 50, 100];

export function AthletePreferencesForm({
  onComplete,
  allowSkip = false,
  showGoals = true,
  showLocation = true,
}: Props) {
  const { colors } = useMoveitTheme();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    if (!supabase) return () => { active = false; };
    void createAthleteProfileRepository(supabase).loadMyAthletePreferences()
      .then((saved) => {
        if (active) {
          setPreferences(saved);
          setLoaded(true);
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Preferences could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const toggleGoal = (goal: string) => {
    setPreferences((current) => ({
      ...current,
      fitnessGoals: current.fitnessGoals.includes(goal)
        ? current.fitnessGoals.filter((item) => item !== goal)
        : [...current.fitnessGoals, goal],
    }));
    setError("");
    setNotice("");
  };

  const requestLocation = async () => {
    setLocating(true);
    setLocationNotice("");
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationNotice("Location access was skipped or denied. Your city and radius preferences still work.");
        return;
      }
      await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocationNotice("Location is available for this session only. Precise coordinates are not saved to your profile.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Current location is unavailable.");
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    setError("");
    setNotice("");
    const parsed = athletePreferencesSchema.safeParse(preferences);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your preferences.");
      return;
    }
    if (!supabase) {
      setError("Sign in to save preferences to your MOVEIT account.");
      return;
    }
    if (!loaded) {
      setError("Load your saved preferences before saving changes.");
      return;
    }
    setSaving(true);
    try {
      const saved = await createAthleteProfileRepository(supabase).saveMyAthletePreferences(parsed.data);
      setPreferences(saved);
      setLoaded(true);
      setNotice("Your preferences were saved to your MOVEIT account.");
      await onComplete?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Preferences could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    setError("");
    try {
      await onComplete?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not continue.");
    }
  };

  return (
    <Card style={{ gap: 16 }}>
      {showGoals ? <SectionTitle title="Fitness goals" /> : null}
      {showGoals ? <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
        Optional activity preferences. MOVEIT does not ask for medical information or detailed biometrics here.
      </Text> : null}
      {showGoals && loading ? (
        <View accessibilityRole="progressbar" style={{ alignItems: "center", gap: 10, padding: 18 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted }}>Loading saved preferences…</Text>
        </View>
      ) : null}
      {!showGoals && loading ? (
        <View accessibilityRole="progressbar" style={{ alignItems: "center", gap: 10, padding: 18 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted }}>Loading saved preferences…</Text>
        </View>
      ) : null}
      {showGoals && !loading && loaded ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {athleteFitnessGoalOptions.map((goal) => (
            <Pill
              key={goal.value}
              label={goal.label}
              selected={preferences.fitnessGoals.includes(goal.value)}
              onPress={() => toggleGoal(goal.value)}
            />
          ))}
        </View>
      ) : null}

      {showLocation ? <SectionTitle title="Location preferences" /> : null}
      {showLocation ? <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
        Choose how far away you would like activities to be. Device location is optional and can help find nearby activities; MOVEIT asks only after you tap below.
      </Text> : null}
      {showLocation && loaded ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pill
              label="Any distance"
              selected={preferences.discoveryRadiusKm === null}
              onPress={() => setPreferences((current) => ({ ...current, discoveryRadiusKm: null }))}
            />
            {radiusOptions.map((radius) => (
              <Pill
                key={radius}
                label={`${radius} km`}
                selected={preferences.discoveryRadiusKm === radius}
                onPress={() => setPreferences((current) => ({ ...current, discoveryRadiusKm: radius }))}
              />
            ))}
          </View>
          <Button
            label={locating ? "Checking permission…" : "Use device location (optional)"}
            variant="secondary"
            disabled={locating}
            onPress={() => void requestLocation()}
          />
          {locationNotice ? <Text accessibilityRole="text" style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>{locationNotice}</Text> : null}
          <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
            Coordinates are read only for this session and are never saved. You can also use your city without granting permission.
          </Text>
        </>
      ) : null}

      {showLocation ? <SectionTitle title="Profile privacy" /> : null}
      {showLocation ? <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
        Public profiles can be discovered by other MOVEIT members. Your avatar remains publicly accessible either way.
      </Text> : null}
      {showLocation && loaded ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pill
            label="Public"
            selected={preferences.visibility === "public"}
            onPress={() => setPreferences((current) => ({ ...current, visibility: "public" }))}
          />
          <Pill
            label="Private"
            selected={preferences.visibility === "private"}
            onPress={() => setPreferences((current) => ({ ...current, visibility: "private" }))}
          />
        </View>
      ) : null}

      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}>{error}</Text> : null}
      {notice ? <Text accessibilityRole="text" style={{ color: colors.success, fontSize: 12, lineHeight: 18 }}>{notice}</Text> : null}
      {!loading && !loaded && supabase ? (
        <Button label="Try loading again" variant="secondary" onPress={() => {
          if (!supabase) return;
          setError("");
          setLoading(true);
          void createAthleteProfileRepository(supabase).loadMyAthletePreferences()
            .then((saved) => { setPreferences(saved); setLoaded(true); })
            .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Preferences could not be loaded."))
            .finally(() => setLoading(false));
        }} />
      ) : null}
      {!loading && loaded ? (
        <>
          <Button
            label={saving ? "Saving preferences…" : allowSkip ? "Save & continue" : "Save preferences"}
            icon="check"
            disabled={saving}
            onPress={() => void save()}
          />
          {allowSkip ? <Button label="Skip optional preferences" variant="quiet" onPress={() => void skip()} /> : null}
        </>
      ) : null}
      {!loading && !loaded && allowSkip ? (
        <Button label="Skip optional preferences" variant="quiet" onPress={() => void skip()} />
      ) : null}
    </Card>
  );
}
