import {
  activityInputSchema,
  activitySearchSchema,
  communityPostSchema,
  getPlayerConnectionView,
  postCommentSchema,
  type ActivityInput,
  type ActivityRecord,
  type ActivitySearchInput,
  type CommunityPost,
  type DiscoveredAthlete,
  type PostComment,
  type PlayerConnectionRecord,
  type PlayerConnectionView,
} from "@moveit/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlatformErrorCode =
  | "AUTH_REQUIRED"
  | "VALIDATION"
  | "DISCOVERY_FAILED"
  | "ACTIVITY_LOAD_FAILED"
  | "ACTIVITY_SAVE_FAILED"
  | "ACTIVITY_JOIN_FAILED"
  | "ACTIVITY_LEAVE_FAILED"
  | "SOCIAL_ACTION_FAILED";

export type ActivityParticipant = {
  userId: string;
  joinedAt: string;
  profile: { id: string; username: string; display_name: string; city: string } | null;
};

export type PlatformNotification = {
  id: string;
  actorId: string | null;
  type:
    | "post_like"
    | "post_comment"
    | "new_follower"
    | "connection_request"
    | "connection_accepted"
    | "venue_inquiry"
    | "coach_inquiry";
  entityId: string;
  createdAt: string;
  readAt: string | null;
  actor: { username: string; display_name: string } | null;
};

export type MySocialSummary = {
  followers: number;
  following: number;
  connections: number;
  posts: number;
  unreadNotifications: number;
};

export class PlatformRepositoryError extends Error {
  constructor(readonly code: PlatformErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PlatformRepositoryError";
  }
}

type ActivityRow = {
  id: string;
  organizer_id: string;
  sport_id: string;
  title: string;
  description: string;
  starts_at: string;
  ends_at: string | null;
  venue_name: string;
  city: string;
  capacity: number;
  required_skill_level: ActivityInput["requiredSkillLevel"];
  visibility: ActivityInput["visibility"];
  status: ActivityRecord["status"];
  participant_count?: number;
  current_user_joined?: boolean;
  created_at?: string;
  updated_at?: string;
  activity_participants?: Array<{ count: number }>;
};

type AthleteRow = {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  city: string;
  avatar_object_path: string | null;
};

type CommentRow = {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: unknown;
};

const activityColumns =
  "id,organizer_id,sport_id,title,description,starts_at,ends_at,venue_name,city,capacity,required_skill_level,visibility,status,created_at,updated_at,activity_participants(count)";

function firstIssue(error: { issues?: Array<{ message: string }> }, fallback: string) {
  return error.issues?.[0]?.message ?? fallback;
}

function mapActivity(row: ActivityRow, joined = false): ActivityRecord {
  return {
    id: row.id,
    organizerId: row.organizer_id,
    sportId: row.sport_id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    venueName: row.venue_name,
    city: row.city,
    capacity: row.capacity,
    requiredSkillLevel: row.required_skill_level,
    visibility: row.visibility,
    status: row.status,
    participantCount: row.participant_count ?? row.activity_participants?.[0]?.count ?? 0,
    joinedByCurrentUser: joined || Boolean(row.current_user_joined),
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

function mapAthlete(row: AthleteRow, client: SupabaseClient): DiscoveredAthlete {
  const avatarPublicUrl = row.avatar_object_path
    ? client.storage.from("moveit-avatars").getPublicUrl(row.avatar_object_path).data.publicUrl
    : null;
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name,
    bio: row.bio,
    city: row.city,
    avatarObjectPath: row.avatar_object_path,
    avatarPublicUrl,
  };
}

function mapPost(value: unknown): CommunityPost {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", "The server returned an invalid community post.");
  }
  const row = value as Record<string, unknown>;
  const authorValue = Array.isArray(row.author) ? row.author[0] : row.author;
  const author = authorValue && typeof authorValue === "object" && !Array.isArray(authorValue)
    ? authorValue as Record<string, unknown>
    : null;
  const requiredPostString = (key: string) => {
    const field = row[key];
    if (typeof field !== "string") {
      throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", `The server returned an invalid post ${key}.`);
    }
    return field;
  };
  let mappedAuthor: CommunityPost["author"] = null;
  if (author) {
    if (
      typeof author.id !== "string"
      || typeof author.username !== "string"
      || typeof author.display_name !== "string"
      || typeof author.city !== "string"
    ) {
      throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", "The server returned an invalid post author.");
    }
    mappedAuthor = {
      id: author.id,
      username: author.username,
      display_name: author.display_name,
      city: author.city,
    };
  }
  return {
    id: requiredPostString("id"),
    author_id: requiredPostString("author_id"),
    body: requiredPostString("body"),
    created_at: requiredPostString("created_at"),
    author: mappedAuthor,
  };
}

export function createCommunityPlatformRepository(client: SupabaseClient) {
  async function currentUserId(): Promise<string> {
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      throw new PlatformRepositoryError(
        "AUTH_REQUIRED",
        "Sign in to use MOVEIT community features.",
        error ? { cause: error } : undefined,
      );
    }
    return data.user.id;
  }

  async function runRpc(
    name: string,
    params: Record<string, unknown>,
    code: PlatformErrorCode,
  ): Promise<unknown> {
    const userId = await currentUserId();
    const { data, error } = await client.rpc(name, params);
    if (error) {
      const message = error.message.toLowerCase();
      const friendly = message.includes("full")
        ? "This activity is full."
        : message.includes("already joined")
          ? "You have already joined this activity."
          : message.includes("skill level")
            ? "Your saved skill level does not meet this activity requirement."
            : error.message;
      throw new PlatformRepositoryError(code, friendly, { cause: error });
    }
    return data;
  }

  async function loadJoinedActivityIds(activityIds: string[], userId: string): Promise<Set<string>> {
    if (activityIds.length === 0) return new Set();
    const { data, error } = await client
      .from("activity_participants")
      .select("activity_id")
      .eq("user_id", userId)
      .in("activity_id", activityIds);
    if (error) {
      throw new PlatformRepositoryError("ACTIVITY_LOAD_FAILED", error.message, { cause: error });
    }
    return new Set((data ?? []).map((row) => row.activity_id as string));
  }

  return {
    async loadCommunityPosts(limit = 20, offset = 0): Promise<CommunityPost[]> {
      await currentUserId();
      if (!Number.isInteger(limit) || limit < 1 || limit > 50
        || !Number.isInteger(offset) || offset < 0 || offset > 10000) {
        throw new PlatformRepositoryError("VALIDATION", "Choose a valid community feed page.");
      }
      const { data, error } = await client.from("posts")
        .select("id,author_id,body,created_at,author:profiles!posts_author_id_fkey(id,username,display_name,city)")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.message, { cause: error });
      return (data ?? []).map(mapPost);
    },

    async loadCommunityPost(postId: string): Promise<CommunityPost | null> {
      await currentUserId();
      const { data, error } = await client.from("posts")
        .select("id,author_id,body,created_at,author:profiles!posts_author_id_fkey(id,username,display_name,city)")
        .eq("id", postId)
        .maybeSingle();
      if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.message, { cause: error });
      return data ? mapPost(data) : null;
    },

    async createCommunityPost(body: string): Promise<CommunityPost> {
      const parsed = communityPostSchema.safeParse({ body });
      if (!parsed.success) {
        throw new PlatformRepositoryError("VALIDATION", firstIssue(parsed.error, "Check your post."), { cause: parsed.error });
      }
      const authorId = await currentUserId();
      const { data, error } = await client.from("posts")
        .insert({ author_id: authorId, body: parsed.data.body })
        .select("id,author_id,body,created_at,author:profiles!posts_author_id_fkey(id,username,display_name,city)")
        .single();
      if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.message, { cause: error });
      return mapPost(data);
    },

    async updateCommunityPost(postId: string, body: string): Promise<CommunityPost> {
      const parsed = communityPostSchema.safeParse({ body });
      if (!parsed.success) {
        throw new PlatformRepositoryError("VALIDATION", firstIssue(parsed.error, "Check your post."), { cause: parsed.error });
      }
      const authorId = await currentUserId();
      const { data, error } = await client.from("posts")
        .update({ body: parsed.data.body })
        .eq("id", postId)
        .eq("author_id", authorId)
        .select("id,author_id,body,created_at,author:profiles!posts_author_id_fkey(id,username,display_name,city)")
        .maybeSingle();
      if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.message, { cause: error });
      if (!data) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", "This post is unavailable or you cannot edit it.");
      return mapPost(data);
    },

    async deleteCommunityPost(postId: string): Promise<void> {
      const authorId = await currentUserId();
      const { data, error } = await client.from("posts")
        .delete()
        .eq("id", postId)
        .eq("author_id", authorId)
        .select("id")
        .maybeSingle();
      if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.message, { cause: error });
      if (!data) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", "This post is unavailable or you cannot delete it.");
    },

    async discoverAthletes(input: Partial<ActivitySearchInput> = {}) {
      const parsed = activitySearchSchema.safeParse(input);
      if (!parsed.success) {
        throw new PlatformRepositoryError("VALIDATION", firstIssue(parsed.error, "Check discovery filters."), { cause: parsed.error });
      }
      const userId = await currentUserId();
      const { data, error } = await client.rpc("discover_public_athletes", {
        p_query: parsed.data.query || null,
        p_city: parsed.data.city || null,
        p_sport_id: parsed.data.sportId || null,
        p_skill_level: parsed.data.requiredSkillLevel || null,
        p_limit: parsed.data.limit,
        p_offset: parsed.data.offset,
      });
      if (error) {
        throw new PlatformRepositoryError("DISCOVERY_FAILED", error.message, { cause: error });
      }
      return ((data ?? []) as AthleteRow[])
        .filter((athlete) => athlete.id !== userId)
        .map((athlete) => mapAthlete(athlete, client));
    },

    async discoverActivities(input: Partial<ActivitySearchInput> = {}) {
      const parsed = activitySearchSchema.safeParse(input);
      if (!parsed.success) {
        throw new PlatformRepositoryError("VALIDATION", firstIssue(parsed.error, "Check discovery filters."), { cause: parsed.error });
      }
      const userId = await currentUserId();
      let query = client.from("activities")
        .select(activityColumns)
        .eq("status", "published")
        .eq("visibility", "public")
        .gt("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .order("id", { ascending: true })
        .range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);
      if (parsed.data.query) query = query.ilike("title", `%${parsed.data.query}%`);
      if (parsed.data.sportId) query = query.eq("sport_id", parsed.data.sportId);
      if (parsed.data.city) query = query.ilike("city", `%${parsed.data.city}%`);
      if (parsed.data.requiredSkillLevel) {
        query = query.eq("required_skill_level", parsed.data.requiredSkillLevel);
      }
      const { data, error } = await query;
      if (error) {
        throw new PlatformRepositoryError("DISCOVERY_FAILED", error.message, { cause: error });
      }
      const rows = (data ?? []) as unknown as ActivityRow[];
      const joinedIds = await loadJoinedActivityIds(rows.map((row) => row.id), userId);
      return rows.map((row) => mapActivity(row, joinedIds.has(row.id)));
    },

    async loadActivity(activityId: string): Promise<ActivityRecord> {
      const userId = await currentUserId();
      const { data, error } = await client.from("activities")
        .select(activityColumns)
        .eq("id", activityId)
        .maybeSingle();
      if (error) throw new PlatformRepositoryError("ACTIVITY_LOAD_FAILED", error.message, { cause: error });
      if (!data) throw new PlatformRepositoryError("ACTIVITY_LOAD_FAILED", "Activity not found.");
      const row = data as unknown as ActivityRow;
      const joinedIds = await loadJoinedActivityIds([row.id], userId);
      return mapActivity(row, joinedIds.has(row.id));
    },

    async loadMyActivities(limit = 50, offset = 0): Promise<ActivityRecord[]> {
      await currentUserId();
      const { data, error } = await client.rpc("list_my_activities", {
        p_limit: limit,
        p_offset: offset,
      });
      if (error) throw new PlatformRepositoryError("ACTIVITY_LOAD_FAILED", error.message, { cause: error });
      return ((data ?? []) as ActivityRow[]).map((row) => mapActivity(row));
    },

    async createActivity(input: ActivityInput): Promise<string> {
      const parsed = activityInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new PlatformRepositoryError("VALIDATION", firstIssue(parsed.error, "Check the activity details."), { cause: parsed.error });
      }
      const userId = await currentUserId();
      const value = parsed.data;
      const { data, error } = await client.rpc("create_my_activity", {
        p_sport_id: value.sportId,
        p_title: value.title,
        p_description: value.description,
        p_starts_at: value.startsAt,
        p_ends_at: value.endsAt,
        p_venue_name: value.venueName,
        p_city: value.city,
        p_capacity: value.capacity,
        p_required_skill_level: value.requiredSkillLevel,
        p_visibility: value.visibility,
      });
      if (error) throw new PlatformRepositoryError("ACTIVITY_SAVE_FAILED", error.message, { cause: error });
      if (typeof data !== "string") {
        throw new PlatformRepositoryError("ACTIVITY_SAVE_FAILED", "The server did not return the created activity.");
      }
      return data;
    },

    async updateActivity(activityId: string, input: ActivityInput): Promise<void> {
      const parsed = activityInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new PlatformRepositoryError("VALIDATION", firstIssue(parsed.error, "Check the activity details."), { cause: parsed.error });
      }
      const value = parsed.data;
      await runRpc("update_my_activity", {
        p_activity_id: activityId,
        p_sport_id: value.sportId,
        p_title: value.title,
        p_description: value.description,
        p_starts_at: value.startsAt,
        p_ends_at: value.endsAt,
        p_venue_name: value.venueName,
        p_city: value.city,
        p_capacity: value.capacity,
        p_required_skill_level: value.requiredSkillLevel,
        p_visibility: value.visibility,
      }, "ACTIVITY_SAVE_FAILED");
    },

    async cancelActivity(activityId: string): Promise<void> {
      await runRpc("cancel_my_activity", { p_activity_id: activityId }, "ACTIVITY_SAVE_FAILED");
    },

    async joinActivity(activityId: string): Promise<void> {
      await runRpc("join_activity", { p_activity_id: activityId }, "ACTIVITY_JOIN_FAILED");
    },

    async leaveActivity(activityId: string): Promise<void> {
      await runRpc("leave_activity", { p_activity_id: activityId }, "ACTIVITY_LEAVE_FAILED");
    },

    async loadActivityParticipants(activityId: string) {
      await currentUserId();
      const { data, error } = await client.from("activity_participants")
        .select("user_id,joined_at,profile:profiles!activity_participants_user_id_fkey(id,username,display_name,city)")
        .eq("activity_id", activityId)
        .order("joined_at", { ascending: true });
      if (error) throw new PlatformRepositoryError("ACTIVITY_LOAD_FAILED", error.message, { cause: error });
      return (data ?? []).map((value): ActivityParticipant => {
        const row = value as Record<string, unknown>;
        const relation = Array.isArray(row.profile) ? row.profile[0] : row.profile;
        const profile = relation && typeof relation === "object"
          ? relation as Record<string, unknown>
          : null;
        if (typeof row.user_id !== "string" || typeof row.joined_at !== "string") {
          throw new PlatformRepositoryError("ACTIVITY_LOAD_FAILED", "The server returned an invalid activity participant.");
        }
        if (profile && (
          typeof profile.id !== "string"
          || typeof profile.username !== "string"
          || typeof profile.display_name !== "string"
          || typeof profile.city !== "string"
        )) {
          throw new PlatformRepositoryError("ACTIVITY_LOAD_FAILED", "The server returned an invalid participant profile.");
        }
        return {
          userId: row.user_id,
          joinedAt: row.joined_at,
          profile: profile
            ? {
                id: profile.id as string,
                username: profile.username as string,
                display_name: profile.display_name as string,
                city: profile.city as string,
              }
            : null,
        };
      });
    },

    async followPlayer(followedId: string): Promise<void> {
      const followerId = await currentUserId();
      const { error } = await client.from("player_follows").insert({
        follower_id: followerId,
        followed_id: followedId,
      });
      if (error) {
        throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.code === "23505" ? "You already follow this player." : error.message, { cause: error });
      }
    },

    async unfollowPlayer(followedId: string): Promise<void> {
      const followerId = await currentUserId();
      const { error } = await client.from("player_follows")
        .delete()
        .eq("follower_id", followerId)
        .eq("followed_id", followedId);
      if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.message, { cause: error });
    },

    async loadFollowedPlayerIds(playerIds: string[]): Promise<Set<string>> {
      const followerId = await currentUserId();
      if (!playerIds.length) return new Set();
      const { data, error } = await client.from("player_follows")
        .select("followed_id")
        .eq("follower_id", followerId)
        .in("followed_id", playerIds);
      if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.message, { cause: error });
      return new Set((data ?? []).map((row) => row.followed_id as string));
    },

    async loadPlayerConnections(playerIds: string[]): Promise<Map<string, PlayerConnectionView | null>> {
      const userId = await currentUserId();
      const result = new Map<string, PlayerConnectionView | null>(playerIds.map((id) => [id, null]));
      if (!playerIds.length) return result;
      const ids = [...new Set([...playerIds, userId])];
      const { data, error } = await client.from("player_connections")
        .select("id,requester_id,recipient_id,status,created_at")
        .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`)
        .in("requester_id", ids)
        .in("recipient_id", ids)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(200);
      if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.message, { cause: error });
      const connections = ((data ?? []) as Array<Record<string, unknown>>).map((row): PlayerConnectionRecord => {
        if (
          typeof row.id !== "string"
          || typeof row.requester_id !== "string"
          || typeof row.recipient_id !== "string"
          || (row.status !== "pending" && row.status !== "accepted" && row.status !== "rejected")
          || typeof row.created_at !== "string"
        ) {
          throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", "The server returned an invalid player connection.");
        }
        return {
          id: row.id,
          requester_id: row.requester_id,
          recipient_id: row.recipient_id,
          status: row.status,
          created_at: row.created_at,
        };
      });
      for (const playerId of playerIds) {
        result.set(playerId, getPlayerConnectionView(connections, userId, playerId));
      }
      return result;
    },

    async requestPlayerConnection(playerId: string): Promise<void> {
      const requesterId = await currentUserId();
      if (playerId === requesterId) {
        throw new PlatformRepositoryError("VALIDATION", "You cannot send a connection request to yourself.");
      }
      const { error } = await client.from("player_connections").insert({
        requester_id: requesterId,
        recipient_id: playerId,
      });
      if (error) {
        throw new PlatformRepositoryError(
          "SOCIAL_ACTION_FAILED",
          error.code === "23505" ? "A pending or accepted connection already exists." : error.message,
          { cause: error },
        );
      }
    },

    async cancelPlayerConnection(connectionId: string): Promise<void> {
      const userId = await currentUserId();
      const { data, error } = await client.from("player_connections")
        .delete()
        .eq("id", connectionId)
        .eq("requester_id", userId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.message, { cause: error });
      if (!data) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", "This request is no longer pending.");
    },

    async respondToPlayerConnection(
      connectionId: string,
      status: "accepted" | "rejected",
    ): Promise<void> {
      const userId = await currentUserId();
      const { data, error } = await client.from("player_connections")
        .update({ status })
        .eq("id", connectionId)
        .eq("recipient_id", userId)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.message, { cause: error });
      if (!data) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", "This request is no longer awaiting a response.");
    },

    async togglePostLike(postId: string): Promise<boolean> {
      const userId = await currentUserId();
      const { data: existing, error: loadError } = await client.from("post_likes")
        .select("post_id")
        .eq("post_id", postId)
        .eq("user_id", userId)
        .maybeSingle();
      if (loadError) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", loadError.message, { cause: loadError });
      if (existing) {
        const { error } = await client.from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", userId);
        if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.message, { cause: error });
        return false;
      }
      const { error } = await client.from("post_likes").insert({ post_id: postId, user_id: userId });
      if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.code === "23505" ? "This post is already liked." : error.message, { cause: error });
      return true;
    },

    async loadPostInteractions(postIds: string[]) {
      const userId = await currentUserId();
      if (postIds.length === 0) return new Map<string, { likes: number; comments: number; liked: boolean }>();
      const [{ data: likes, error: likesError }, { data: comments, error: commentsError }] = await Promise.all([
        client.from("post_likes").select("post_id,user_id").in("post_id", postIds),
        client.from("post_comments").select("post_id").in("post_id", postIds),
      ]);
      if (likesError || commentsError) {
        const cause = likesError ?? commentsError;
        if (!cause) {
          throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", "Post interactions could not be loaded.");
        }
        throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", cause.message, { cause });
      }
      const interactionMap = new Map(postIds.map((id) => [id, { likes: 0, comments: 0, liked: false }]));
      for (const like of likes ?? []) {
        const value = interactionMap.get(like.post_id as string);
        if (value) {
          value.likes++;
          value.liked ||= like.user_id === userId;
        }
      }
      for (const comment of comments ?? []) {
        const value = interactionMap.get(comment.post_id as string);
        if (value) value.comments++;
      }
      return interactionMap;
    },

    async loadPostComments(postId: string, limit = 50): Promise<PostComment[]> {
      await currentUserId();
      const { data, error } = await client.from("post_comments")
        .select("id,post_id,author_id,body,created_at,author:profiles!post_comments_author_id_fkey(id,username,display_name)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.message, { cause: error });
      return ((data ?? []) as unknown as CommentRow[]).map((comment) => {
        const authorValue = Array.isArray(comment.author) ? comment.author[0] : comment.author;
        const author = authorValue && typeof authorValue === "object"
          ? authorValue as PostComment["author"]
          : null;
        return {
          id: comment.id,
          postId: comment.post_id,
          authorId: comment.author_id,
          body: comment.body,
          createdAt: comment.created_at,
          author,
        };
      });
    },

    async addPostComment(postId: string, body: string): Promise<PostComment> {
      const parsed = postCommentSchema.safeParse({ body });
      if (!parsed.success) {
        throw new PlatformRepositoryError("VALIDATION", firstIssue(parsed.error, "Check your comment."), { cause: parsed.error });
      }
      const authorId = await currentUserId();
      const { data, error } = await client.from("post_comments")
        .insert({ post_id: postId, author_id: authorId, body: parsed.data.body })
        .select("id,post_id,author_id,body,created_at,author:profiles!post_comments_author_id_fkey(id,username,display_name)")
        .single();
      if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.message, { cause: error });
      const row = data as unknown as CommentRow;
      const authorValue = Array.isArray(row.author) ? row.author[0] : row.author;
      return {
        id: row.id,
        postId: row.post_id,
        authorId: row.author_id,
        body: row.body,
        createdAt: row.created_at,
        author: authorValue && typeof authorValue === "object"
          ? authorValue as PostComment["author"]
          : null,
      };
    },

    async loadNotifications(limit = 50) {
      const userId = await currentUserId();
      const { data, error } = await client.from("notifications")
        .select("id,actor_id,notification_type,entity_id,created_at,read_at,actor:profiles!notifications_actor_id_fkey(username,display_name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.message, { cause: error });
      return (data ?? []).map((value): PlatformNotification => {
        const row = value as Record<string, unknown>;
        const relation = Array.isArray(row.actor) ? row.actor[0] : row.actor;
        const actor = relation && typeof relation === "object"
          ? relation as Record<string, unknown>
          : null;
        if (
          typeof row.id !== "string"
          || (row.actor_id !== null && typeof row.actor_id !== "string")
          || (
            row.notification_type !== "post_like"
            && row.notification_type !== "post_comment"
            && row.notification_type !== "new_follower"
            && row.notification_type !== "connection_request"
            && row.notification_type !== "connection_accepted"
            && row.notification_type !== "venue_inquiry"
            && row.notification_type !== "coach_inquiry"
          )
          || typeof row.entity_id !== "string"
          || typeof row.created_at !== "string"
          || (row.read_at !== null && typeof row.read_at !== "string")
        ) {
          throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", "The server returned an invalid notification.");
        }
        if (actor && (typeof actor.username !== "string" || typeof actor.display_name !== "string")) {
          throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", "The server returned an invalid notification actor.");
        }
        return {
          id: row.id,
          actorId: row.actor_id,
          type: row.notification_type,
          entityId: row.entity_id,
          createdAt: row.created_at,
          readAt: row.read_at,
          actor: actor ? { username: actor.username as string, display_name: actor.display_name as string } : null,
        };
      });
    },

    async loadMySocialSummary(): Promise<MySocialSummary> {
      const userId = await currentUserId();
      const [
        { count: followers, error: followersError },
        { count: following, error: followingError },
        { count: connections, error: connectionsError },
        { count: posts, error: postsError },
        { count: unreadNotifications, error: notificationsError },
      ] = await Promise.all([
        client.from("player_follows").select("follower_id", { count: "exact", head: true }).eq("followed_id", userId),
        client.from("player_follows").select("followed_id", { count: "exact", head: true }).eq("follower_id", userId),
        client.from("player_connections").select("id", { count: "exact", head: true })
          .eq("status", "accepted")
          .or(`requester_id.eq.${userId},recipient_id.eq.${userId}`),
        client.from("posts").select("id", { count: "exact", head: true }).eq("author_id", userId),
        client.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
      ]);
      const failure = followersError ?? followingError ?? connectionsError ?? postsError ?? notificationsError;
      if (failure) {
        throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", failure.message, { cause: failure });
      }
      return {
        followers: followers ?? 0,
        following: following ?? 0,
        connections: connections ?? 0,
        posts: posts ?? 0,
        unreadNotifications: unreadNotifications ?? 0,
      };
    },

    async markNotificationRead(notificationId: string): Promise<void> {
      const userId = await currentUserId();
      const { error } = await client.from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", userId);
      if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.message, { cause: error });
    },

    async markAllNotificationsRead(): Promise<void> {
      const userId = await currentUserId();
      const { error } = await client.from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);
      if (error) throw new PlatformRepositoryError("SOCIAL_ACTION_FAILED", error.message, { cause: error });
    },
  };
}
