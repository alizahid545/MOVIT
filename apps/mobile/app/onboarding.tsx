import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import {
  athleteOnboardingStepSchema,
  type AthleteOnboardingStep,
} from "@moveit/shared";
import { createAthleteProfileRepository } from "@moveit/supabase";
import {
  getLocalPreviewAccountId,
  loadAccountOnboarding,
  saveAccountOnboarding,
} from "../src/account-onboarding";
import { AthletePreferencesForm } from "../src/components/athlete-preferences-form";
import { AthleteOnboardingReview } from "../src/components/athlete-onboarding-review";
import { PersonalInformationForm } from "../src/components/personal-information-form";
import { SportsPreferencesForm } from "../src/components/sports-preferences-form";
import { Button, Header, Page } from "../src/components/ui";
import { supabase } from "../src/supabase";
import { useMoveitTheme } from "../src/theme";

type ActiveStep = Exclude<AthleteOnboardingStep, "complete">;

const steps: ActiveStep[] = ["personal", "sports", "fitness", "location", "review"];

function stepTitle(step: ActiveStep) {
  switch (step) {
    case "personal": return "Make it yours.";
    case "sports": return "Find your game.";
    case "fitness": return "Set your goals.";
    case "location": return "Choose your range.";
    case "review": return "Ready to MOVEIT?";
  }
}

function stepDescription(step: ActiveStep) {
  switch (step) {
    case "personal": return "Add the details you want your local sports community to see. You can update them anytime.";
    case "sports": return "Choose sports you enjoy and your self-reported skill level. You can edit these anytime.";
    case "fitness": return "Optional fitness preferences. We do not collect medical information or detailed biometrics here.";
    case "location": return "Choose a discovery radius. Device location is optional and requested only after you choose to use it.";
    case "review": return "Check your profile and preferences. You can edit everything later.";
  }
}

export default function Onboarding() {
  const { colors } = useMoveitTheme();
  const { step: queryStep } = useLocalSearchParams<{ step?: string }>();
  const [step, setStep] = useState<ActiveStep>("personal");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const parsedQuery = athleteOnboardingStepSchema.safeParse(queryStep);
    if (parsedQuery.success && parsedQuery.data !== "complete") {
      setStep(parsedQuery.data);
      setReady(true);
      return;
    }

    let active = true;
    if (!supabase) {
      setReady(true);
      return () => { active = false; };
    }
    void createAthleteProfileRepository(supabase).loadMyAthleteOnboardingState()
      .then((state) => {
        if (!active) return;
        if (state.step === "complete") {
          router.replace("/(tabs)");
        } else if (
          state.version >= 2
          && state.step
          && steps.includes(state.step)
        ) {
          setStep(state.step);
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Onboarding progress could not be loaded.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => { active = false; };
  }, [queryStep]);

  const currentIndex = steps.indexOf(step);

  const goTo = async (nextStep: ActiveStep) => {
    setError("");
    if (supabase) {
      await createAthleteProfileRepository(supabase).saveMyAthleteOnboardingState(nextStep);
    }
    setStep(nextStep);
    router.replace({ pathname: "/onboarding", params: { step: nextStep } });
  };

  const finishPersonalInformation = async () => {
    const userId = supabase
      ? (await supabase.auth.getUser()).data.user?.id
      : getLocalPreviewAccountId();
    if (!userId) throw new Error("Please sign in again to continue.");

    const saved = await loadAccountOnboarding(userId);
    await saveAccountOnboarding(userId, {
      selectedRoles: Array.from(new Set([...saved.selectedRoles, "athlete"])),
      activeRole: "athlete",
    });
    await goTo("sports");
  };

  const continueSports = async () => goTo("fitness");
  const continueFitness = async () => goTo("location");
  const continueLocation = async () => goTo("review");
  const back = async () => {
    if (currentIndex <= 0) return;
    try {
      await goTo(steps[currentIndex - 1]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your progress could not be saved.");
    }
  };

  const finish = async () => {
    try {
      const userId = supabase
        ? (await supabase.auth.getUser()).data.user?.id
        : getLocalPreviewAccountId();
      if (!userId) throw new Error("Please sign in again to complete onboarding.");
      if (supabase) {
        await createAthleteProfileRepository(supabase).saveMyAthleteOnboardingState("review", true);
      }
      const account = await loadAccountOnboarding(userId);
      await saveAccountOnboarding(userId, {
        selectedRoles: Array.from(new Set([...account.selectedRoles, "athlete"])),
        completedRoles: Array.from(new Set([...account.completedRoles, "athlete"])),
        activeRole: "athlete",
      });
      router.replace("/(tabs)");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Onboarding could not be completed.");
    }
  };

  if (!ready) {
    return (
      <Page>
        <View accessibilityRole="progressbar" style={{ alignItems: "center", gap: 10, padding: 28 }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.muted }}>Restoring your onboarding progress…</Text>
        </View>
      </Page>
    );
  }

  return (
    <Page>
      <Header
        eyebrow={`ATHLETE PROFILE · STEP ${currentIndex + 1} OF ${steps.length}`}
        title={stepTitle(step)}
      />
      {currentIndex > 0 ? <Button label="Back" variant="quiet" onPress={() => void back()} /> : null}
      <View style={{ height: 4, overflow: "hidden", borderRadius: 4, backgroundColor: colors.border }}>
        <View style={{ width: `${((currentIndex + 1) / steps.length) * 100}%`, height: "100%", backgroundColor: colors.accent }} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: -8 }}>
        {stepDescription(step)}
      </Text>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
      {step === "personal" ? (
        <PersonalInformationForm onSaved={finishPersonalInformation} />
      ) : null}
      {step === "sports" ? (
        <SportsPreferencesForm allowSkip onComplete={continueSports} />
      ) : null}
      {step === "fitness" ? (
        <AthletePreferencesForm allowSkip showLocation={false} onComplete={continueFitness} />
      ) : null}
      {step === "location" ? (
        <AthletePreferencesForm allowSkip showGoals={false} onComplete={continueLocation} />
      ) : null}
      {step === "review" ? (
        <AthleteOnboardingReview onComplete={finish} />
      ) : null}
    </Page>
  );
}
