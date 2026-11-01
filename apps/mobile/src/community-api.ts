import {
  communityPostSchema,
  type CommunityPost,
  type ConnectionStatus,
  type PlayerConnectionView,
  type PublicPlayerProfile,
} from "@moveit/shared";
import { createCommunityPlatformRepository, SUPABASE_SETUP_ERROR } from "@moveit/supabase";
import { supabase } from "./supabase";
import { localCommunityRepository, type LocalCommunityComment } from "./local-community-repository";

export const COMMUNITY_PAGE_SIZE = 20;

export type FeedCursor = Pick<CommunityPost, "created_at" | "id">;

export type CommunityFeedPage = {
  posts: CommunityPost[];
  nextCursor: FeedCursor | null;
};

export type ConnectionView = PlayerConnectionView;

export type SuggestedPlayer = PublicPlayerProfile & {
  connection: ConnectionView | null;
};

export type PlayerDetail = PublicPlayerProfile & {
  connection: ConnectionView | null;
};

export class CommunitySessionError extends Error {
  constructor(message = "Your sign-in session has expired. Sign in again to continue.") {
    super(message);
    this.name = "CommunitySessionError";
  }
}

const postSelect =
  "id,author_id,body,created_at,author:profiles!posts_author_id_fkey(id,username,display_name,city)";

function client() {
  if (!supabase) throw new Error(SUPABASE_SETUP_ERROR);
  return supabase;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new Error(`The server returned an invalid ${key} value.`);
  return value;
}

function parsePlayer(value: unknown): PublicPlayerProfile {
  if (!isRecord(value)) throw new Error("The server returned an invalid player profile.");
  return {
    id: requiredString(value, "id"),
    username: requiredString(value, "username"),
    display_name: requiredString(value, "display_name"),
    city: requiredString(value, "city"),
    bio: typeof value.bio === "string" ? value.bio : "",
  };
}

function parsePost(value: unknown): CommunityPost {
  if (!isRecord(value)) throw new Error("The server returned an invalid post.");
  let author: CommunityPost["author"] = null;
  const authorValue = Array.isArray(value.author) ? value.author[0] : value.author;
  if (isRecord(authorValue)) {
    const authorId = authorValue.id;
    const username = authorValue.username;
    const displayName = authorValue.display_name;
    const city = authorValue.city;
    if (
      typeof authorId === "string" &&
      typeof username === "string" &&
      typeof displayName === "string" &&
      typeof city === "string"
    ) {
      author = { id: authorId, username, display_name: displayName, city };
    }
  }
  return {
    id: requiredString(value, "id"),
    author_id: requiredString(value, "author_id"),
    body: typeof value.body === "string" ? value.body : "",
    created_at: requiredString(value, "created_at"),
    author,
  };
}

export async function hasCommunitySession(): Promise<boolean> {
  if (!supabase) return true;
  return (await currentUserId()) !== null;
}

export function isLocalCommunityPreview(): boolean {
  return !supabase;
}

async function currentUserId(): Promise<string | null> {
  const { data, error } = await client().auth.getUser();
  if (error) {
    if (error.message.toLowerCase().includes("session missing")) return null;
    throw new Error(error.message);
  }
  return data.user?.id ?? null;
}

export async function loadCommunityFeed(cursor?: FeedCursor | null): Promise<CommunityFeedPage | null> {
  if (!supabase) {
    const posts = await localCommunityRepository.loadFeed();
    const cursorIndex = cursor
      ? posts.findIndex((post) => post.created_at === cursor.created_at && post.id === cursor.id)
      : -1;
    const start = cursor && cursorIndex < 0 ? posts.length : cursorIndex + 1;
    const pagePosts = posts.slice(start, start + COMMUNITY_PAGE_SIZE);
    const hasMore = posts.length > start + COMMUNITY_PAGE_SIZE;
    const lastPost = pagePosts.at(-1);
    return {
      posts: pagePosts,
      nextCursor: hasMore && lastPost ? { created_at: lastPost.created_at, id: lastPost.id } : null,
    };
  }

  const userId = await currentUserId();
  if (!userId) return null;

  let query = client()
    .from("posts")
    .select(postSelect)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(COMMUNITY_PAGE_SIZE + 1);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).map(parsePost);
  const hasMore = rows.length > COMMUNITY_PAGE_SIZE;
  const posts = rows.slice(0, COMMUNITY_PAGE_SIZE);
  const lastPost = posts.at(-1);

  return {
    posts,
    nextCursor: hasMore && lastPost
      ? { created_at: lastPost.created_at, id: lastPost.id }
      : null,
  };
}

export async function createCommunityPost(body: string): Promise<void> {
  const validated = communityPostSchema.parse({ body });
  if (!supabase) {
    await localCommunityRepository.createPost(validated.body);
    return;
  }

  await createCommunityPlatformRepository(client()).createCommunityPost(validated.body);
}

export async function updateCommunityPost(postId: string, body: string): Promise<void> {
  const validated = communityPostSchema.parse({ body });
  if (!supabase) {
    await localCommunityRepository.updatePost(postId, validated.body);
    return;
  }
  await createCommunityPlatformRepository(client()).updateCommunityPost(postId, validated.body);
}

export async function deleteCommunityPost(postId: string): Promise<void> {
  if (!supabase) {
    await localCommunityRepository.deletePost(postId);
    return;
  }
  await createCommunityPlatformRepository(client()).deleteCommunityPost(postId);
}

export async function getCommunityPost(postId: string): Promise<CommunityPost | null> {
  if (!supabase) return localCommunityRepository.getPost(postId);
  return createCommunityPlatformRepository(client()).loadCommunityPost(postId);
}

export async function toggleLocalPostLike(postId: string): Promise<boolean> {
  if (!supabase) return localCommunityRepository.toggleLike(postId);
  throw new Error("Likes are not connected for community accounts yet.");
}

export async function toggleLocalPostBookmark(postId: string): Promise<boolean> {
  if (!supabase) return localCommunityRepository.toggleBookmark(postId);
  throw new Error("Bookmarks are not connected for community accounts yet.");
}

export async function addLocalPostComment(postId: string, body: string): Promise<LocalCommunityComment> {
  if (!supabase) return localCommunityRepository.addComment(postId, body);
  throw new Error("Comments are not connected for community accounts yet.");
}

export function getLocalPostComments(postId: string): LocalCommunityComment[] {
  return localCommunityRepository.getComments(postId);
}

export function getLocalPostInteractions(): { likedPostIds: string[]; bookmarkedPostIds: string[] } {
  return {
    likedPostIds: localCommunityRepository.getLikedPostIds(),
    bookmarkedPostIds: localCommunityRepository.getBookmarkedPostIds(),
  };
}

export async function loadSuggestedPlayers(): Promise<{
  userId: string;
  players: SuggestedPlayer[];
} | null> {
  if (!supabase) return null;
  const userId = await currentUserId();
  if (!userId) return null;

  const { data, error } = await client()
    .from("profiles")
    .select("id,username,display_name,city,bio")
    .neq("id", userId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(COMMUNITY_PAGE_SIZE);
  if (error) throw new Error(error.message);

  const profiles = (data ?? []).map(parsePlayer);
  const connections = await createCommunityPlatformRepository(client())
    .loadPlayerConnections(profiles.map((profile) => profile.id));
  return {
    userId,
    players: profiles.map((profile) => ({
      ...profile,
      connection: connections.get(profile.id) ?? null,
    })),
  };
}

export async function loadPlayerDetail(playerId: string): Promise<PlayerDetail | null> {
  const userId = await currentUserId();
  if (!userId) throw new CommunitySessionError("Sign in to view player profiles.");
  if (playerId === userId) throw new Error("This is your profile. Open your Profile tab instead.");

  const [profileResult, connections] = await Promise.all([
    client()
      .from("profiles")
      .select("id,username,display_name,city,bio")
      .eq("id", playerId)
      .maybeSingle(),
    createCommunityPlatformRepository(client()).loadPlayerConnections([playerId]),
  ]);
  if (profileResult.error) throw new Error(profileResult.error.message);
  if (!profileResult.data) return null;

  const profile = parsePlayer(profileResult.data);
  return {
    ...profile,
    connection: connections.get(playerId) ?? null,
  };
}

export async function requestPlayerConnection(playerId: string): Promise<void> {
  await createCommunityPlatformRepository(client()).requestPlayerConnection(playerId);
}

export async function cancelPlayerConnection(connectionId: string): Promise<void> {
  await createCommunityPlatformRepository(client()).cancelPlayerConnection(connectionId);
}

export async function respondToPlayerConnection(
  connectionId: string,
  status: Extract<ConnectionStatus, "accepted" | "rejected">,
): Promise<void> {
  await createCommunityPlatformRepository(client()).respondToPlayerConnection(connectionId, status);
}
