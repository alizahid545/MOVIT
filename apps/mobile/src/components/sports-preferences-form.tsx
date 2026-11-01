import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import {
  type SportPreference,
  type SportPreferenceInput,
  type SportSkillLevel,
} from "@moveit/shared";
import {
  createAthleteProfileRepository,
  SUPABASE_SETUP_ERROR,
} from "@moveit/supabase";
import { searchSports, sportsCatalogue } from "../sports-catalogue";
import { supabase } from "../supabase";
import { useMoveitTheme } from "../theme";
import { Button, Card, Pill, SectionTitle } from "./ui";

type Props = {
  allowSkip?: boolean;
  onComplete?: () => void | Promise<void>;
  onSaved?: (preferences: SportPreference[]) => void;
};

const skillLevels: { value: SportSkillLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "professional", label: "Professional" },
];

export function SportsPreferencesForm({ allowSkip = false, onComplete, onSaved }: Props) {
  const { colors } = useMoveitTheme();
  const [preferences, setPreferences] = useState<SportPreference[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    setLoading(true);
    setLoaded(false);
    try {
      if (!supabase) throw new Error(SUPABASE_SETUP_ERROR);
      const saved = await createAthleteProfileRepository(supabase).loadMySportPreferences();
      setPreferences(saved);
      setLoaded(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your sports preferences could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleSport = (sportId: string) => {
    setPreferences((current) => current.some((item) => item.sportId === sportId)
      ? current.filter((item) => item.sportId !== sportId)
      : [...current, { sportId, skillLevel: null, isPreferred: false }]);
    setError("");
    setNotice("");
  };

  const updatePreference = (sportId: string, update: Partial<SportPreference>) => {
    setPreferences((current) => current.map((item) =>
      item.sportId === sportId ? { ...item, ...update } : item,
    ));
    setError("");
    setNotice("");
  };

  const save = async () => {
    setError("");
    setNotice("");
    const incomplete = preferences.find((item) => item.skillLevel === null);
    if (incomplete) {
      const sportName = sportsCatalogue.find((sport) => sport.id === incomplete.sportId)?.name ?? incomplete.sportId;
      setError(`Choose a skill level for ${sportName} before saving.`);
      return;
    }
    const completePreferences: SportPreferenceInput[] = preferences.filter(
      (item): item is SportPreference & { skillLevel: SportSkillLevel } => item.skillLevel !== null,
    );

    setSaving(true);
    try {
      if (!supabase) throw new Error(SUPABASE_SETUP_ERROR);
      const saved = await createAthleteProfileRepository(supabase).saveMySportPreferences(
        completePreferences.map((item) => ({
          sportId: item.sportId,
          skillLevel: item.skillLevel,
          isPreferred: item.isPreferred,
        })),
      );
      setPreferences(saved);
      onSaved?.(saved);
      setNotice("Sports preferences saved to your MOVEIT account.");
      await onComplete?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your sports preferences could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const matchingSports = searchSports(query)
    .filter((sport) => !preferences.some((item) => item.sportId === sport.id))
    .slice(0, 8);

  const skip = async () => {
    try {
      await onComplete?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not continue.");
    }
  };

  return (
    <Card style={{ gap: 14 }}>
      <SectionTitle title="Sports & skill levels" />
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
        Choose the sports you enjoy and how you describe your current experience. These are self-reported, not verified qualifications.
      </Text>

      {loading ? (
        <View accessibilityRole="progressbar" style={{ alignItems: "center", gap: 10, padding: 18 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted }}>Loading your saved sports…</Text>
        </View>
      ) : loaded ? (
        <>
          {preferences.length ? preferences.map((preference) => {
            const sport = sportsCatalogue.find((item) => item.id === preference.sportId);
            return (
              <View
                key={preference.sportId}
                style={{
                  gap: 10,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600", flex: 1 }}>
                    {sport?.name ?? preference.sportId}
                  </Text>
                  <Pill label="Remove" onPress={() => toggleSport(preference.sportId)} />
                </View>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Your current level</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {skillLevels.map((level) => (
                    <Pill
                      key={level.value}
                      label={level.label}
                      selected={preference.skillLevel === level.value}
                      onPress={() => updatePreference(preference.sportId, { skillLevel: level.value })}
                    />
                  ))}
                </View>
                <Pill
                  label="Favourite sport"
                  selected={preference.isPreferred}
                  onPress={() => updatePreference(preference.sportId, { isPreferred: !preference.isPreferred })}
                />
              </View>
            );
          }) : (
            <Text style={{ color: colors.muted, fontSize: 12 }}>No sports selected yet. You can choose none and update this later.</Text>
          )}

          <TextInput
            accessibilityLabel="Search sports catalogue"
            value={query}
            onChangeText={setQuery}
            placeholder="Search sports"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            style={{
              minHeight: 46,
              color: colors.text,
              backgroundColor: colors.field,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 13,
            }}
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {matchingSports.map((sport) => (
              <Pill key={sport.id} label={sport.name} onPress={() => toggleSport(sport.id)} />
            ))}
          </View>
        </>
      ) : (
        <Button label="Try again" variant="secondary" onPress={() => void refresh()} />
      )}

      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}>{error}</Text> : null}
      {notice ? <Text accessibilityRole="text" style={{ color: colors.success, fontSize: 12, lineHeight: 18 }}>{notice}</Text> : null}
      {!loading && loaded ? (
        <>
          <Button
            label={saving ? "Saving sports…" : allowSkip ? "Save & continue" : "Save sports preferences"}
            icon="check"
            disabled={saving}
            onPress={() => void save()}
          />
          {allowSkip ? (
            <Button
              label="Skip for now"
              variant="quiet"
              disabled={saving}
              onPress={() => void skip()}
            />
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
