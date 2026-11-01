import { afterEach, describe, expect, it } from "vitest";
import {
  canViewChallenge,
  canViewProfileContent,
  challengeSchema,
  createPreviewChallenge,
  getChallengeStatus,
  getFollowAction,
  invitePreviewChallengeParticipant,
  joinPreviewChallenge,
  leavePreviewChallenge,
  listPreviewChallengeInvitations,
  reportPreviewChallengeProgress,
  resetChallengePreviewForTests,
  transitionPreviewChallengeInvitation,
  transitionFollowRequest,
  updatePreviewChallenge,
  type ChallengeInput,
  type FollowRelation,
} from "./challenge-preview";
import { searchUniversalDirectory } from "./universal-search";
import { flushDevelopmentWrites, persistDevelopmentData } from "./local-development-repository";
import { hydrateChallengePreview, listPreviewChallenges } from "./challenge-preview";

const validChallenge: ChallengeInput = {
  title: "Weekly movement goal",
  description: "A steady and flexible weekly challenge.",
  sportId: "running",
  startsOn: "2026-10-27",
  endsOn: "2026-11-03",
  metric: "workout_count",
  target: 3,
  unit: "sessions",
  eligibilityRules: "Open to participants able to take part safely.",
  completionRules: "Report completed workouts during the challenge period.",
  rewardType: "none",
  audience: "public",
};

afterEach(resetChallengePreviewForTests);

describe("challenge preview validation and audience", () => {
  it("validates sport IDs, date order, target limits, and participant limits", () => {
    expect(challengeSchema.safeParse(validChallenge).success).toBe(true);
    expect(challengeSchema.safeParse({ ...validChallenge, sportId: "not-a-catalogue-sport" }).success).toBe(false);
    expect(challengeSchema.safeParse({ ...validChallenge, startsOn: "2026-11-05", endsOn: "2026-11-03" }).success).toBe(false);
    expect(challengeSchema.safeParse({ ...validChallenge, target: 2.5 }).success).toBe(false);
    expect(challengeSchema.safeParse({ ...validChallenge, target: 91 }).success).toBe(false);
    expect(challengeSchema.safeParse({ ...validChallenge, participantLimit: 1 }).success).toBe(false);
  });

  it("restores user-created challenges from the persisted local development store", async () => {
    const saved = createPreviewChallenge(validChallenge);
    await flushDevelopmentWrites();
    persistDevelopmentData("challenges", { sequence: 1, challenges: [saved], invitations: [] });
    await flushDevelopmentWrites();
    createPreviewChallenge({ ...validChallenge, title: "Temporary in-memory record" });

    await hydrateChallengePreview();

    expect(listPreviewChallenges().map((challenge) => challenge.id)).toEqual([saved.id]);
  });

  it("restricts friend and invite-only challenges to mutual followers or invitees", () => {
    const challenge = { creatorId: "creator", audience: "friends" as const };
    expect(canViewChallenge(challenge, "viewer")).toBe(false);
    expect(canViewChallenge(challenge, "viewer", ["creator"])).toBe(true);
    expect(canViewChallenge({ ...challenge, audience: "private" }, "viewer", ["creator"])).toBe(false);
    expect(canViewChallenge({ ...challenge, audience: "private" }, "viewer", [], ["viewer"])).toBe(true);
    expect(canViewChallenge({ ...challenge, audience: "private" }, "creator")).toBe(true);
  });

  it("exposes only public user-created challenges to universal search", () => {
    createPreviewChallenge(validChallenge);
    const privateChallenge = createPreviewChallenge({ ...validChallenge, title: "Invite-only plan", audience: "private" });
    const results = searchUniversalDirectory({ text: "", category: "challenges" });
    expect(results.map((result) => result.title)).toContain(validChallenge.title);
    expect(results.map((result) => result.id)).not.toContain(privateChallenge.id);
  });

  it("classifies upcoming, active, expired, completed, and cancelled challenges", () => {
    expect(getChallengeStatus({ startsOn: "2026-10-27", endsOn: "2026-11-03", status: "open" }, "2026-10-26")).toBe("upcoming");
    expect(getChallengeStatus({ startsOn: "2026-10-27", endsOn: "2026-11-03", status: "open" }, "2026-10-30")).toBe("active");
    expect(getChallengeStatus({ startsOn: "2026-10-27", endsOn: "2026-11-03", status: "open" }, "2026-11-04")).toBe("expired");
    expect(getChallengeStatus({ startsOn: "2026-10-27", endsOn: "2026-11-03", status: "completed" }, "2026-10-30")).toBe("completed");
    expect(getChallengeStatus({ startsOn: "2026-10-27", endsOn: "2026-11-03", status: "cancelled" }, "2026-10-30")).toBe("cancelled");
  });

  it("prevents duplicate participation and bounds self-reported progress", () => {
    const challenge = createPreviewChallenge({ ...validChallenge, participantLimit: 2 });
    joinPreviewChallenge(challenge.id, "participant");
    const friendsOnly = createPreviewChallenge({ ...validChallenge, title: "Friends only", audience: "friends" });
    expect(() => joinPreviewChallenge(friendsOnly.id, "participant")).toThrow("not eligible");
    expect(() => joinPreviewChallenge(friendsOnly.id, "participant", ["local-preview-owner"])).not.toThrow();
    const inviteOnly = createPreviewChallenge({ ...validChallenge, title: "Invite only", audience: "private" });
    expect(() => joinPreviewChallenge(inviteOnly.id, "participant")).toThrow("not eligible");
    invitePreviewChallengeParticipant(inviteOnly.id, "local-preview-owner", "participant");
    expect(() => joinPreviewChallenge(inviteOnly.id, "participant", [], ["participant"])).toThrow("Accept the private challenge invitation");
    transitionPreviewChallengeInvitation(inviteOnly.id, "participant", "participant", "accept");
    expect(() => joinPreviewChallenge(inviteOnly.id, "participant", [], ["participant"])).not.toThrow();
    expect(() => joinPreviewChallenge(challenge.id, "participant")).toThrow("already joined");
    expect(() => reportPreviewChallengeProgress(challenge.id, "participant", 4)).toThrow("between zero and the challenge target");
    expect(() => reportPreviewChallengeProgress(challenge.id, "participant", 1.5)).toThrow("whole number");
    expect(reportPreviewChallengeProgress(challenge.id, "participant", 2).progressByParticipant.participant).toBe(2);
    leavePreviewChallenge(challenge.id, "participant");
    expect(() => leavePreviewChallenge(challenge.id, "participant")).toThrow("have not joined");
  });

  it("prevents editing a challenge owned by another identity", () => {
    const challenge = createPreviewChallenge(validChallenge);
    expect(() => updatePreviewChallenge(challenge.id, "other-user", validChallenge)).toThrow("Only the challenge creator");
  });

  it("supports private invitation permission, recipient decisions, cancellation, and removal", () => {
    const challenge = createPreviewChallenge({ ...validChallenge, audience: "private" });
    expect(() => invitePreviewChallengeParticipant(challenge.id, "other", "preview-player-runner")).toThrow("Only the challenge creator");
    const invitation = invitePreviewChallengeParticipant(challenge.id, "local-preview-owner", "preview-player-runner");
    expect(invitation.status).toBe("pending");
    expect(() => invitePreviewChallengeParticipant(challenge.id, "local-preview-owner", "preview-player-runner")).toThrow("already has an active invitation");
    expect(() => transitionPreviewChallengeInvitation(challenge.id, "other", "preview-player-runner", "accept")).toThrow("Only the invited person");
    expect(transitionPreviewChallengeInvitation(challenge.id, "preview-player-runner", "preview-player-runner", "accept").status).toBe("accepted");
    expect(transitionPreviewChallengeInvitation(challenge.id, "local-preview-owner", "preview-player-runner", "remove").status).toBe("removed");
    expect(listPreviewChallengeInvitations(challenge.id)[0]?.status).toBe("removed");

    const second = createPreviewChallenge({ ...validChallenge, title: "Second private invite", audience: "private" });
    invitePreviewChallengeParticipant(second.id, "local-preview-owner", "preview-player-cricket");
    expect(transitionPreviewChallengeInvitation(second.id, "local-preview-owner", "preview-player-cricket", "cancel").status).toBe("cancelled");
    expect(() => transitionPreviewChallengeInvitation(second.id, "preview-player-cricket", "preview-player-cricket", "accept")).toThrow("Only the invited person");
  });

  it("only allows mutual accepted followers to be invited to friends challenges", () => {
    const challenge = createPreviewChallenge({ ...validChallenge, audience: "friends" });
    expect(() => invitePreviewChallengeParticipant(challenge.id, "local-preview-owner", "preview-player-runner")).toThrow("mutual accepted followers");
    expect(invitePreviewChallengeParticipant(challenge.id, "local-preview-owner", "preview-player-runner", ["preview-player-runner"]).status).toBe("pending");
  });

  it("requires a bounded integer for proposed points rewards", () => {
    expect(challengeSchema.safeParse({ ...validChallenge, rewardType: "points" }).success).toBe(false);
    expect(challengeSchema.safeParse({ ...validChallenge, rewardType: "points", rewardPoints: 100 }).success).toBe(true);
    expect(challengeSchema.safeParse({ ...validChallenge, rewardType: "points", rewardPoints: 1001 }).success).toBe(false);
    expect(challengeSchema.safeParse({ ...validChallenge, rewardType: "badge", rewardPoints: 100 }).success).toBe(false);
  });
});

describe("profile privacy and follow transitions", () => {
  it("shows public basic fields but keeps restricted activity private without an approved follow", () => {
    expect(canViewProfileContent("public", "owner", "viewer", null, "basic")).toBe(true);
    expect(canViewProfileContent("public", "owner", "viewer", null, "restricted")).toBe(false);
    expect(canViewProfileContent("private", "owner", "viewer", "pending", "basic")).toBe(false);
    expect(canViewProfileContent("private", "owner", "viewer", "accepted", "restricted")).toBe(true);
    expect(canViewProfileContent("private", "owner", "owner", null, "restricted")).toBe(true);
  });

  it("prevents self and duplicate follows, and creates private requests as pending", () => {
    expect(() => getFollowAction([], "same", "same", "public")).toThrow("own profile");
    const accepted = getFollowAction([], "follower", "public-owner", "public");
    expect(accepted[0].status).toBe("accepted");
    expect(() => getFollowAction(accepted, "follower", "public-owner", "public")).toThrow("already follow");
    const pending = getFollowAction([], "follower", "private-owner", "private");
    expect(pending[0].status).toBe("pending");
    expect(() => getFollowAction(pending, "follower", "private-owner", "private")).toThrow("already pending");
  });

  it("allows only the private profile owner to approve or reject requests", () => {
    const request: FollowRelation = { followerId: "viewer", followedId: "owner", status: "pending" };
    expect(() => transitionFollowRequest(request, "other", "approve")).toThrow("Only the profile owner");
    expect(transitionFollowRequest(request, "owner", "approve")?.status).toBe("accepted");
    expect(transitionFollowRequest(request, "owner", "reject")?.status).toBe("rejected");
    expect(transitionFollowRequest(request, "viewer", "cancel")).toBeNull();
  });
});
