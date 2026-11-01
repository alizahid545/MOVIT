import { useCallback, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type SportPreference,
  type SportPreferenceInput,
  type SportSkillLevel,
  sportSkillLevelSchema,
} from "@moveit/shared";
import { searchSports, sportsCatalogue } from "@moveit/shared";
import { createAthleteProfileRepository } from "@moveit/supabase";

const skillLevels: { value: SportSkillLevel; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "professional", label: "Professional" },
];

export function SportPreferencesForm({
  client,
  allowSkip = false,
  onComplete,
}: {
  client: SupabaseClient;
  allowSkip?: boolean;
  onComplete?: () => void | Promise<void>;
}) {
  const [preferences, setPreferences] = useState<SportPreference[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPreferences(await createAthleteProfileRepository(client).loadMySportPreferences());
      setLoaded(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your sports preferences could not be loaded.");
      setLoaded(false);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      const saved = await createAthleteProfileRepository(client).saveMySportPreferences(completePreferences);
      setPreferences(saved);
      setNotice("Sports preferences saved to your MOVEIT account.");
      await onComplete?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your sports preferences could not be saved.");
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

  const matchingSports = searchSports(query)
    .filter((sport) => !preferences.some((item) => item.sportId === sport.id))
    .slice(0, 8);

  return (
    <section className="sports-preferences" aria-labelledby="sports-preferences-title">
      <h2 id="sports-preferences-title">Sports &amp; skill levels</h2>
      <p className="muted">
        Choose the sports you enjoy, share how you describe your current experience, and mark any favourites.
        Skill levels are self-reported, not verified qualifications.
      </p>

      {loading ? (
        <p className="muted" role="status">Loading your saved sports…</p>
      ) : !loaded ? (
        <button className="primary-button" type="button" onClick={() => void refresh()}>
          Try again
        </button>
      ) : (
        <>
          {preferences.length ? (
            <div className="sport-preference-list">
              {preferences.map((preference) => {
                const sport = sportsCatalogue.find((item) => item.id === preference.sportId);
                return (
                  <article className="sport-preference-item" key={preference.sportId}>
                    <div className="sport-preference-heading">
                      <h3>{sport?.name ?? preference.sportId}</h3>
                      <button
                        type="button"
                        className="text-button"
                        aria-label={`Remove ${sport?.name ?? preference.sportId}`}
                        onClick={() => {
                          setPreferences((current) => current.filter((item) => item.sportId !== preference.sportId));
                          setError("");
                          setNotice("");
                        }}
                      >
                        Remove
                      </button>
                    </div>
                    <label>
                      Your current level
                      <select
                        aria-label={`${sport?.name ?? preference.sportId} skill level`}
                        value={preference.skillLevel ?? ""}
                        onChange={(event) => {
                          const level = sportSkillLevelSchema.safeParse(event.currentTarget.value);
                          if (level.success) updatePreference(preference.sportId, { skillLevel: level.data });
                        }}
                      >
                        <option value="" disabled>Choose a level</option>
                        {skillLevels.map((level) => (
                          <option key={level.value} value={level.value}>{level.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="sport-favourite">
                      <input
                        type="checkbox"
                        checked={preference.isPreferred}
                        onChange={(event) => updatePreference(
                          preference.sportId,
                          { isPreferred: event.currentTarget.checked },
                        )}
                      />
                      Favourite sport
                    </label>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="muted">No sports selected yet. You can choose none and update this later.</p>
          )}

          <label htmlFor="sport-search">Search MOVEIT’s sports catalogue</label>
          <input
            id="sport-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search sports"
            autoComplete="off"
            disabled={preferences.length >= 20}
          />
          {preferences.length < 20 && matchingSports.length > 0 ? (
            <div className="sport-search-results" aria-label="Matching sports">
              {matchingSports.map((sport) => (
                <button
                  type="button"
                  className="sport-option"
                  key={sport.id}
                  onClick={() => {
                    setPreferences((current) => [
                      ...current,
                      { sportId: sport.id, skillLevel: null, isPreferred: false },
                    ]);
                    setError("");
                    setNotice("");
                  }}
                >
                  {sport.name}
                </button>
              ))}
            </div>
          ) : null}
        </>
      )}

      {error ? <p className="feedback error" role="alert">{error}</p> : null}
      {notice ? <p className="feedback success" role="status">{notice}</p> : null}
      {!loading && loaded ? (
        <>
          <button className="primary-button" type="button" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving sports…" : allowSkip ? "Save & continue" : "Save sports preferences"}
            <span aria-hidden="true">↗</span>
          </button>
          {allowSkip ? (
            <button className="text-button" type="button" onClick={() => void skip()}>
              Skip sports for now
            </button>
          ) : null}
        </>
      ) : !loading && !loaded ? (
        <button className="primary-button" type="button" onClick={() => void refresh()}>
          Try again
        </button>
      ) : null}
    </section>
  );
}
