import { afterEach, describe, expect, it } from "vitest";
import {
  getDevelopmentProfile,
  hydrateDevelopmentProfile,
  saveDevelopmentProfile,
} from "./development-profile";

const emptyProfile = {
  displayName: "",
  username: "",
  city: "",
  bio: "",
  visibility: "public" as const,
  skillLevels: {},
  shownSections: ["About", "Sports", "Achievements"],
  selectedInterests: [
    { sportId: "football", role: "playing" as const },
    { sportId: "running", role: "playing" as const },
  ],
};

afterEach(async () => {
  await saveDevelopmentProfile(emptyProfile);
});

describe("development athlete profile", () => {
  it("restores profile details and preferences from local storage", async () => {
    await saveDevelopmentProfile({
      displayName: "Demo Athlete",
      username: "demo_athlete",
      city: "Lahore",
      bio: "Local development profile.",
      visibility: "private",
      selectedInterests: [{ sportId: "cricket", role: "playing" }],
    });

    await hydrateDevelopmentProfile();

    expect(getDevelopmentProfile()).toMatchObject({
      displayName: "Demo Athlete",
      username: "demo_athlete",
      city: "Lahore",
      visibility: "private",
      selectedInterests: [{ sportId: "cricket", role: "playing" }],
    });
  });
});
