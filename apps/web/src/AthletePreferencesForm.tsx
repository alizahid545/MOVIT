import { useCallback, useEffect, useMemo, useState } from "react";
import {
  athleteFitnessGoalOptions,
  athletePreferencesSchema,
  type AthletePreferencesInput,
} from "@moveit/shared";
import { createAthleteProfileRepository } from "@moveit/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type Props = {
  client: SupabaseClient;
  showGoals?: boolean;
  showLocation?: boolean;
  allowSkip?: boolean;
  onComplete?: () => void | Promise<void>;
};

const initialPreferences: AthletePreferencesInput = {
  fitnessGoals: [],
  discoveryRadiusKm: null,
  visibility: "public",
};
const radiusOptions = [5, 10, 25, 50, 100];

export function AthletePreferencesForm({
  client,
  showGoals = true,
  showLocation = true,
  allowSkip = false,
  onComplete,
}: Props) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [locationNotice, setLocationNotice] = useState("");
  const repository = useMemo(() => createAthleteProfileRepository(client), [client]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPreferences(await repository.loadMyAthletePreferences());
      setLoaded(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Preferences could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => { void refresh(); }, [refresh]);

  const update = (patch: Partial<AthletePreferencesInput>) => {
    setPreferences((current) => ({ ...current, ...patch }));
    setError("");
    setNotice("");
  };

  const toggleGoal = (goal: string) => {
    update({
      fitnessGoals: preferences.fitnessGoals.includes(goal)
        ? preferences.fitnessGoals.filter((value) => value !== goal)
        : [...preferences.fitnessGoals, goal],
    });
  };

  const requestLocation = () => {
    setLocationNotice("");
    setError("");
    if (!navigator.geolocation) {
      setLocationNotice("This browser does not provide device location. You can still use your city and radius.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setLocationNotice("Location was read for this session only. Precise coordinates were not saved."),
      (locationError) => setLocationNotice(
        locationError.code === locationError.PERMISSION_DENIED
          ? "Location access was skipped or denied. Your city and radius preferences still work."
          : "Current location is unavailable. You can still use your city and radius.",
      ),
      { enableHighAccuracy: false, maximumAge: 0, timeout: 10000 },
    );
  };

  const save = async () => {
    setError("");
    setNotice("");
    const parsed = athletePreferencesSchema.safeParse(preferences);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your preferences.");
      return;
    }
    if (!loaded) {
      setError("Load your saved preferences before saving changes.");
      return;
    }
    setSaving(true);
    try {
      setPreferences(await repository.saveMyAthletePreferences(parsed.data));
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
    <section className="sports-preferences" aria-labelledby="athlete-preferences-title">
      <h2 id="athlete-preferences-title">
        {showGoals && showLocation ? "Athlete preferences" : showGoals ? "Fitness goals" : "Location & privacy"}
      </h2>
      {loading ? <p className="muted" role="status">Loading your saved preferences…</p> : null}

      {showGoals && loaded ? (
        <fieldset className="preference-fieldset">
          <legend>Optional fitness goals</legend>
          <p className="muted">No medical information or detailed biometrics are collected here.</p>
          <div className="preference-options">
            {athleteFitnessGoalOptions.map((goal) => (
              <label className="preference-option" key={goal.value}>
                <input
                  type="checkbox"
                  checked={preferences.fitnessGoals.includes(goal.value)}
                  onChange={() => toggleGoal(goal.value)}
                />
                {goal.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {showLocation && loaded ? (
        <>
          <fieldset className="preference-fieldset" disabled={loading}>
            <legend>Discovery radius</legend>
            <p className="muted">Choose a preferred distance. Device location can help find nearby activities; it is optional, and city-based discovery works without it.</p>
            <div className="preference-options">
              <label className="preference-option">
                <input
                  type="radio"
                  name="discovery-radius"
                  checked={preferences.discoveryRadiusKm === null}
                  onChange={() => update({ discoveryRadiusKm: null })}
                />
                Any distance
              </label>
              {radiusOptions.map((radius) => (
                <label className="preference-option" key={radius}>
                  <input
                    type="radio"
                    name="discovery-radius"
                    checked={preferences.discoveryRadiusKm === radius}
                    onChange={() => update({ discoveryRadiusKm: radius })}
                  />
                  {radius} km
                </label>
              ))}
            </div>
          </fieldset>
          <p className="muted">Device location can help find nearby activities. It is optional and is read only after you choose the button.</p>
          <button type="button" className="text-button" onClick={requestLocation}>
            Use device location (optional)
          </button>
          {locationNotice ? <p className="muted" role="status">{locationNotice}</p> : null}
          <p className="muted">Precise coordinates are read only for this session and are never saved to your profile.</p>

          <fieldset className="preference-fieldset" disabled={loading}>
            <legend>Profile visibility</legend>
            <p className="muted">Public profiles can be discovered by MOVEIT members. Avatars remain public either way.</p>
            <div className="preference-options">
              {(["public", "private"] as const).map((visibility) => (
                <label className="preference-option" key={visibility}>
                  <input
                    type="radio"
                    name="profile-visibility"
                    checked={preferences.visibility === visibility}
                    onChange={() => update({ visibility })}
                  />
                  {visibility === "public" ? "Public" : "Private"}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      ) : null}

      {error ? <p className="feedback error" role="alert">{error}</p> : null}
      {notice ? <p className="feedback success" role="status">{notice}</p> : null}
      {!loading && !loaded ? (
        <>
          <button className="primary-button" type="button" onClick={() => void refresh()}>
            Try loading again
          </button>
          {allowSkip ? (
            <button type="button" className="text-button" onClick={() => void skip()}>
              Skip optional preferences
            </button>
          ) : null}
        </>
      ) : null}
      {!loading && loaded ? (
        <>
          <button className="primary-button" type="button" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving preferences…" : allowSkip ? "Save & continue" : "Save preferences"}
            <span aria-hidden="true">↗</span>
          </button>
          {allowSkip ? (
            <button type="button" className="text-button" onClick={() => void skip()}>
              Skip optional preferences
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
