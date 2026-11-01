import {
  areMutualFollowers,
  getFollowAction,
  transitionFollowRequest,
  type FollowRelation,
  type PreviewProfileVisibility,
} from "./challenge-preview";
import { persistDevelopmentData, readDevelopmentData } from "./local-development-repository";

export type PreviewSocialProfile = {
  id: string;
  username: string;
  displayName: string;
  city: string;
  visibility: PreviewProfileVisibility;
  sportIds: string[];
  bio: string;
};

export const previewSocialProfiles: PreviewSocialProfile[] = [
  {
    id: "preview-player-runner",
    username: "sample_runner",
    displayName: "Sample Runner",
    city: "Lahore · sample area",
    visibility: "public",
    sportIds: ["running", "athletics"],
    bio: "Fictional profile preview. No real player or activity is represented.",
  },
  {
    id: "preview-player-racquet",
    username: "sample_racquet",
    displayName: "Sample Racquet Player",
    city: "Lahore · sample area",
    visibility: "private",
    sportIds: ["badminton", "squash"],
    bio: "Fictional private profile preview. Restricted details are not shown to non-followers.",
  },
  {
    id: "preview-player-cricket",
    username: "sample_cricket",
    displayName: "Sample Cricket Player",
    city: "Lahore · sample area",
    visibility: "public",
    sportIds: ["cricket", "field-hockey"],
    bio: "Fictional profile preview. No real player or activity is represented.",
  },
];

const OWNER_ID = "local-preview-owner";
let relations: FollowRelation[] = [];
let ownerVisibility: PreviewProfileVisibility = "public";
const socialDataKey = "profile-social";

export async function hydrateProfileSocialPreview(): Promise<void> {
  const saved = await readDevelopmentData<{
    relations: FollowRelation[];
    ownerVisibility: PreviewProfileVisibility;
  }>(socialDataKey, { relations: [], ownerVisibility: "public" });
  relations = Array.isArray(saved.relations) ? saved.relations : [];
  ownerVisibility = saved.ownerVisibility === "private" ? "private" : "public";
}

function persistSocialPreview(): void {
  persistDevelopmentData(socialDataKey, { relations, ownerVisibility });
}

export function setPreviewOwnerVisibility(visibility: PreviewProfileVisibility): void {
  ownerVisibility = visibility;
  persistSocialPreview();
}

export function getPreviewOwnerVisibility(): PreviewProfileVisibility {
  return ownerVisibility;
}

export function listPreviewFollowRelations(): FollowRelation[] {
  return [...relations];
}

export function followPreviewProfile(profileId: string): void {
  const profile = previewSocialProfiles.find((item) => item.id === profileId);
  if (!profile) throw new Error("This sample profile is unavailable.");
  relations = getFollowAction(relations, OWNER_ID, profile.id, profile.visibility);
  persistSocialPreview();
}

export function requestFollowPreviewOwner(profileId: string): void {
  if (!previewSocialProfiles.some((item) => item.id === profileId)) throw new Error("This sample profile is unavailable.");
  relations = getFollowAction(relations, profileId, OWNER_ID, ownerVisibility);
  persistSocialPreview();
}

export function decidePreviewFollowRequest(
  profileId: string,
  decision: "approve" | "reject",
): void {
  const relation = relations.find((item) => item.followerId === profileId && item.followedId === OWNER_ID && item.status === "pending");
  if (!relation) throw new Error("There is no pending follow request from this sample profile.");
  const updated = transitionFollowRequest(relation, OWNER_ID, decision);
  if (updated) relations = relations.map((item) => item === relation ? updated : item);
  persistSocialPreview();
}

export function removePreviewFollower(profileId: string): void {
  const relation = relations.find((item) => item.followerId === profileId && item.followedId === OWNER_ID && item.status === "accepted");
  if (!relation) throw new Error("This sample profile is not an accepted follower.");
  relations = relations.filter((item) => item !== relation);
  persistSocialPreview();
}

export function removePreviewFollowing(profileId: string): void {
  const relation = relations.find((item) => item.followerId === OWNER_ID && item.followedId === profileId);
  if (!relation) throw new Error("There is no follow relationship to remove.");
  const updated = transitionFollowRequest(relation, OWNER_ID, relation.status === "pending" ? "cancel" : "unfollow");
  if (updated) relations = relations.map((item) => item === relation ? updated : item);
  else relations = relations.filter((item) => item !== relation);
  persistSocialPreview();
}

export function getPreviewFollowStatus(profileId: string, ownerId = OWNER_ID): FollowRelation["status"] | null {
  return relations.find((item) => item.followerId === ownerId && item.followedId === profileId)?.status ?? null;
}

export function getPreviewProfileCounts(profileId = OWNER_ID) {
  return {
    followers: relations.filter((item) => item.followedId === profileId && item.status === "accepted").length,
    following: relations.filter((item) => item.followerId === profileId && item.status === "accepted").length,
    incomingRequests: relations.filter((item) => item.followedId === profileId && item.status === "pending").length,
  };
}

export function previewProfileCanViewRestricted(profileId: string): boolean {
  const profile = previewSocialProfiles.find((item) => item.id === profileId);
  if (!profile) return false;
  const status = getPreviewFollowStatus(profileId);
  return profile.visibility === "public" || status === "accepted";
}

export function previewAreFriends(profileId: string): boolean {
  return areMutualFollowers(relations, OWNER_ID, profileId);
}

export function resetProfileSocialPreviewForTests(): void {
  relations = [];
  ownerVisibility = "public";
  persistSocialPreview();
}
