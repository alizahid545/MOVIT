import { afterEach, describe, expect, it } from "vitest";
import { flushDevelopmentWrites, persistDevelopmentData } from "./local-development-repository";
import {
  getDevelopmentActivityState,
  hydrateDevelopmentActivities,
  resetDevelopmentActivitiesForTests,
  saveCreatedActivityPreview,
  toggleJoinedDemoActivity,
  toggleSavedDemoVenue,
} from "./development-activity-preview";

afterEach(async () => {
  resetDevelopmentActivitiesForTests();
  await flushDevelopmentWrites();
});

describe("local activity development previews", () => {
  it("persists created drafts and demo join/save interactions", async () => {
    toggleJoinedDemoActivity("activity-1");
    toggleSavedDemoVenue("venue-1");
    saveCreatedActivityPreview({
      title: "Demo futsal game",
      sportId: "football",
      time: "Tomorrow · 7:00 PM",
      place: "Sample sports ground",
    });
    await flushDevelopmentWrites();
    const savedState = getDevelopmentActivityState();

    resetDevelopmentActivitiesForTests();
    await flushDevelopmentWrites();
    toggleJoinedDemoActivity("activity-2");
    await flushDevelopmentWrites();
    persistDevelopmentData("activity-previews", savedState);
    await flushDevelopmentWrites();
    await hydrateDevelopmentActivities();

    const state = getDevelopmentActivityState();
    expect(state.joinedDemoActivityIds).toEqual(["activity-1"]);
    expect(state.savedDemoVenueIds).toEqual(["venue-1"]);
    expect(state.createdActivities[0]?.title).toBe("Demo futsal game");
  });
});
