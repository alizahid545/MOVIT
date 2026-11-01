import { afterEach, describe, expect, it } from "vitest";
import {
  getLocalPreviewAccountId,
  getOnboardingRoute,
  getPostAuthenticationRoute,
  loadAccountOnboarding,
  resetAccountOnboardingForTests,
  saveAccountOnboarding,
} from "./account-onboarding";

afterEach(async () => resetAccountOnboardingForTests());

describe("account onboarding preview", () => {
  it("routes a new account to profile selection and role-specific setup", async () => {
    const account = await loadAccountOnboarding(getLocalPreviewAccountId());

    expect(getPostAuthenticationRoute(account)).toBe("/role-selection");
    expect(getOnboardingRoute("athlete")).toBe("/onboarding");
    expect(getOnboardingRoute("business")).toBe("/business/register");
  });

  it("routes returning users to their selected completed profile", async () => {
    const accountId = getLocalPreviewAccountId();
    await saveAccountOnboarding(accountId, {
      selectedRoles: ["athlete"],
      completedRoles: ["athlete"],
      activeRole: "athlete",
    });

    expect(getPostAuthenticationRoute(await loadAccountOnboarding(accountId))).toBe("/(tabs)");
  });

  it("persists role choices and completion for a later app load", async () => {
    const accountId = getLocalPreviewAccountId();
    await saveAccountOnboarding(accountId, {
      selectedRoles: ["athlete"],
      completedRoles: ["athlete"],
      activeRole: "athlete",
    });

    expect(await loadAccountOnboarding(accountId)).toMatchObject({
      selectedRoles: ["athlete"],
      completedRoles: ["athlete"],
      activeRole: "athlete",
    });
  });

  it("offers role selection when both profiles are complete and no active preference is set", async () => {
    const accountId = getLocalPreviewAccountId();
    await saveAccountOnboarding(accountId, {
      selectedRoles: ["athlete", "business"],
      completedRoles: ["athlete", "business"],
      activeRole: null,
    });

    expect(getPostAuthenticationRoute(await loadAccountOnboarding(accountId))).toBe("/role-selection");
  });

  it("routes to the active profile when both profiles are complete", async () => {
    const accountId = getLocalPreviewAccountId();
    await saveAccountOnboarding(accountId, {
      selectedRoles: ["athlete", "business"],
      completedRoles: ["athlete", "business"],
      activeRole: "business",
    });

    expect(getPostAuthenticationRoute(await loadAccountOnboarding(accountId))).toBe("/business/dashboard");
  });

  it("keeps selected business profiles separate from granted permissions", async () => {
    const accountId = getLocalPreviewAccountId();
    const onboarding = await saveAccountOnboarding(accountId, {
      selectedRoles: ["business"],
      completedRoles: [],
      activeRole: "business",
    });

    expect(onboarding.selectedRoles).toEqual(["business"]);
    expect(onboarding.completedRoles).toEqual([]);
    expect(onboarding.grantedRoles).not.toContain("venue_owner");
  });

  it("rejects activating a profile that has not been selected", async () => {
    await expect(saveAccountOnboarding(getLocalPreviewAccountId(), { activeRole: "business" }))
      .rejects.toThrow("Choose an account role before making it active.");
  });

  it("rejects completion of a profile that is not selected", async () => {
    await expect(saveAccountOnboarding(getLocalPreviewAccountId(), { completedRoles: ["business"] }))
      .rejects.toThrow("Complete only profiles selected for this account.");
  });

  it("deduplicates selected and completed profile roles", async () => {
    const onboarding = await saveAccountOnboarding(getLocalPreviewAccountId(), {
      selectedRoles: ["athlete", "athlete"],
      completedRoles: ["athlete", "athlete"],
      activeRole: "athlete",
    });

    expect(onboarding.selectedRoles).toEqual(["athlete"]);
    expect(onboarding.completedRoles).toEqual(["athlete"]);
  });
});
