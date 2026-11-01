import { afterEach, describe, expect, it } from "vitest";
import { flushDevelopmentWrites, writeDevelopmentData } from "./local-development-repository";
import {
  hydrateLocalCommunityRepository,
  localCommunityRepository,
  resetLocalCommunityRepositoryForTests,
} from "./local-community-repository";

afterEach(async () => {
  resetLocalCommunityRepositoryForTests();
  await flushDevelopmentWrites();
});

describe("local community repository", () => {
  it("creates, edits, and deletes posts owned by the local preview account", async () => {
    const post = await localCommunityRepository.createPost("Game on this weekend?");
    expect(post.author_id).toBe("local-preview-owner");
    expect((await localCommunityRepository.loadFeed()).map(({ body }) => body)).toEqual(["Game on this weekend?"]);

    const updated = await localCommunityRepository.updatePost(post.id, "Game on Saturday?");
    expect(updated.body).toBe("Game on Saturday?");

    await localCommunityRepository.deletePost(post.id);
    expect(await localCommunityRepository.loadFeed()).toEqual([]);
  });

  it("validates post and comment content", async () => {
    await expect(localCommunityRepository.createPost("  ")).rejects.toThrow("Write something");
    const post = await localCommunityRepository.createPost("A local post");
    await expect(localCommunityRepository.addComment(post.id, "  ")).rejects.toThrow();
    await expect(localCommunityRepository.addComment(post.id, "x".repeat(501))).rejects.toThrow();
  });

  it("toggles local likes and bookmarks without duplicate records", async () => {
    const post = await localCommunityRepository.createPost("Interaction test");
    expect(await localCommunityRepository.toggleLike(post.id)).toBe(true);
    expect(await localCommunityRepository.toggleLike(post.id)).toBe(false);
    expect(localCommunityRepository.getLikedPostIds()).toEqual([]);

    expect(await localCommunityRepository.toggleBookmark(post.id)).toBe(true);
    expect(await localCommunityRepository.toggleBookmark(post.id)).toBe(false);
    expect(localCommunityRepository.getBookmarkedPostIds()).toEqual([]);
  });

  it("stores local comments and restores them after hydration", async () => {
    const post = await localCommunityRepository.createPost("Persistence test");
    const comment = await localCommunityRepository.addComment(post.id, "See you there");
    await flushDevelopmentWrites();

    await hydrateLocalCommunityRepository();

    expect(localCommunityRepository.getComments(post.id)).toEqual([comment]);
    expect(localCommunityRepository.getPost(post.id)?.body).toBe("Persistence test");
  });

  it("does not allow editing or deleting another author’s post", async () => {
    const post = await localCommunityRepository.createPost("Owner check");
    const saved = await localCommunityRepository.loadFeed();
    await writeDevelopmentData("community-preview", {
      posts: [{ ...saved[0], author_id: "another-local-owner" }],
      likedPostIds: [],
      bookmarkedPostIds: [],
      comments: [],
    });
    await hydrateLocalCommunityRepository();

    await expect(localCommunityRepository.updatePost(post.id, "Tampered")).rejects.toThrow("only manage your own");
    await expect(localCommunityRepository.deletePost(post.id)).rejects.toThrow("only manage your own");
  });
});
