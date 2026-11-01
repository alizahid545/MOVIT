import { useCallback, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Button, Card, Header, Icon, Page } from "../src/components/ui";
import {
  getLocalPreviewAccountId,
  getOnboardingRoute,
  loadAccountOnboarding,
  saveAccountOnboarding,
  type AccountOnboarding,
  type AccountRole,
} from "../src/account-onboarding";
import { supabase } from "../src/supabase";
import { useMoveitTheme } from "../src/theme";

export default function RoleSelectionScreen() {
  const { colors } = useMoveitTheme();
  const [accountId, setAccountId] = useState("");
  const [onboarding, setOnboarding] = useState<AccountOnboarding | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyRole, setBusyRole] = useState<AccountRole | null>(null);
  const [error, setError] = useState("");
  const [isPreview, setIsPreview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (supabase) {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!data.user) {
          router.replace("/auth");
          return;
        }
        setAccountId(data.user.id);
        setIsPreview(false);
        setOnboarding(await loadAccountOnboarding(data.user.id));
      } else {
        const previewId = getLocalPreviewAccountId();
        setAccountId(previewId);
        setIsPreview(true);
        setOnboarding(await loadAccountOnboarding(previewId));
      }
    } catch (caught) {
      setOnboarding(null);
      setError(caught instanceof Error ? caught.message : "Your account roles could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const chooseRole = async (role: AccountRole) => {
    if (!onboarding || busyRole) return;
    setBusyRole(role);
    setError("");
    try {
      const selectedRoles = Array.from(new Set([...onboarding.selectedRoles, role]));
      const updated = await saveAccountOnboarding(accountId, { selectedRoles, activeRole: role });
      setOnboarding(updated);
      if (updated.completedRoles.includes(role)) {
        router.replace(role === "athlete" ? "/(tabs)" : "/business/dashboard");
      } else {
        router.push(getOnboardingRoute(role));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your role choice could not be saved.");
    } finally {
      setBusyRole(null);
    }
  };

  if (loading) {
    return <Page><Header eyebrow="MOVEIT ACCOUNT" title="Loading your profiles." /><View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.muted, fontSize: 12 }}>Checking completed onboarding and account roles…</Text></View></Page>;
  }

  return (
    <Page>
      <Header eyebrow={isPreview ? "LOCAL PREVIEW · ACCOUNT ROLES" : "MOVEIT ACCOUNT · PROFILE SETUP"} title={onboarding?.completedRoles.length ? "Choose your MOVEIT." : "How will you MOVEIT?"} action={onboarding?.completedRoles.length ? <Button label="Back" variant="quiet" onPress={() => router.back()} /> : undefined} />
      <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 20 }}>
        One account can have both profiles. Choose which experience to set up or open; you can switch roles later.
      </Text>
      {isPreview ? (
        <Card><Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>Local preview mode · choices are held in memory and are not account-persisted. With Supabase configured, selected profiles and onboarding completion use the account onboarding table; actual permission roles remain separately granted.</Text></Card>
      ) : null}
      {onboarding ? (
        <>
          <RoleOption
            title="Athlete / Player"
            description="Build your athlete profile, track progress, find games and connect with players."
            icon="activity"
            selected={onboarding.selectedRoles.includes("athlete")}
            complete={onboarding.completedRoles.includes("athlete")}
            active={onboarding.activeRole === "athlete"}
            busy={busyRole === "athlete"}
            onPress={() => void chooseRole("athlete")}
          />
          <RoleOption
            title="Business / Venue Owner"
            description="Set up a business profile, prepare venue listings and manage facilities."
            icon="briefcase"
            selected={onboarding.selectedRoles.includes("business")}
            complete={onboarding.completedRoles.includes("business")}
            active={onboarding.activeRole === "business"}
            busy={busyRole === "business"}
            onPress={() => void chooseRole("business")}
          />
          {onboarding.completedRoles.length ? (
            <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
              Returning profile · {onboarding.completedRoles.map((role) => role === "athlete" ? "Athlete / Player" : "Business").join(" · ")}
            </Text>
          ) : null}
          {onboarding.grantedRoles.length ? (
            <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 16 }}>
              Granted account permissions are checked separately. Profile selection does not grant business membership, verification, or publishing access.
            </Text>
          ) : null}
        </>
      ) : (
        <Card>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>We could not load your account profiles</Text>
          <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}>{error}</Text>
          <Button label="Try again" icon="refresh-cw" onPress={() => void load()} />
          <Button label="Sign in" variant="secondary" onPress={() => router.replace("/auth")} />
        </Card>
      )}
      {error && onboarding ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
      {isPreview ? <Button label="Continue to athlete demo" variant="quiet" onPress={() => router.replace("/(tabs)")} /> : null}
    </Page>
  );
}

function RoleOption({
  title,
  description,
  icon,
  selected,
  complete,
  active,
  busy,
  onPress,
}: {
  title: string;
  description: string;
  icon: "activity" | "briefcase";
  selected: boolean;
  complete: boolean;
  active: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const { colors } = useMoveitTheme();
  return (
    <Card style={{ borderWidth: 1, borderColor: active ? colors.accent : colors.border }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceAlt }}>
          <Icon name={icon} size={20} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{title}</Text>
          <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>{description}</Text>
        </View>
      </View>
      <Text style={{ color: active ? colors.accent : colors.muted, fontSize: 10, fontWeight: "600" }}>
        {active ? "ACTIVE PROFILE" : complete ? "PROFILE READY" : selected ? "SETUP INCOMPLETE" : "AVAILABLE"}
      </Text>
      <Button
        label={busy ? "Saving role…" : active && complete ? `Continue as ${title}` : complete ? `Switch to ${title}` : selected ? `Continue ${title} setup` : `Set up ${title}`}
        icon={busy ? undefined : "arrow-right"}
        disabled={busy}
        onPress={onPress}
      />
    </Card>
  );
}
