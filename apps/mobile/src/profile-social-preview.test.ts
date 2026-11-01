import { afterEach, describe, expect, it } from "vitest";
import { flushDevelopmentWrites, persistDevelopmentData } from "./local-development-repository";
import {
  decidePreviewFollowRequest,
  followPreviewProfile,
  getPreviewFollowStatus,
  getPreviewOwnerVisibility,
  getPreviewProfileCounts,
  hydrateProfileSocialPreview,
  listPreviewFollowRelations,
  previewAreFriends,
  previewProfileCanViewRestricted,
  removePreviewFollower,
  removePreviewFollowing,
  requestFollowPreviewOwner,
  resetProfileSocialPreviewForTests,
  setPreviewOwnerVisibility,
} from "./profile-social-preview";

afterEach(resetProfileSocialPreviewForTests);

describe("local profile follow preview", () => {
  it("creates a public follow immediately and prevents duplicate follows", () => {
    followPreviewProfile("preview-player-runner");
    expect(getPreviewFollowStatus("preview-player-runner")).toBe("accepted");
    expect(getPreviewProfileCounts().following).toBe(1);
    expect(() => followPreviewProfile("preview-player-runner")).toThrow("already follow");
    removePreviewFollowing("preview-player-runner");
    expect(getPreviewProfileCounts().following).toBe(0);
  });

  it("sends pending requests to private profiles and supports cancellation", () => {
    followPreviewProfile("preview-player-racquet");
    expect(getPreviewFollowStatus("preview-player-racquet")).toBe("pending");
    expect(previewProfileCanViewRestricted("preview-player-racquet")).toBe(false);
    expect(getPreviewProfileCounts().following).toBe(0);
    removePreviewFollowing("preview-player-racquet");
    expect(getPreviewFollowStatus("preview-player-racquet")).toBeNull();
  });

  it("allows a private profile owner to approve, reject, or remove followers", () => {
    setPreviewOwnerVisibility("private");
    expect(getPreviewOwnerVisibility()).toBe("private");
    requestFollowPreviewOwner("preview-player-runner");
    expect(getPreviewProfileCounts().incomingRequests).toBe(1);
    decidePreviewFollowRequest("preview-player-runner", "approve");
    expect(getPreviewProfileCounts().followers).toBe(1);
    removePreviewFollower("preview-player-runner");
    expect(getPreviewProfileCounts().followers).toBe(0);

    requestFollowPreviewOwner("preview-player-cricket");
    decidePreviewFollowRequest("preview-player-cricket", "reject");
    expect(getPreviewProfileCounts().incomingRequests).toBe(0);
    expect(listPreviewFollowRelations().find((relation) => relation.followerId === "preview-player-cricket")?.status).toBe("rejected");
  });

  it("defines friends as mutual accepted follows, not one-way follows", () => {
    followPreviewProfile("preview-player-runner");
    expect(previewAreFriends("preview-player-runner")).toBe(false);
    requestFollowPreviewOwner("preview-player-runner");
    expect(previewAreFriends("preview-player-runner")).toBe(true);
  });

  it("restores visibility and sample follow relationships from local storage", async () => {
    setPreviewOwnerVisibility("private");
    requestFollowPreviewOwner("preview-player-runner");
    await flushDevelopmentWrites();
    const savedRelations = listPreviewFollowRelations();

    setPreviewOwnerVisibility("public");
    await flushDevelopmentWrites();
    persistDevelopmentData("profile-social", { relations: savedRelations, ownerVisibility: "private" });
    await flushDevelopmentWrites();
    await hydrateProfileSocialPreview();

    expect(getPreviewOwnerVisibility()).toBe("private");
    expect(getPreviewProfileCounts().incomingRequests).toBe(1);
  });
});
