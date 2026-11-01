import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  activityInputSchema,
  sportsCatalogue,
  type ActivityInput,
  type ActivityRecord,
  type AthleteProfile,
  type CommunityPost,
  type DiscoveredAthlete,
  type AthletePreferencesInput,
  type PlayerConnectionView,
  type PostComment,
  type SportSkillLevel,
} from "@moveit/shared";
import {
  createAthleteProfileRepository,
  createCommunityPlatformRepository,
  type ActivityParticipant,
  type MySocialSummary,
  type PlatformNotification,
} from "@moveit/supabase";
import { DirectoryPanel } from "./DirectoryPanel";

type HubTab = "discover" | "activities" | "community" | "venues";
type DiscoverKind = "activities" | "athletes" | "venues" | "coaches" | "sports";

const skillLevels: SportSkillLevel[] = ["beginner", "intermediate", "advanced", "professional"];

export function PlatformHub({ client, profile }: { client: SupabaseClient; profile: AthleteProfile }) {
  const [tab, setTab] = useState<HubTab>("discover");
  const [discoverKind, setDiscoverKind] = useState<DiscoverKind>("activities");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState(profile.city);
  const [sportId, setSportId] = useState("");
  const [skill, setSkill] = useState("");
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [athletes, setAthletes] = useState<DiscoveredAthlete[]>([]);
  const [myActivities, setMyActivities] = useState<ActivityRecord[]>([]);
  const [activityParticipants, setActivityParticipants] = useState<Map<string, ActivityParticipant[]>>(new Map());
  const [participantLoads, setParticipantLoads] = useState<Set<string>>(new Set());
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [likes, setLikes] = useState<Map<string, { likes: number; comments: number; liked: boolean }>>(new Map());
  const [comments, setComments] = useState<Map<string, PostComment[]>>(new Map());
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [connections, setConnections] = useState<Map<string, PlayerConnectionView | null>>(new Map());
  const [discoveryOffset, setDiscoveryOffset] = useState(0);
  const [discoveryHasMore, setDiscoveryHasMore] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [mySports, setMySports] = useState<Array<{ sportId: string; skillLevel: SportSkillLevel | null; isPreferred: boolean }>>([]);
  const [fitnessGoals, setFitnessGoals] = useState<AthletePreferencesInput["fitnessGoals"]>([]);
  const [socialSummary, setSocialSummary] = useState<MySocialSummary | null>(null);
  const [recentNotifications, setRecentNotifications] = useState<PlatformNotification[]>([]);
  const [weeklyFitness, setWeeklyFitness] = useState<{ workouts: number; minutes: number } | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [newPost, setNewPost] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [activityDraft, setActivityDraft] = useState<ActivityDraft>(emptyDraft(profile.city));
  const [editingActivityId, setEditingActivityId] = useState("");
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const filtersRef = useRef({ query, city, sportId, skill });
  filtersRef.current = { query, city, sportId, skill };
  const repository = createCommunityPlatformRepository(client);

  const load = useCallback(async (nextOffset = 0, append = false) => {
    if (append) setMoreLoading(true);
    else setLoading(true);
    setError("");
    try {
      if (tab === "discover") {
        if (discoverKind === "venues" || discoverKind === "coaches" || discoverKind === "sports") return;
        const currentFilters = filtersRef.current;
        const filters = {
          query: currentFilters.query.trim() || undefined,
          city: currentFilters.city.trim() || undefined,
          sportId: currentFilters.sportId || undefined,
          requiredSkillLevel: currentFilters.skill ? currentFilters.skill as SportSkillLevel : undefined,
          limit: 20,
          offset: nextOffset,
        };
        if (discoverKind === "athletes") {
          const rows = await repository.discoverAthletes(filters);
          const [followedIds, connectionMap] = await Promise.all([
            repository.loadFollowedPlayerIds(rows.map(({ id }) => id)),
            repository.loadPlayerConnections(rows.map(({ id }) => id)),
          ]);
          setAthletes((current) => append ? [...current, ...rows.filter(({ id }) => !current.some((item) => item.id === id))] : rows);
          setFollowed((current) => new Set(append ? [...current, ...followedIds] : followedIds));
          setConnections((current) => new Map(append ? [...current, ...connectionMap] : connectionMap));
          setDiscoveryHasMore(rows.length === 20);
        } else {
          const rows = await repository.discoverActivities(filters);
          setActivities((current) => append ? [...current, ...rows.filter(({ id }) => !current.some((item) => item.id === id))] : rows);
          setDiscoveryHasMore(rows.length === 20);
        }
        setDiscoveryOffset(nextOffset);
      } else if (tab === "activities") {
        setMyActivities(await repository.loadMyActivities());
      } else if (tab === "community") {
        const rows = await repository.loadCommunityPosts();
        const [interactionData, commentData] = await Promise.all([
          repository.loadPostInteractions(rows.map(({ id }) => id)),
          Promise.all(rows.map(async ({ id }) => [id, await repository.loadPostComments(id, 20)] as const)),
        ]);
        setPosts(rows);
        setLikes(interactionData);
        setComments(new Map(commentData));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "MOVEIT data could not be loaded.");
    } finally {
      setLoading(false);
      setMoreLoading(false);
    }
  }, [tab, discoverKind]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let active = true;
    const loadSummary = async () => {
      setSummaryError("");
      try {
        const platformRepository = createCommunityPlatformRepository(client);
        const profileRepository = createAthleteProfileRepository(client);
        const [{ data: auth, error: authError }, sports, preferences, social, notifications, activities] = await Promise.all([
          client.auth.getUser(),
          profileRepository.loadMySportPreferences(),
          profileRepository.loadMyAthletePreferences(),
          platformRepository.loadMySocialSummary(),
          platformRepository.loadNotifications(5),
          platformRepository.loadMyActivities(),
        ]);
        if (authError) throw authError;
        if (!auth.user) throw new Error("Sign in to load your personal MOVEIT summary.");
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: workouts, error: workoutError } = await client
          .from("workouts")
          .select("duration_minutes")
          .eq("user_id", auth.user.id)
          .gte("performed_at", since);
        if (workoutError) throw workoutError;
        if (!active) return;
        setMySports(sports);
        setFitnessGoals(preferences.fitnessGoals);
        setSocialSummary(social);
        setRecentNotifications(notifications);
        setMyActivities(activities);
        const durations = (workouts ?? []).map((workout) => workout.duration_minutes as number);
        setWeeklyFitness({
          workouts: durations.length,
          minutes: durations.reduce((total, duration) => total + duration, 0),
        });
      } catch (caught) {
        if (active) setSummaryError(caught instanceof Error ? caught.message : "Your personal MOVEIT summary could not be loaded.");
      }
    };
    void loadSummary();
    return () => { active = false; };
  }, [client]);

  const submitActivity = async () => {
    const parsedDate = activityDraft.startsAt ? new Date(activityDraft.startsAt) : null;
    const parsed = activityInputSchema.safeParse({
      ...activityDraft,
      startsAt: parsedDate && Number.isFinite(parsedDate.getTime()) ? parsedDate.toISOString() : "",
      endsAt: null,
      capacity: Number(activityDraft.capacity),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the activity details.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (editingActivityId) {
        await repository.updateActivity(editingActivityId, parsed.data);
        setNotice("Activity changes saved.");
      } else {
        await repository.createActivity(parsed.data);
        setNotice("Activity published.");
      }
      setShowActivityForm(false);
      setEditingActivityId("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The activity could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const changeParticipation = async (activity: ActivityRecord) => {
    setSaving(true);
    setError("");
    try {
      if (activity.joinedByCurrentUser) await repository.leaveActivity(activity.id);
      else await repository.joinActivity(activity.id);
      setNotice(activity.joinedByCurrentUser ? "You left the activity." : "You joined the activity.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your participation could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const loadParticipants = async (activityId: string) => {
    if (activityParticipants.has(activityId) || participantLoads.has(activityId)) return;
    setParticipantLoads((current) => new Set(current).add(activityId));
    try {
      const participants = await repository.loadActivityParticipants(activityId);
      setActivityParticipants((current) => new Map(current).set(activityId, participants));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Activity participants could not be loaded.");
    } finally {
      setParticipantLoads((current) => {
        const next = new Set(current);
        next.delete(activityId);
        return next;
      });
    }
  };

  const toggleLike = async (postId: string) => {
    try {
      const liked = await repository.togglePostLike(postId);
      setLikes((current) => {
        const next = new Map(current);
        const item = next.get(postId) ?? { likes: 0, comments: 0, liked: false };
        next.set(postId, { ...item, liked, likes: Math.max(0, item.likes + (liked ? 1 : -1)) });
        return next;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your like could not be saved.");
    }
  };

  const publishPost = async () => {
    setSaving(true);
    setError("");
    try {
      await repository.createCommunityPost(newPost);
      setNewPost("");
      setNotice("Your post is live.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your post could not be published.");
    } finally {
      setSaving(false);
    }
  };

  const addComment = async (postId: string) => {
    const body = commentDrafts[postId] ?? "";
    try {
      const comment = await repository.addPostComment(postId, body);
      setComments((current) => new Map(current).set(postId, [...(current.get(postId) ?? []), comment]));
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      setLikes((current) => {
        const next = new Map(current);
        const item = next.get(postId) ?? { likes: 0, comments: 0, liked: false };
        next.set(postId, { ...item, comments: item.comments + 1 });
        return next;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your comment could not be saved.");
    }
  };

  const toggleFollow = async (athlete: DiscoveredAthlete) => {
    try {
      if (followed.has(athlete.id)) {
        await repository.unfollowPlayer(athlete.id);
        setFollowed((current) => {
          const next = new Set(current);
          next.delete(athlete.id);
          return next;
        });
      } else {
        await repository.followPlayer(athlete.id);
        setFollowed((current) => new Set(current).add(athlete.id));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your follow change could not be saved.");
    }
  };

  const changeConnection = async (athlete: DiscoveredAthlete, action?: "accept" | "decline") => {
    const connection = connections.get(athlete.id) ?? null;
    try {
      if (action) {
        if (!connection) throw new Error("Refresh the player list before responding to this request.");
        await repository.respondToPlayerConnection(connection.id, action === "accept" ? "accepted" : "rejected");
      } else if (connection?.status === "pending") {
        await repository.cancelPlayerConnection(connection.id);
      } else {
        await repository.requestPlayerConnection(athlete.id);
      }
      setConnections(await repository.loadPlayerConnections([athlete.id]));
      setNotice(action === "accept" ? "Connection accepted." : "Connection updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The connection could not be updated.");
    }
  };

  const editActivity = (activity: ActivityRecord) => {
    setEditingActivityId(activity.id);
    setActivityDraft({
      sportId: activity.sportId,
      title: activity.title,
      description: activity.description,
      startsAt: toLocalDateTime(activity.startsAt),
      venueName: activity.venueName,
      city: activity.city,
      capacity: String(activity.capacity),
      requiredSkillLevel: activity.requiredSkillLevel ?? "",
      visibility: activity.visibility,
    });
    setShowActivityForm(true);
  };
  const upcomingActivities = myActivities
    .filter((activity) => activity.status === "published" && Date.parse(activity.startsAt) >= Date.now())
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt));
  const activityHistory = myActivities
    .filter((activity) => activity.status === "cancelled" || Date.parse(activity.startsAt) < Date.now())
    .sort((left, right) => right.startsAt.localeCompare(left.startsAt));

  return (
    <section className="platform-hub" aria-label="MOVEIT sports community">
      <div className="hub-heading">
        <div>
          <p className="eyebrow">YOUR MOVEIT COMMUNITY</p>
          <h2>Find your next move.</h2>
        </div>
        <button className="text-button" onClick={() => void load()} disabled={loading}>Refresh</button>
      </div>
      <nav className="hub-tabs" aria-label="MOVEIT sections">
        {([
          ["discover", "Discover"],
          ["activities", "My activities"],
          ["community", "Community"],
          ["venues", "Venues & coaches"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {error ? <p className="feedback error" role="alert">{error}</p> : null}
      {summaryError ? <p className="feedback error" role="alert">{summaryError}</p> : null}
      {notice ? <p className="feedback success" role="status">{notice}</p> : null}
      {loading || moreLoading ? <p className="muted" role="status">Loading real MOVEIT records…</p> : null}
      <div className="hub-summary" aria-label="Your MOVEIT dashboard summary">
        <section>
          <strong>Your sports</strong>
          <p>{mySports.length
            ? mySports.map((sport) => `${sportsCatalogue.find(({ id }) => id === sport.sportId)?.name ?? sport.sportId} · ${sport.skillLevel ?? "skill not set"}${sport.isPreferred ? " · favourite" : ""}`).join(" · ")
            : "No sports saved yet."}</p>
        </section>
        <section>
          <strong>Fitness goals</strong>
          <p>{fitnessGoals.length ? fitnessGoals.join(" · ") : "No fitness goals saved."}</p>
        </section>
        <section>
          <strong>Fitness · last 7 days</strong>
          <p>{weeklyFitness
            ? `${weeklyFitness.workouts} saved workouts · ${weeklyFitness.minutes} minutes`
            : "Loading saved fitness data…"}</p>
        </section>
        <section>
          <strong>Community</strong>
          <p>{socialSummary
            ? `${socialSummary.followers} followers · following ${socialSummary.following} · ${socialSummary.connections} connections · ${socialSummary.posts} posts · ${socialSummary.unreadNotifications} unread notifications`
            : "Loading your community summary…"}</p>
          {recentNotifications.slice(0, 3).map((notification) => (
            <p key={notification.id}>
              {notification.actor?.display_name ?? "A MOVEIT player"} · {notification.type.replaceAll("_", " ")}
            </p>
          ))}
        </section>
        <section>
          <strong>Upcoming activities</strong>
          {upcomingActivities.length ? upcomingActivities.slice(0, 3).map((activity) => (
            <p key={activity.id}>
              {activity.title} · {new Date(activity.startsAt).toLocaleString()} · {activity.city}
            </p>
          )) : <p>No upcoming activities yet.</p>}
        </section>
        <section>
          <strong>Recent activity history</strong>
          {activityHistory.length ? activityHistory.slice(0, 3).map((activity) => (
            <p key={activity.id}>{activity.title} · {activity.status}</p>
          )) : <p>Your participation history will appear here.</p>}
        </section>
      </div>

      {tab === "discover" ? (
        <div className="hub-section">
          <div className="hub-tabs compact" aria-label="Discovery type">
            {([
              ["activities", "Activities"],
              ["athletes", "Athletes"],
              ["sports", "Sports"],
              ["venues", "Venues"],
              ["coaches", "Coaches"],
            ] as const).map(([id, label]) => (
              <button key={id} type="button" className={discoverKind === id ? "active" : ""} onClick={() => setDiscoverKind(id)}>{label}</button>
            ))}
          </div>
          {discoverKind === "activities" || discoverKind === "athletes" ? <div className="hub-filters">
            <label>Search<input aria-label="Search MOVEIT" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Title, player or username" /></label>
            <label>City or area<input aria-label="Filter by city" value={city} onChange={(event) => setCity(event.currentTarget.value)} /></label>
            <label>Sport<select aria-label="Filter by sport" value={sportId} onChange={(event) => setSportId(event.currentTarget.value)}><option value="">All sports</option>{sportsCatalogue.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label>
            <label>Skill level<select aria-label="Filter by skill" value={skill} onChange={(event) => setSkill(event.currentTarget.value)}><option value="">Any level</option>{skillLevels.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
            <button className="primary-button" type="button" onClick={() => void load(0, false)}>Search</button>
          </div> : null}
          {discoverKind === "activities" ? <p className="muted">Activity type is not stored in the current backend model; search filters use sport, skill level, and city.</p> : null}
          {discoverKind === "venues" || discoverKind === "coaches" ? (
            <DirectoryPanel client={client} profile={profile} initialKind={discoverKind} />
          ) : null}
          {discoverKind === "sports" ? (
            <div className="hub-list">
              <label>Search sports<input aria-label="Search sports catalogue" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Sport name" /></label>
              {sportsCatalogue
                .filter((sport) => !query.trim() || `${sport.id} ${sport.name} ${sport.category}`.toLowerCase().includes(query.trim().toLowerCase()))
                .slice(0, 60)
                .map((sport) => <article className="hub-card" key={sport.id}><strong>{sport.name}</strong><span>{sport.category}</span></article>)}
            </div>
          ) : null}
          {discoverKind === "activities" ? (
            <div className="hub-list">
              {activities.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  onJoin={() => void changeParticipation(activity)}
                  busy={saving}
                  participants={activityParticipants.get(activity.id)}
                  participantsLoading={participantLoads.has(activity.id)}
                  onLoadParticipants={() => void loadParticipants(activity.id)}
                />
              ))}
              {!loading && activities.length === 0 ? <EmptyResults>There are no upcoming public activities matching these filters.</EmptyResults> : null}
              {discoveryHasMore ? <button className="secondary-button" type="button" disabled={moreLoading} onClick={() => void load(discoveryOffset + 20, true)}>Load more activities</button> : null}
            </div>
          ) : discoverKind === "athletes" ? (
            <div className="hub-list">
              {athletes.map((athlete) => (
                <article className="hub-card athlete-card" key={athlete.id}>
                  <div className="athlete-avatar">{athlete.avatarPublicUrl ? <img src={athlete.avatarPublicUrl} alt="" /> : athlete.display_name.charAt(0).toUpperCase()}</div>
                  <div className="hub-card-main">
                    <strong>{athlete.display_name || `@${athlete.username}`}</strong>
                    <span>@{athlete.username} · {athlete.city}</span>
                    {athlete.bio ? <p>{athlete.bio}</p> : null}
                    <details className="athlete-profile-details">
                      <summary>View public profile</summary>
                      <dl>
                        <div><dt>Display name</dt><dd>{athlete.display_name || athlete.username}</dd></div>
                        <div><dt>Username</dt><dd>@{athlete.username}</dd></div>
                        <div><dt>City or area</dt><dd>{athlete.city}</dd></div>
                        <div><dt>About</dt><dd>{athlete.bio || "No bio added."}</dd></div>
                      </dl>
                    </details>
                  </div>
                  <div className="hub-card-actions">
                    <button type="button" className="secondary-button" onClick={() => void toggleFollow(athlete)}>{followed.has(athlete.id) ? "Following" : "Follow"}</button>
                    <ConnectionButton connection={connections.get(athlete.id) ?? null} onAction={(action) => void changeConnection(athlete, action)} />
                  </div>
                </article>
              ))}
              {!loading && athletes.length === 0 ? <EmptyResults>No public athletes match these filters. Try another location or sport.</EmptyResults> : null}
              {discoveryHasMore ? <button className="secondary-button" type="button" disabled={moreLoading} onClick={() => void load(discoveryOffset + 20, true)}>Load more athletes</button> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "activities" ? (
        <div className="hub-section">
          <div className="hub-heading compact-heading">
            <h3>Your upcoming and past activities</h3>
            <button className="primary-button" type="button" onClick={() => {
              setEditingActivityId("");
              setActivityDraft(emptyDraft(profile.city));
              setShowActivityForm((value) => !value);
            }}>{showActivityForm ? "Close form" : "Create activity"}</button>
          </div>
          {showActivityForm ? (
            <ActivityForm draft={activityDraft} setDraft={setActivityDraft} saving={saving} onSave={() => void submitActivity()} />
          ) : null}
          <div className="hub-list">
            {myActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                busy={saving}
                onJoin={() => void changeParticipation(activity)}
                organizer={activity.organizerId === profile.id}
                onEdit={() => editActivity(activity)}
                participants={activityParticipants.get(activity.id)}
                participantsLoading={participantLoads.has(activity.id)}
                onLoadParticipants={() => void loadParticipants(activity.id)}
                onCancel={async () => {
                  if (!window.confirm("Cancel this activity? Participants will no longer be able to join.")) return;
                  try {
                    await repository.cancelActivity(activity.id);
                    await load();
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : "Activity cancellation failed.");
                  }
                }}
              />
            ))}
            {!loading && myActivities.length === 0 ? <EmptyResults>You have not joined or organized any activities yet.</EmptyResults> : null}
          </div>
        </div>
      ) : null}

      {tab === "community" ? (
        <div className="hub-section">
          <div className="community-compose">
            <label htmlFor="community-post">Share with the community</label>
            <textarea id="community-post" value={newPost} maxLength={2000} onChange={(event) => setNewPost(event.currentTarget.value)} placeholder="A game idea, a small win, or a question…" />
            <button type="button" className="primary-button" disabled={saving || !newPost.trim()} onClick={() => void publishPost()}>{saving ? "Publishing…" : "Publish post"}</button>
          </div>
          <div className="hub-list">
            {posts.map((post) => {
              const interactions = likes.get(post.id) ?? { likes: 0, comments: 0, liked: false };
              return (
                <article className="hub-card post-card" key={post.id}>
                  <div className="post-byline">
                    <strong>{post.author?.display_name || "MOVEIT player"}</strong>
                    <span>@{post.author?.username ?? "member"} · {post.author?.city ?? ""} · {new Date(post.created_at).toLocaleString()}</span>
                  </div>
                  <p>{post.body}</p>
                  {post.author_id === profile.id ? (
                    <details>
                      <summary>Edit post</summary>
                      <EditPost client={client} post={post} onSaved={() => void load()} onError={setError} />
                    </details>
                  ) : null}
                  <div className="post-actions">
                    <button type="button" onClick={() => void toggleLike(post.id)}>{interactions.liked ? "Liked" : "Like"} · {interactions.likes}</button>
                    <span>{interactions.comments} comments</span>
                    {post.author_id === profile.id ? (
                      <button type="button" onClick={async () => {
                        if (!window.confirm("Delete this post?")) return;
                        try { await repository.deleteCommunityPost(post.id); await load(); }
                        catch (caught) { setError(caught instanceof Error ? caught.message : "Post deletion failed."); }
                      }}>Delete</button>
                    ) : null}
                  </div>
                  <div className="post-comments">
                    {(comments.get(post.id) ?? []).map((comment) => <p key={comment.id}><strong>{comment.author?.display_name ?? "MOVEIT player"}</strong> {comment.body}</p>)}
                    <div className="comment-compose">
                      <input aria-label="Write a comment" value={commentDrafts[post.id] ?? ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.currentTarget.value }))} placeholder="Write a comment" maxLength={1000} />
                      <button type="button" className="secondary-button" disabled={!(commentDrafts[post.id] ?? "").trim()} onClick={() => void addComment(post.id)}>Comment</button>
                    </div>
                  </div>
                </article>
              );
            })}
            {!loading && posts.length === 0 ? <EmptyResults>No community posts yet. Share the first one.</EmptyResults> : null}
          </div>
        </div>
      ) : null}

      {tab === "venues" ? (
        <DirectoryPanel client={client} profile={profile} />
      ) : null}
    </section>
  );
}

type ActivityDraft = {
  sportId: string;
  title: string;
  description: string;
  startsAt: string;
  venueName: string;
  city: string;
  capacity: string;
  requiredSkillLevel: SportSkillLevel | "";
  visibility: ActivityInput["visibility"];
};

function emptyDraft(city = ""): ActivityDraft {
  const tomorrow = new Date(Date.now() + 86_400_000);
  tomorrow.setMinutes(0, 0, 0);
  tomorrow.setHours(19);
  return {
    sportId: sportsCatalogue[0]?.id ?? "football",
    title: "",
    description: "",
    startsAt: toLocalDateTime(tomorrow.toISOString()),
    venueName: "",
    city,
    capacity: "12",
    requiredSkillLevel: "",
    visibility: "public",
  };
}

function toLocalDateTime(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function ActivityForm({
  draft,
  setDraft,
  saving,
  onSave,
}: {
  draft: ActivityDraft;
  setDraft: (draft: ActivityDraft) => void;
  saving: boolean;
  onSave: () => void;
}) {
  const set = <K extends keyof ActivityDraft>(key: K, value: ActivityDraft[K]) => setDraft({ ...draft, [key]: value });
  return (
    <div className="hub-form">
      <label>Sport<select value={draft.sportId} onChange={(event) => set("sportId", event.currentTarget.value)}>{sportsCatalogue.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label>
      <label>Title<input value={draft.title} onChange={(event) => set("title", event.currentTarget.value)} maxLength={120} /></label>
      <label>Description<textarea value={draft.description} onChange={(event) => set("description", event.currentTarget.value)} maxLength={2000} /></label>
      <label>Date and time<input type="datetime-local" value={draft.startsAt} onChange={(event) => set("startsAt", event.currentTarget.value)} /></label>
      <label>Venue or meeting place<input value={draft.venueName} onChange={(event) => set("venueName", event.currentTarget.value)} maxLength={160} /></label>
      <label>City or area<input value={draft.city} onChange={(event) => set("city", event.currentTarget.value)} maxLength={80} /></label>
      <label>Capacity<input type="number" min={2} max={200} value={draft.capacity} onChange={(event) => set("capacity", event.currentTarget.value)} /></label>
      <label>Minimum skill<select value={draft.requiredSkillLevel} onChange={(event) => set("requiredSkillLevel", event.currentTarget.value as SportSkillLevel | "")}><option value="">Any level</option>{skillLevels.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
      <label>Visibility<select value={draft.visibility} onChange={(event) => set("visibility", event.currentTarget.value as ActivityInput["visibility"])}><option value="public">Public</option><option value="private">Private</option></select></label>
      <button type="button" className="primary-button" disabled={saving} onClick={onSave}>{saving ? "Saving…" : "Save activity"}</button>
    </div>
  );
}

function ActivityCard({
  activity,
  onJoin,
  busy,
  organizer = false,
  onEdit,
  onCancel,
  participants,
  participantsLoading = false,
  onLoadParticipants,
}: {
  activity: ActivityRecord;
  onJoin: () => void;
  busy: boolean;
  organizer?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  participants?: ActivityParticipant[];
  participantsLoading?: boolean;
  onLoadParticipants?: () => void;
}) {
  const [showParticipants, setShowParticipants] = useState(false);
  const sport = sportsCatalogue.find(({ id }) => id === activity.sportId)?.name ?? activity.sportId;
  return (
    <article className="hub-card">
      <div className="hub-card-main">
        <strong>{activity.title}</strong>
        <span>{sport} · {activity.requiredSkillLevel ?? "All levels"} · {activity.status}</span>
        <span>{new Date(activity.startsAt).toLocaleString()} · {activity.venueName} · {activity.city}</span>
        {activity.description ? <p>{activity.description}</p> : null}
        <span>{activity.participantCount}/{activity.capacity} participants · {activity.visibility}</span>
        <button
          type="button"
          className="text-button participant-toggle"
          aria-expanded={showParticipants}
          onClick={() => {
            const nextVisible = !showParticipants;
            setShowParticipants(nextVisible);
            if (nextVisible && !participants) onLoadParticipants?.();
          }}
        >
          {showParticipants ? "Hide participants" : "View participants"}
        </button>
        {showParticipants ? (
          <div className="activity-participants" aria-live="polite">
            {participantsLoading ? <span>Loading participants…</span> : null}
            {participants?.map((participant) => (
              <span key={participant.userId}>
                {participant.profile
                  ? `${participant.profile.display_name} · @${participant.profile.username}`
                  : "MOVEIT athlete"}
                {participant.userId === activity.organizerId ? " · Organizer" : ""}
              </span>
            ))}
            {!participantsLoading && participants?.length === 0 ? <span>No participants yet.</span> : null}
          </div>
        ) : null}
      </div>
      {!organizer && activity.status === "published" ? (
        <button type="button" className="secondary-button" disabled={busy || (!activity.joinedByCurrentUser && activity.participantCount >= activity.capacity)} onClick={onJoin}>
          {activity.joinedByCurrentUser ? "Leave" : "Join"}
        </button>
      ) : null}
      {organizer && activity.status === "published" ? (
        <div className="hub-card-actions">
          <button type="button" className="secondary-button" onClick={onEdit}>Edit</button>
          <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button>
        </div>
      ) : null}
    </article>
  );
}

function EditPost({ client, post, onSaved, onError }: {
  client: SupabaseClient;
  post: CommunityPost;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [body, setBody] = useState(post.body);
  const [saving, setSaving] = useState(false);
  const repository = createCommunityPlatformRepository(client);
  return (
    <div className="hub-form">
      <label>Post text<textarea value={body} maxLength={2000} onChange={(event) => setBody(event.currentTarget.value)} /></label>
      <button className="secondary-button" type="button" disabled={saving} onClick={async () => {
        setSaving(true);
        try { await repository.updateCommunityPost(post.id, body); onSaved(); }
        catch (caught) { onError(caught instanceof Error ? caught.message : "Post update failed."); }
        finally { setSaving(false); }
      }}>{saving ? "Saving…" : "Save post"}</button>
    </div>
  );
}

function ConnectionButton({
  connection,
  onAction,
}: {
  connection: PlayerConnectionView | null;
  onAction: (action?: "accept" | "decline") => void;
}) {
  if (connection?.status === "accepted") return <span className="connection-state">Connected</span>;
  if (connection?.status === "rejected" && connection.direction === "incoming") {
    return <span className="connection-state">Request declined</span>;
  }
  if (connection?.status === "pending" && connection.direction === "incoming") {
    return (
      <>
        <button type="button" className="secondary-button" onClick={() => onAction("accept")}>Accept</button>
        <button type="button" className="secondary-button" onClick={() => onAction("decline")}>Decline</button>
      </>
    );
  }
  return (
    <button type="button" className="secondary-button" onClick={() => onAction()}>
      {connection?.status === "pending" ? "Cancel request" : connection?.status === "rejected" ? "Connect again" : "Connect"}
    </button>
  );
}

function EmptyResults({ children }: { children: string }) {
  return <div className="hub-empty">{children}</div>;
}
