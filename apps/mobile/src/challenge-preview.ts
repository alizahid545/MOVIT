import { z } from "zod";
import { sportsCatalogue } from "./sports-catalogue";
import { persistDevelopmentData, readDevelopmentData } from "./local-development-repository";

export const challengeAudienceSchema = z.enum(["public", "friends", "private"]);
export type ChallengeAudience = z.infer<typeof challengeAudienceSchema>;
export type ChallengeStatus = "upcoming" | "active" | "completed" | "cancelled" | "expired";
export type ChallengeMetric = "workout_count" | "duration_minutes" | "distance_meters" | "steps" | "custom";
export type ChallengeRewardType = "none" | "badge" | "points" | "achievement";

export const challengeSchema = z.object({
  title: z.string().trim().min(3, "Use at least 3 characters for the title.").max(80),
  description: z.string().trim().min(1, "Add a short description.").max(800),
  sportId: z.string().refine((id) => sportsCatalogue.some((sport) => sport.id === id), "Choose a sport from the catalogue."),
  startsOn: z.string().date("Enter a valid start date."),
  endsOn: z.string().date("Enter a valid end date."),
  metric: z.enum(["workout_count", "duration_minutes", "distance_meters", "steps", "custom"]),
  target: z.number().positive().finite().max(100000000),
  unit: z.string().trim().min(1).max(24),
  eligibilityRules: z.string().trim().min(1, "Describe who can participate.").max(500),
  completionRules: z.string().trim().min(1, "Describe how completion is counted.").max(500),
  participantLimit: z.number().int().min(2).max(10000).optional(),
  rewardType: z.enum(["none", "badge", "points", "achievement"]).default("none"),
  rewardPoints: z.number().int().min(1).max(1000).optional(),
  reward: z.string().trim().max(120).optional(),
  audience: challengeAudienceSchema,
}).superRefine((value, context) => {
  if (value.startsOn >= value.endsOn) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endsOn"], message: "End date must be after start date." });
  }
  if (value.metric === "workout_count" || value.metric === "steps" || value.metric === "duration_minutes") {
    if (!Number.isInteger(value.target)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["target"], message: "Use a whole number for this goal." });
    }
  }
  if (value.metric === "workout_count" && value.target > 90) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["target"], message: "Keep workout-count challenges to 90 or fewer sessions." });
  }
  if (value.rewardType === "points" && value.rewardPoints === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["rewardPoints"], message: "Choose a proposed points amount." });
  }
  if (value.rewardType !== "points" && value.rewardPoints !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["rewardPoints"], message: "Points can only be set for a points reward." });
  }
});

export type ChallengeInput = z.infer<typeof challengeSchema>;

export type PreviewChallengeRecord = ChallengeInput & {
  id: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  status: "open" | "completed" | "cancelled";
  participantIds: string[];
  progressByParticipant: Record<string, number>;
};

export type FollowStatus = "pending" | "accepted" | "rejected" | "cancelled";
export type FollowRelation = {
  followerId: string;
  followedId: string;
  status: FollowStatus;
};
export type ChallengeInvitationStatus = "pending" | "accepted" | "rejected" | "cancelled" | "removed";
export type PreviewChallengeInvitation = {
  challengeId: string;
  inviteeId: string;
  inviterId: string;
  status: ChallengeInvitationStatus;
  createdAt: string;
  updatedAt: string;
};

export type PreviewProfileVisibility = "public" | "private";
export type ProfileContent = "basic" | "restricted";

const PREVIEW_OWNER_ID = "local-preview-owner";
let challengeSequence = 0;
let challenges: PreviewChallengeRecord[] = [];
let challengeInvitations: PreviewChallengeInvitation[] = [];
const challengeDataKey = "challenges";

export async function hydrateChallengePreview(): Promise<void> {
  const saved = await readDevelopmentData<{
    sequence: number;
    challenges: PreviewChallengeRecord[];
    invitations: PreviewChallengeInvitation[];
  }>(challengeDataKey, { sequence: 0, challenges: [], invitations: [] });
  challengeSequence = Number.isInteger(saved.sequence) && saved.sequence >= 0 ? saved.sequence : 0;
  challenges = Array.isArray(saved.challenges) ? saved.challenges : [];
  challengeInvitations = Array.isArray(saved.invitations) ? saved.invitations : [];
}

function persistChallenges(): void {
  persistDevelopmentData(challengeDataKey, {
    sequence: challengeSequence,
    challenges,
    invitations: challengeInvitations,
  });
}

export function getPreviewOwnerId(): string {
  return PREVIEW_OWNER_ID;
}

export function listPreviewChallenges(): PreviewChallengeRecord[] {
  return [...challenges].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function listPreviewChallengeInvitations(challengeId?: string): PreviewChallengeInvitation[] {
  return challengeInvitations
    .filter((invitation) => !challengeId || invitation.challengeId === challengeId)
    .map((invitation) => ({ ...invitation }));
}

export function invitePreviewChallengeParticipant(
  challengeId: string,
  inviterId: string,
  inviteeId: string,
  mutualFriendIds: string[] = [],
): PreviewChallengeInvitation {
  const challenge = challenges.find((item) => item.id === challengeId);
  if (!challenge || challenge.creatorId !== inviterId) throw new Error("Only the challenge creator can invite participants.");
  if (challenge.status !== "open") throw new Error("This challenge is no longer accepting invitations.");
  if (challenge.audience === "public") throw new Error("Public challenges do not need invitations.");
  if (!inviteeId || inviteeId === inviterId) throw new Error("Choose another person to invite.");
  if (challenge.audience === "friends" && !mutualFriendIds.includes(inviteeId)) {
    throw new Error("Only mutual accepted followers can be invited to a friends challenge.");
  }
  const existing = challengeInvitations.find((item) => item.challengeId === challengeId && item.inviteeId === inviteeId);
  if (existing && ["pending", "accepted"].includes(existing.status)) throw new Error("This person already has an active invitation.");
  const now = new Date().toISOString();
  const invitation: PreviewChallengeInvitation = {
    challengeId,
    inviteeId,
    inviterId,
    status: "pending",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (existing) challengeInvitations = challengeInvitations.map((item) => item === existing ? invitation : item);
  else challengeInvitations = [...challengeInvitations, invitation];
  persistChallenges();
  return { ...invitation };
}

export function transitionPreviewChallengeInvitation(
  challengeId: string,
  actorId: string,
  inviteeId: string,
  action: "accept" | "reject" | "cancel" | "remove",
): PreviewChallengeInvitation {
  const invitation = challengeInvitations.find((item) => item.challengeId === challengeId && item.inviteeId === inviteeId);
  if (!invitation) throw new Error("This challenge invitation was not found.");
  const isCreator = actorId === invitation.inviterId;
  if (action === "accept" || action === "reject") {
    if (actorId !== inviteeId || invitation.status !== "pending") {
      throw new Error("Only the invited person can decide a pending invitation.");
    }
  } else if (!isCreator) {
    throw new Error("Only the challenge creator can cancel or remove an invitation.");
  } else if (action === "cancel" && invitation.status !== "pending") {
    throw new Error("Only pending invitations can be cancelled.");
  } else if (action === "remove" && !["pending", "accepted"].includes(invitation.status)) {
    throw new Error("Only an active invitation can be removed.");
  }
  const updated: PreviewChallengeInvitation = {
    ...invitation,
    status: action === "accept" ? "accepted" : action === "reject" ? "rejected" : action === "cancel" ? "cancelled" : "removed",
    updatedAt: new Date().toISOString(),
  };
  challengeInvitations = challengeInvitations.map((item) => item === invitation ? updated : item);
  persistChallenges();
  return { ...updated };
}

export function createPreviewChallenge(input: unknown): PreviewChallengeRecord {
  const value = challengeSchema.parse(input);
  const now = new Date().toISOString();
  challengeSequence += 1;
  const record: PreviewChallengeRecord = {
    ...value,
    id: `preview-challenge-${challengeSequence}`,
    creatorId: PREVIEW_OWNER_ID,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    status: "open",
    participantIds: [],
    progressByParticipant: {},
  };
  challenges = [record, ...challenges];
  persistChallenges();
  return record;
}

export function updatePreviewChallenge(id: string, creatorId: string, input: unknown): PreviewChallengeRecord {
  const existing = challenges.find((challenge) => challenge.id === id);
  if (!existing || existing.creatorId !== creatorId) throw new Error("Only the challenge creator can edit this challenge.");
  if (existing.status !== "open") throw new Error("This challenge can no longer be edited.");
  const value = challengeSchema.parse(input);
  const updated = { ...existing, ...value, updatedAt: new Date().toISOString() };
  challenges = challenges.map((challenge) => challenge.id === id ? updated : challenge);
  persistChallenges();
  return updated;
}

export function setPreviewChallengeStatus(
  id: string,
  actorId: string,
  status: "completed" | "cancelled",
): PreviewChallengeRecord {
  const existing = challenges.find((challenge) => challenge.id === id);
  if (!existing || existing.creatorId !== actorId) throw new Error("Only the challenge creator can manage this challenge.");
  if (existing.status !== "open") throw new Error("This challenge is no longer open.");
  if (status === "completed" && !["active", "expired"].includes(getChallengeStatus(existing))) {
    throw new Error("A challenge can only be completed after its start date.");
  }
  const updated = {
    ...existing,
    status,
    completedAt: status === "completed" ? new Date().toISOString() : existing.completedAt,
    updatedAt: new Date().toISOString(),
  };
  challenges = challenges.map((challenge) => challenge.id === id ? updated : challenge);
  persistChallenges();
  return updated;
}

export function joinPreviewChallenge(
  id: string,
  participantId: string,
  mutualFriendIds: string[] = [],
  invitedUserIds: string[] = [],
): PreviewChallengeRecord {
  const challenge = requireOpenChallenge(id);
  if (challenge.status !== "open") throw new Error("This challenge is not accepting participants.");
  if (!canViewChallenge(challenge, participantId, mutualFriendIds, invitedUserIds)) {
    throw new Error("You are not eligible to join this challenge.");
  }
  if (challenge.audience === "private" && challenge.creatorId !== participantId &&
    !challengeInvitations.some((invitation) =>
      invitation.challengeId === id && invitation.inviteeId === participantId && invitation.status === "accepted",
    )) {
    throw new Error("Accept the private challenge invitation before joining.");
  }
  if (challenge.participantIds.includes(participantId)) throw new Error("You already joined this challenge.");
  if (challenge.participantLimit && challenge.participantIds.length >= challenge.participantLimit) {
    throw new Error("This challenge has reached its participant limit.");
  }
  const updated = {
    ...challenge,
    participantIds: [...challenge.participantIds, participantId],
    progressByParticipant: { ...challenge.progressByParticipant, [participantId]: 0 },
    updatedAt: new Date().toISOString(),
  };
  challenges = challenges.map((item) => item.id === id ? updated : item);
  persistChallenges();
  return updated;
}

export function leavePreviewChallenge(id: string, participantId: string): PreviewChallengeRecord {
  const challenge = requireOpenChallenge(id);
  if (!challenge.participantIds.includes(participantId)) throw new Error("You have not joined this challenge.");
  const { [participantId]: _removed, ...progressByParticipant } = challenge.progressByParticipant;
  const updated = {
    ...challenge,
    participantIds: challenge.participantIds.filter((participant) => participant !== participantId),
    progressByParticipant,
    updatedAt: new Date().toISOString(),
  };
  challenges = challenges.map((item) => item.id === id ? updated : item);
  persistChallenges();
  return updated;
}

export function reportPreviewChallengeProgress(id: string, participantId: string, value: number): PreviewChallengeRecord {
  const challenge = requireOpenChallenge(id);
  if (!challenge.participantIds.includes(participantId)) throw new Error("Join this challenge before reporting progress.");
  if (!Number.isFinite(value) || value < 0 || value > challenge.target) throw new Error("Progress must be between zero and the challenge target.");
  if ((challenge.metric === "workout_count" || challenge.metric === "steps" || challenge.metric === "duration_minutes") && !Number.isInteger(value)) {
    throw new Error("Progress for this metric must be a whole number.");
  }
  const updated = {
    ...challenge,
    progressByParticipant: { ...challenge.progressByParticipant, [participantId]: value },
    updatedAt: new Date().toISOString(),
  };
  challenges = challenges.map((item) => item.id === id ? updated : item);
  persistChallenges();
  return updated;
}

export function getChallengeStatus(
  challenge: Pick<PreviewChallengeRecord, "startsOn" | "endsOn" | "status">,
  today = new Date().toISOString().slice(0, 10),
): ChallengeStatus {
  if (challenge.status === "cancelled") return "cancelled";
  if (challenge.status === "completed") return "completed";
  if (today < challenge.startsOn) return "upcoming";
  if (today > challenge.endsOn) return "expired";
  return "active";
}

export function canViewChallenge(
  challenge: Pick<PreviewChallengeRecord, "creatorId" | "audience">,
  viewerId: string,
  mutualFriendIds: string[] = [],
  invitedUserIds: string[] = [],
): boolean {
  if (challenge.creatorId === viewerId) return true;
  if (challenge.audience === "public") return true;
  if (challenge.audience === "friends") return mutualFriendIds.includes(challenge.creatorId);
  return invitedUserIds.includes(viewerId);
}

export function canViewProfileContent(
  visibility: PreviewProfileVisibility,
  ownerId: string,
  viewerId: string,
  followStatus: FollowStatus | null,
  content: ProfileContent,
): boolean {
  if (ownerId === viewerId) return true;
  if (content === "basic") return visibility === "public";
  return followStatus === "accepted";
}

export function getFollowAction(
  existing: FollowRelation[],
  followerId: string,
  followedId: string,
  targetVisibility: PreviewProfileVisibility,
): FollowRelation[] {
  if (followerId === followedId) throw new Error("You cannot follow your own profile.");
  const pair = existing.find((relation) => relation.followerId === followerId && relation.followedId === followedId);
  if (pair?.status === "accepted") {
    throw new Error("You already follow this profile.");
  }
  if (pair?.status === "pending") {
    throw new Error("A follow request is already pending.");
  }
  const status = targetVisibility === "private" ? "pending" : "accepted";
  if (pair) {
    return existing.map((relation) => relation === pair ? { ...relation, status } : relation);
  }
  return [
    ...existing,
    { followerId, followedId, status },
  ];
}

export function transitionFollowRequest(
  relation: FollowRelation,
  actorId: string,
  action: "approve" | "reject" | "cancel" | "unfollow",
): FollowRelation | null {
  if (action === "approve" || action === "reject") {
    if (relation.followedId !== actorId || relation.status !== "pending") throw new Error("Only the profile owner can decide a pending follow request.");
    return { ...relation, status: action === "approve" ? "accepted" : "rejected" };
  }
  if (relation.followerId !== actorId) throw new Error("Only the requesting follower can cancel or unfollow.");
  if (action === "cancel" && relation.status !== "pending") throw new Error("Only pending requests can be cancelled.");
  if (action === "unfollow" && relation.status !== "accepted") throw new Error("There is no accepted follow to remove.");
  return null;
}

export function areMutualFollowers(relations: FollowRelation[], firstId: string, secondId: string): boolean {
  return relations.some((item) => item.followerId === firstId && item.followedId === secondId && item.status === "accepted") &&
    relations.some((item) => item.followerId === secondId && item.followedId === firstId && item.status === "accepted");
}

function requireOpenChallenge(id: string): PreviewChallengeRecord {
  const challenge = challenges.find((item) => item.id === id);
  if (!challenge) throw new Error("Challenge not found.");
  if (challenge.status !== "open") throw new Error("This challenge is not active.");
  return challenge;
}

export function resetChallengePreviewForTests(): void {
  challenges = [];
  challengeSequence = 0;
  challengeInvitations = [];
  persistChallenges();
}
