import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import type { CommunityPost, PostComment } from "@moveit/shared";
import { createCommunityPlatformRepository } from "@moveit/supabase";
import { ConnectionControls } from "../../src/components/connection-controls";
import { Button, Card, Header, Icon, Page, Pill, SectionTitle, SportArtwork } from "../../src/components/ui";
import {
  COMMUNITY_PAGE_SIZE,
  addLocalPostComment,
  deleteCommunityPost,
  getLocalPostComments,
  getLocalPostInteractions,
  isLocalCommunityPreview,
  loadCommunityFeed,
  loadSuggestedPlayers,
  toggleLocalPostBookmark,
  toggleLocalPostLike,
  type FeedCursor,
  type SuggestedPlayer,
} from "../../src/community-api";
import type { LocalCommunityComment } from "../../src/local-community-repository";
import { supabase } from "../../src/supabase";
import { design, useMoveitTheme } from "../../src/theme";

type CommunityView = "feed" | "players";

export default function CommunityScreen() {
  const { colors } = useMoveitTheme();
  const localPreview = isLocalCommunityPreview();
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<CommunityView>(params.view === "players" ? "players" : "feed");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [cursor, setCursor] = useState<FeedCursor | null>(null);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedRefreshing, setFeedRefreshing] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [feedSignedOut, setFeedSignedOut] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [moreError, setMoreError] = useState("");
  const [players, setPlayers] = useState<SuggestedPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState("");
  const [playersSignedOut, setPlayersSignedOut] = useState(false);

  useEffect(() => {
    if (params.view === "players") setView("players");
    else if (params.view === "feed") setView("feed");
  }, [params.view]);

  const refreshFeed = useCallback(async () => {
    setFeedLoading(true);
    setFeedError("");
    setMoreError("");
    try {
      const page = await loadCommunityFeed();
      if (!page) {
        setFeedSignedOut(true);
        setPosts([]);
        setCursor(null);
      } else {
        setFeedSignedOut(false);
        setPosts(page.posts);
        setCursor(page.nextCursor);
      }
    } catch (caught) {
      setFeedError(caught instanceof Error ? caught.message : "The feed could not be loaded.");
    } finally {
      setFeedLoading(false);
    }
  }, []);

  const refreshPlayers = useCallback(async () => {
    setPlayersLoading(true);
    setPlayersError("");
    try {
      const result = await loadSuggestedPlayers();
      if (!result) {
        setPlayersSignedOut(true);
        setPlayers([]);
      } else {
        setPlayersSignedOut(false);
        setPlayers(result.players);
      }
    } catch (caught) {
      setPlayersError(caught instanceof Error ? caught.message : "Players could not be loaded.");
    } finally {
      setPlayersLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (view === "feed") void refreshFeed();
      else void refreshPlayers();
    }, [refreshFeed, refreshPlayers, view]),
  );

  const loadMore = async () => {
    if (!cursor || moreLoading) return;
    setMoreLoading(true);
    setMoreError("");
    try {
      const page = await loadCommunityFeed(cursor);
      if (!page) {
        setFeedSignedOut(true);
        setPosts([]);
        setCursor(null);
        return;
      }
      setPosts((current) => {
        const existing = new Set(current.map((post) => post.id));
        return [...current, ...page.posts.filter((post) => !existing.has(post.id))];
      });
      setCursor(page.nextCursor);
    } catch (caught) {
      setMoreError(caught instanceof Error ? caught.message : "More posts could not be loaded.");
    } finally {
      setMoreLoading(false);
    }
  };

  const startRefresh = () => {
    if (view === "feed") {
      setFeedRefreshing(true);
      void refreshFeed().finally(() => setFeedRefreshing(false));
    } else {
      void refreshPlayers();
    }
  };

  const refreshControl = (
    <RefreshControl
      refreshing={view === "feed" ? feedRefreshing : playersLoading}
      onRefresh={startRefresh}
      tintColor={colors.primary}
      colors={[colors.primary]}
      progressBackgroundColor={colors.surface}
    />
  );

  return (
    <Page refreshControl={refreshControl}>
      <Header
        eyebrow="YOUR PEOPLE · LAHORE"
        title="Community."
        action={<Button label="Post" icon="plus" onPress={() => router.push("/posts/create")} />}
      />

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pill label="Feed" selected={view === "feed"} onPress={() => setView("feed")} />
        <Pill label="Players" selected={view === "players"} onPress={() => setView("players")} />
      </View>

      {view === "feed" ? (
        <FeedContent
          posts={posts}
          cursor={cursor}
          loading={feedLoading}
          signedOut={feedSignedOut}
          error={feedError}
          moreLoading={moreLoading}
          moreError={moreError}
          onRetry={() => void refreshFeed()}
          onLoadMore={() => void loadMore()}
          localPreview={localPreview}
        />
      ) : (
        <PlayersContent
          players={players}
          loading={playersLoading}
          signedOut={playersSignedOut}
          error={playersError}
          onRetry={() => void refreshPlayers()}
          onRefresh={refreshPlayers}
        />
      )}

      <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 16 }}>
        {localPreview
          ? "LOCAL DEVELOPMENT PREVIEW · Posts and interactions are saved only on this device. They are not shared with other MOVEIT users."
          : "Posts and player profiles come from MOVEIT accounts. Private profiles are not listed."}
      </Text>
    </Page>
  );
}

function FeedContent({
  posts,
  cursor,
  loading,
  signedOut,
  error,
  moreLoading,
  moreError,
  onRetry,
  onLoadMore,
  localPreview,
}: {
  posts: CommunityPost[];
  cursor: FeedCursor | null;
  loading: boolean;
  signedOut: boolean;
  error: string;
  moreLoading: boolean;
  moreError: string;
  onRetry: () => void;
  onLoadMore: () => void;
  localPreview: boolean;
}) {
  const { colors } = useMoveitTheme();

  if (loading && posts.length === 0) return <LoadingState label="Loading community posts…" />;
  if (error && posts.length === 0) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }
  if (signedOut) {
    return (
      <EmptyState
        title="Sign in to join the conversation"
        message="Community posts are available to signed-in MOVEIT players."
        action={<Button label="Sign in" onPress={() => router.push("/auth")} />}
      />
    );
  }
  if (!posts.length) {
    return (
      <EmptyState
        title="Your community starts here"
        message="There are no posts yet. Share a game idea, a small win, or an invite to get the conversation moving."
        action={<Button label="Write the first post" onPress={() => router.push("/posts/create")} />}
      />
    );
  }

  return (
    <View style={{ gap: 13 }}>
      {error ? <ErrorState message={error} onRetry={onRetry} compact /> : null}
      {posts.map((post) => <PostCard key={post.id} post={post} localPreview={localPreview} onChanged={onRetry} />)}
      {moreError ? <ErrorState message={moreError} onRetry={onLoadMore} compact /> : null}
      {cursor ? (
        <Button label={moreLoading ? "Loading posts…" : "Load older posts"} variant="secondary" disabled={moreLoading} onPress={onLoadMore} />
      ) : (
        <Text style={{ color: colors.muted, fontSize: 10, textAlign: "center" }}>
          You’re all caught up · {Math.min(posts.length, COMMUNITY_PAGE_SIZE)} posts loaded
        </Text>
      )}
    </View>
  );
}

function PostCard({ post, localPreview, onChanged }: { post: CommunityPost; localPreview: boolean; onChanged: () => void }) {
  const { colors } = useMoveitTheme();
  const [liked, setLiked] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [comments, setComments] = useState<LocalCommunityComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [remoteLikes, setRemoteLikes] = useState(0);
  const [remoteCommentCount, setRemoteCommentCount] = useState(0);
  const [remoteComments, setRemoteComments] = useState<PostComment[]>([]);
  const [showRemoteComments, setShowRemoteComments] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const authorName = post.author?.display_name.trim() || "MOVEIT player";
  const username = post.author?.username ? `@${post.author.username}` : "Author unavailable";
  const createdAt = new Date(post.created_at);
  const timestamp = Number.isNaN(createdAt.getTime())
    ? "Recently"
    : createdAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

  useEffect(() => {
    if (localPreview) {
      const interactions = getLocalPostInteractions();
      setLiked(interactions.likedPostIds.includes(post.id));
      setBookmarked(interactions.bookmarkedPostIds.includes(post.id));
      setComments(getLocalPostComments(post.id));
      return;
    }
    if (!supabase) return;
    let active = true;
    const repository = createCommunityPlatformRepository(supabase);
    void Promise.all([
      supabase.auth.getUser(),
      repository.loadPostInteractions([post.id]),
      repository.loadPostComments(post.id),
    ]).then(([auth, interactionMap, loadedComments]) => {
      if (!active) return;
      const interaction = interactionMap.get(post.id);
      setCurrentUserId(auth.data.user?.id ?? "");
      setLiked(interaction?.liked ?? false);
      setRemoteLikes(interaction?.likes ?? 0);
      setRemoteCommentCount(interaction?.comments ?? 0);
      setRemoteComments(loadedComments);
    }).catch((caught: unknown) => {
      if (active) setActionError(caught instanceof Error ? caught.message : "Post interactions could not be loaded.");
    });
    return () => { active = false; };
  }, [localPreview, post.id]);

  const runInteraction = async (action: () => Promise<void>) => {
    setBusy(true);
    setActionError("");
    try {
      await action();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "This local interaction could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.softGreen, alignItems: "center", justifyContent: "center" }}>
          <Text accessibilityElementsHidden style={{ color: colors.accent, fontSize: 15, fontWeight: "600" }}>
            {authorName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{authorName}</Text>
          <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10 }}>
            {username} · {post.author?.city || "MOVEIT"} · {timestamp}
          </Text>
        </View>
        <Text accessibilityLabel={localPreview ? "Local development post" : "Community post"} style={{ color: colors.accent, fontSize: 9, fontWeight: "600" }}>
          {localPreview ? "LOCAL" : "POST"}
        </Text>
      </View>
      <Text selectable style={{ color: colors.text, fontSize: 14, lineHeight: 22 }}>
        {post.body || "This post is no longer available."}
      </Text>
      {localPreview ? (
        <View style={{ gap: 9 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={liked ? "Unlike this local post" : "Like this local post"}
              onPress={() => void runInteraction(async () => setLiked(await toggleLocalPostLike(post.id)))}
              disabled={busy}
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}
            >
              <Text style={{ color: liked ? colors.primary : colors.muted, fontSize: 12, fontWeight: "700" }}>{liked ? "Liked on this device" : "Like"}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={bookmarked ? "Remove local bookmark" : "Bookmark this local post"}
              onPress={() => void runInteraction(async () => setBookmarked(await toggleLocalPostBookmark(post.id)))}
              disabled={busy}
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}
            >
              <Text style={{ color: bookmarked ? colors.primary : colors.muted, fontSize: 12, fontWeight: "700" }}>{bookmarked ? "Saved locally" : "Save"}</Text>
            </Pressable>
            {post.author_id === "local-preview-owner" ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit your local post"
                  onPress={() => router.push({ pathname: "/posts/create", params: { postId: post.id } })}
                  style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}
                >
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Edit</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete your local post"
                  onPress={() => setConfirmingDelete(true)}
                  style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}
                >
                  <Text style={{ color: colors.danger, fontSize: 12, fontWeight: "700" }}>Delete</Text>
                </Pressable>
              </>
            ) : null}
          </View>
          {confirmingDelete ? (
            <View style={{ gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.danger, padding: 12 }}>
              <Text accessibilityRole="alert" style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                Delete this post and its local comments from this device?
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConfirmingDelete(false)}
                  style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}
                >
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Cancel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Confirm delete local post"
                  disabled={busy}
                  onPress={() => void runInteraction(async () => {
                    await deleteCommunityPost(post.id);
                    setConfirmingDelete(false);
                    onChanged();
                  })}
                  style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}
                >
                  <Text style={{ color: colors.danger, fontSize: 12, fontWeight: "800" }}>Delete post</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {comments.map((comment) => (
            <Text key={comment.id} style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>You </Text>{comment.body}
            </Text>
          ))}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              accessibilityLabel="Write a local comment"
              value={commentText}
              onChangeText={setCommentText}
              placeholder="Add a comment…"
              placeholderTextColor={colors.muted}
              maxLength={500}
              style={{ flex: 1, minHeight: 44, color: colors.text, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, fontSize: 12 }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save comment on this device"
              disabled={busy || !commentText.trim()}
              onPress={() => void runInteraction(async () => {
                await addLocalPostComment(post.id, commentText);
                setCommentText("");
                setComments(getLocalPostComments(post.id));
              })}
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}
            >
              <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "800" }}>Comment</Text>
            </Pressable>
          </View>
          {actionError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 11 }}>{actionError}</Text> : null}
        </View>
      ) : (
        <View style={{ gap: 9 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={liked ? "Unlike this post" : "Like this post"}
              disabled={busy}
              onPress={() => void runInteraction(async () => {
                if (!supabase) throw new Error("Sign in to like community posts.");
                const nextLiked = await createCommunityPlatformRepository(supabase).togglePostLike(post.id);
                setLiked(nextLiked);
                setRemoteLikes((count) => Math.max(0, count + (nextLiked ? 1 : -1)));
              })}
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}
            >
              <Text style={{ color: liked ? colors.primary : colors.muted, fontSize: 12, fontWeight: "700" }}>
                {liked ? "Liked" : "Like"} · {remoteLikes}
              </Text>
            </Pressable>
            {post.author_id === currentUserId ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit your post"
                  onPress={() => router.push({ pathname: "/posts/create", params: { postId: post.id } })}
                  style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}
                >
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Edit</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Delete your post"
                  onPress={() => setConfirmingDelete(true)}
                  style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}
                >
                  <Text style={{ color: colors.danger, fontSize: 12, fontWeight: "700" }}>Delete</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showRemoteComments ? "Hide comments" : "Show comments"}
              onPress={() => setShowRemoteComments((visible) => !visible)}
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}
            >
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                {showRemoteComments ? "Hide comments" : `Comments · ${remoteCommentCount}`}
              </Text>
            </Pressable>
          </View>
          {confirmingDelete ? (
            <View style={{ gap: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.danger, padding: 12 }}>
              <Text accessibilityRole="alert" style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>
                Delete this post and its comments?
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button label="Keep post" variant="secondary" onPress={() => setConfirmingDelete(false)} />
                <Button label="Confirm delete" variant="secondary" disabled={busy} onPress={() => void runInteraction(async () => {
                  if (!supabase) throw new Error("Sign in to manage community posts.");
                  await createCommunityPlatformRepository(supabase).deleteCommunityPost(post.id);
                  setConfirmingDelete(false);
                  onChanged();
                })} />
              </View>
            </View>
          ) : null}
          {showRemoteComments ? (
            <>
              {remoteComments.map((comment) => (
                <Text key={comment.id} style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{comment.author?.display_name ?? "MOVEIT player"} </Text>{comment.body}
                </Text>
              ))}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TextInput
                  accessibilityLabel="Write a community comment"
                  value={commentText}
                  onChangeText={setCommentText}
                  placeholder="Add a comment…"
                  placeholderTextColor={colors.muted}
                  maxLength={1000}
                  style={{ flex: 1, minHeight: 44, color: colors.text, backgroundColor: colors.field, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 12, fontSize: 12 }}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || !commentText.trim()}
                  onPress={() => void runInteraction(async () => {
                    if (!supabase) throw new Error("Sign in to comment on community posts.");
                    const comment = await createCommunityPlatformRepository(supabase).addPostComment(post.id, commentText);
                    setRemoteComments((current) => [...current, comment]);
                    setRemoteCommentCount((count) => count + 1);
                    setCommentText("");
                  })}
                  style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}
                >
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "800" }}>Comment</Text>
                </Pressable>
              </View>
            </>
          ) : null}
          {actionError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 11 }}>{actionError}</Text> : null}
        </View>
      )}
    </Card>
  );
}

function PlayersContent({
  players,
  loading,
  signedOut,
  error,
  onRetry,
  onRefresh,
}: {
  players: SuggestedPlayer[];
  loading: boolean;
  signedOut: boolean;
  error: string;
  onRetry: () => void;
  onRefresh: () => Promise<void>;
}) {
  if (loading && players.length === 0) return <LoadingState label="Finding players…" />;
  if (error && players.length === 0) return <ErrorState message={error} onRetry={onRetry} />;
  if (signedOut) {
    return (
      <EmptyState
        title="Meet MOVEIT players"
        message="Sign in to discover public player profiles and manage connection requests."
        action={<Button label="Sign in" onPress={() => router.push("/auth")} />}
      />
    );
  }
  if (!players.length) {
    return (
      <EmptyState
        title="Be one of the first"
        message="No public player profiles are available yet. When players join, you’ll find them here."
      />
    );
  }

  return (
    <View style={{ gap: 12 }}>
      {error ? <ErrorState message={error} onRetry={onRetry} compact /> : null}
      <SectionTitle title={`${players.length} players to discover`} />
      {players.map((player) => (
        <PlayerCard key={player.id} player={player} onChanged={onRefresh} />
      ))}
    </View>
  );
}

function PlayerCard({ player, onChanged }: { player: SuggestedPlayer; onChanged: () => Promise<void> }) {
  const { colors } = useMoveitTheme();
  const name = player.display_name.trim() || `@${player.username}`;

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${name}'s public player profile`}
        onPress={() => router.push({ pathname: "/players/[id]", params: { id: player.id } })}
        style={{ flexDirection: "row", alignItems: "center", gap: 11 }}
      >
        <SportArtwork glyph={name.charAt(0).toUpperCase()} color="green" size={46} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={1} style={{ color: colors.text, fontSize: 13, fontWeight: "800" }}>{name}</Text>
          <Text style={{ color: colors.muted, fontSize: 10 }}>@{player.username} · {player.city}</Text>
          {player.bio ? <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>{player.bio}</Text> : null}
        </View>
        <Icon name="chevron-right" size={18} color={colors.muted} />
      </Pressable>
      <ConnectionControls playerId={player.id} connection={player.connection} onChanged={onChanged} />
    </Card>
  );
}

function LoadingState({ label }: { label: string }) {
  const { colors } = useMoveitTheme();

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={{ alignItems: "center", padding: 28, gap: 10 }}>
      <ActivityIndicator color={colors.primary} />
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function ErrorState({ message, onRetry, compact = false }: { message: string; onRetry: () => void; compact?: boolean }) {
  const { colors } = useMoveitTheme();

  return (
    <Card style={{ backgroundColor: colors.surfaceAlt }}>
      <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}>{message}</Text>
      <Button label={compact ? "Retry" : "Try again"} variant="secondary" onPress={onRetry} />
    </Card>
  );
}

function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  const { colors } = useMoveitTheme();

  return (
    <View style={{ alignItems: "center", paddingHorizontal: 20, paddingVertical: 24, gap: 13, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: design.radius.sm }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" }}>{title}</Text>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" }}>{message}</Text>
      {action}
    </View>
  );
}
