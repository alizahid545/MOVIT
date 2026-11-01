import { communityPostSchema, type CommunityPost } from "@moveit/shared";
import { getDevelopmentProfile } from "./development-profile";
import { persistDevelopmentData, readDevelopmentData, writeDevelopmentData } from "./local-development-repository";

export type LocalCommunityComment = {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string;
};

type LocalCommunityData = {
  posts: CommunityPost[];
  likedPostIds: string[];
  bookmarkedPostIds: string[];
  comments: LocalCommunityComment[];
};

export interface CommunityRepository {
  loadFeed(): Promise<CommunityPost[]>;
  getPost(postId: string): CommunityPost | null;
  createPost(body: string): Promise<CommunityPost>;
  updatePost(postId: string, body: string): Promise<CommunityPost>;
  deletePost(postId: string): Promise<void>;
  toggleLike(postId: string): Promise<boolean>;
  toggleBookmark(postId: string): Promise<boolean>;
  addComment(postId: string, body: string): Promise<LocalCommunityComment>;
  getComments(postId: string): LocalCommunityComment[];
  getLikedPostIds(): string[];
  getBookmarkedPostIds(): string[];
}

const storageKey = "community-preview";
const localOwnerId = "local-preview-owner";
const commentSchema = communityPostSchema.shape.body.max(500, "Comments must be 500 characters or fewer.");

const emptyData = (): LocalCommunityData => ({
  posts: [],
  likedPostIds: [],
  bookmarkedPostIds: [],
  comments: [],
});

let data = emptyData();

export async function hydrateLocalCommunityRepository(): Promise<void> {
  const saved = await readDevelopmentData<LocalCommunityData>(storageKey, emptyData());
  data = {
    posts: Array.isArray(saved.posts) ? saved.posts : [],
    likedPostIds: Array.isArray(saved.likedPostIds) ? saved.likedPostIds : [],
    bookmarkedPostIds: Array.isArray(saved.bookmarkedPostIds) ? saved.bookmarkedPostIds : [],
    comments: Array.isArray(saved.comments) ? saved.comments : [],
  };
}

export const localCommunityRepository: CommunityRepository = {
  async loadFeed() {
    return data.posts.map(copyPost);
  },

  getPost(postId) {
    const post = data.posts.find((item) => item.id === postId);
    return post ? copyPost(post) : null;
  },

  async createPost(body) {
    const validated = communityPostSchema.parse({ body });
    const profile = getDevelopmentProfile();
    const post: CommunityPost = {
      id: createId("post"),
      author_id: localOwnerId,
      body: validated.body,
      created_at: new Date().toISOString(),
      author: {
        id: localOwnerId,
        username: profile.username || "local_demo_athlete",
        display_name: profile.displayName || "Local demo athlete",
        city: profile.city || "Local preview",
      },
    };
    data = { ...data, posts: [post, ...data.posts] };
    await writeData();
    return copyPost(post);
  },

  async updatePost(postId, body) {
    const validated = communityPostSchema.parse({ body });
    const existing = requireOwnedPost(postId);
    const updated = { ...existing, body: validated.body };
    data = { ...data, posts: data.posts.map((post) => post.id === postId ? updated : post) };
    await writeData();
    return copyPost(updated);
  },

  async deletePost(postId) {
    requireOwnedPost(postId);
    data = {
      ...data,
      posts: data.posts.filter((post) => post.id !== postId),
      likedPostIds: data.likedPostIds.filter((id) => id !== postId),
      bookmarkedPostIds: data.bookmarkedPostIds.filter((id) => id !== postId),
      comments: data.comments.filter((comment) => comment.postId !== postId),
    };
    await writeData();
  },

  async toggleLike(postId) {
    requirePost(postId);
    const liked = data.likedPostIds.includes(postId);
    data = {
      ...data,
      likedPostIds: liked
        ? data.likedPostIds.filter((id) => id !== postId)
        : [...data.likedPostIds, postId],
    };
    await writeData();
    return !liked;
  },

  async toggleBookmark(postId) {
    requirePost(postId);
    const bookmarked = data.bookmarkedPostIds.includes(postId);
    data = {
      ...data,
      bookmarkedPostIds: bookmarked
        ? data.bookmarkedPostIds.filter((id) => id !== postId)
        : [...data.bookmarkedPostIds, postId],
    };
    await writeData();
    return !bookmarked;
  },

  async addComment(postId, body) {
    requirePost(postId);
    const validatedBody = commentSchema.parse(body);
    const comment: LocalCommunityComment = {
      id: createId("comment"),
      postId,
      authorId: localOwnerId,
      body: validatedBody,
      createdAt: new Date().toISOString(),
    };
    data = { ...data, comments: [...data.comments, comment] };
    await writeData();
    return { ...comment };
  },

  getComments(postId) {
    return data.comments.filter((comment) => comment.postId === postId).map((comment) => ({ ...comment }));
  },

  getLikedPostIds() {
    return [...data.likedPostIds];
  },

  getBookmarkedPostIds() {
    return [...data.bookmarkedPostIds];
  },
};

export function resetLocalCommunityRepositoryForTests(): void {
  data = emptyData();
  persistDevelopmentData(storageKey, data);
}

function requirePost(postId: string): CommunityPost {
  const post = data.posts.find((item) => item.id === postId);
  if (!post) throw new Error("This local community post is unavailable.");
  return post;
}

function requireOwnedPost(postId: string): CommunityPost {
  const post = requirePost(postId);
  if (post.author_id !== localOwnerId) throw new Error("You can only manage your own local preview posts.");
  return post;
}

async function writeData(): Promise<void> {
  await writeDevelopmentData(storageKey, data);
}

function copyPost(post: CommunityPost): CommunityPost {
  return { ...post, author: post.author ? { ...post.author } : null };
}

function createId(kind: string): string {
  return `local-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
