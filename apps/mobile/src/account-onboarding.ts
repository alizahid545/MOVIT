import { supabase } from "./supabase";
import { readDevelopmentData, removeDevelopmentData, writeDevelopmentData } from "./local-development-repository";

export type AccountRole = "athlete" | "business";
export type GrantedAppRole = "athlete" | "coach" | "venue_owner" | "moderator" | "administrator";

export type AccountOnboarding = {
  selectedRoles: AccountRole[];
  completedRoles: AccountRole[];
  activeRole: AccountRole | null;
  grantedRoles: GrantedAppRole[];
};

const emptyOnboarding = (): AccountOnboarding => ({
  selectedRoles: [],
  completedRoles: [],
  activeRole: null,
  grantedRoles: [],
});

export function getLocalPreviewAccountId(): string {
  return "local-preview-account";
}

export async function loadAccountOnboarding(userId: string): Promise<AccountOnboarding> {
  if (!supabase || userId === getLocalPreviewAccountId()) {
    return copyAccount(await readDevelopmentData(`account-onboarding:${userId}`, emptyOnboarding()));
  }

  const [onboardingResult, rolesResult] = await Promise.all([
    supabase.from("user_onboarding").select("selected_roles, completed_roles, active_role").eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (onboardingResult.error) throw onboardingResult.error;
  if (rolesResult.error) throw rolesResult.error;

  const grantedRoles = (rolesResult.data ?? [])
    .map((row) => row.role)
    .filter(isGrantedAppRole);
  const saved = onboardingResult.data;
  const selectedRoles = cleanRoles(saved?.selected_roles);
  const completedRoles = cleanRoles(saved?.completed_roles);
  if (grantedRoles.includes("athlete") && !selectedRoles.includes("athlete")) selectedRoles.push("athlete");
  if (grantedRoles.includes("venue_owner")) {
    if (!selectedRoles.includes("business")) selectedRoles.push("business");
    if (!completedRoles.includes("business")) completedRoles.push("business");
  }

  return {
    selectedRoles,
    completedRoles,
    activeRole: isAccountRole(saved?.active_role) ? saved.active_role : null,
    grantedRoles,
  };
}

export async function saveAccountOnboarding(
  userId: string,
  update: Partial<AccountOnboarding>,
): Promise<AccountOnboarding> {
  const current = await loadAccountOnboarding(userId);
  const next: AccountOnboarding = {
    selectedRoles: update.selectedRoles ? cleanRoles(update.selectedRoles) : current.selectedRoles,
    completedRoles: update.completedRoles ? cleanRoles(update.completedRoles) : current.completedRoles,
    activeRole: update.activeRole === undefined ? current.activeRole : update.activeRole,
    grantedRoles: current.grantedRoles,
  };
  if (next.activeRole && !next.selectedRoles.includes(next.activeRole)) {
    throw new Error("Choose an account role before making it active.");
  }
  if (next.completedRoles.some((role) => !next.selectedRoles.includes(role))) {
    throw new Error("Complete only profiles selected for this account.");
  }

  if (!supabase || userId === getLocalPreviewAccountId()) {
    const localAccount = { ...next, grantedRoles: [] };
    await writeDevelopmentData(`account-onboarding:${userId}`, localAccount);
    return copyAccount(localAccount);
  }

  const { error } = await supabase.from("user_onboarding").upsert({
    user_id: userId,
    selected_roles: next.selectedRoles,
    completed_roles: next.completedRoles,
    active_role: next.activeRole,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return next;
}

export function getPostAuthenticationRoute(onboarding: AccountOnboarding) {
  const active = onboarding.activeRole;
  if (active && onboarding.completedRoles.includes(active)) return routeForRole(active);
  const completed = onboarding.completedRoles;
  if (completed.length === 1) return routeForRole(completed[0]!);
  if (completed.length > 1) return "/role-selection";
  return "/role-selection";
}

export function getOnboardingRoute(role: AccountRole) {
  return role === "athlete" ? "/onboarding" : "/business/register?mode=live";
}

export async function resetAccountOnboardingForTests(): Promise<void> {
  await removeDevelopmentData(`account-onboarding:${getLocalPreviewAccountId()}`);
}

function routeForRole(role: AccountRole) {
  return role === "athlete" ? "/(tabs)" : "/business/dashboard";
}

function cleanRoles(roles: unknown): AccountRole[] {
  if (!Array.isArray(roles)) return [];
  return Array.from(new Set(roles.filter(isAccountRole)));
}

function isAccountRole(value: unknown): value is AccountRole {
  return value === "athlete" || value === "business";
}

function isGrantedAppRole(value: string): value is GrantedAppRole {
  return value === "athlete"
    || value === "coach"
    || value === "venue_owner"
    || value === "moderator"
    || value === "administrator";
}

function copyAccount(account: AccountOnboarding): AccountOnboarding {
  return {
    selectedRoles: [...account.selectedRoles],
    completedRoles: [...account.completedRoles],
    activeRole: account.activeRole,
    grantedRoles: [...account.grantedRoles],
  };
}
