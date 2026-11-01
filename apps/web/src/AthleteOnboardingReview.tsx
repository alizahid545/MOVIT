import { useEffect, useState } from "react";
import { athleteFitnessGoalOptions } from "@moveit/shared";
import { createAthleteProfileRepository } from "@moveit/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type Props = {
  client: SupabaseClient;
  onComplete: () => void | Promise<void>;
};

export function AthleteOnboardingReview({ client, onComplete }: Props) {
  const [summary, setSummary] = useState<{ sports: string[]; goals: string[]; radius: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const repository = createAthleteProfileRepository(client);
      const [sports, preferences] = await Promise.all([
        repository.loadMySportPreferences(),
        repository.loadMyAthletePreferences(),
      ]);
      setSummary({
        sports: sports.map(({ sportId }) => sportId),
        goals: preferences.fitnessGoals,
        radius: preferences.discoveryRadiusKm,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your profile review could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [client]);

  const finish = async () => {
    setSaving(true);
    setError("");
    try {
      await onComplete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Onboarding could not be completed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="muted" role="status">Loading your saved details…</p>;
  if (!summary) {
    return (
      <>
        {error && <p className="feedback error" role="alert">{error}</p>}
        <button className="primary-button" type="button" onClick={() => void load()}>Try again</button>
      </>
    );
  }

  const goals = summary.goals.map((goal) =>
    athleteFitnessGoalOptions.find((option) => option.value === goal)?.label ?? goal,
  );
  return (
    <div className="onboarding-review">
      <h3>Your saved profile</h3>
      <p className="muted">Sports: {summary.sports.length ? summary.sports.join(", ") : "None selected"}</p>
      <p className="muted">Goals: {goals.length ? goals.join(", ") : "None selected"}</p>
      <p className="muted">Discovery radius: {summary.radius ? `${summary.radius} km` : "Any distance"}</p>
      {error && <p className="feedback error" role="alert">{error}</p>}
      <button className="primary-button" type="button" disabled={saving} onClick={() => void finish()}>
        {saving ? "Finishing…" : "Complete onboarding"}
        <span aria-hidden="true">↗</span>
      </button>
    </div>
  );
}
