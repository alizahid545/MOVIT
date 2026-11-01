import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCommunityPlatformRepository, PlatformRepositoryError } from "./community-platform";

const userId = "00000000-0000-4000-8000-000000000001";

function mockPlatformClient(
  rpcResults: Array<{ data?: unknown; error?: unknown }> = [],
  tableResults: Record<string, Array<{ data?: unknown; error?: unknown }>> = {},
) {
  const rpc = vi.fn(async () => rpcResults.shift() ?? { data: null, error: null });
  const from = vi.fn((table: string) => {
    const results = tableResults[table] ?? [];
    const builder = {
      select: vi.fn(() => builder),
      insert: vi.fn(() => builder),
      update: vi.fn(() => builder),
      delete: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      is: vi.fn(() => builder),
      in: vi.fn(() => builder),
      or: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      range: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => results.shift() ?? { data: null, error: null }),
      single: vi.fn(async () => results.shift() ?? { data: null, error: null }),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(results.shift() ?? { data: [], error: null }).then(resolve, reject),
    };
    return builder;
  });
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: userId } }, error: null })) },
    rpc,
    from,
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: vi.fn((path: string) => ({
          data: { publicUrl: `https://project.example/moveit-avatars/${path}` },
        })),
      })),
    },
  } as unknown as SupabaseClient;
  return { client, rpc, from };
}

describe("createCommunityPlatformRepository", () => {
  it("uses the authenticated identity for public athlete discovery filters", async () => {
    const mock = mockPlatformClient([{
      data: [{
        id: "00000000-0000-4000-8000-000000000002",
        username: "player_two",
        display_name: "Player Two",
        bio: "",
        city: "Lahore",
        avatar_object_path: null,
      }],
      error: null,
    }]);
    const repository = createCommunityPlatformRepository(mock.client);

    await expect(repository.discoverAthletes({
      query: "player",
      city: "Lahore",
      sportId: "football",
      requiredSkillLevel: "advanced",
    })).resolves.toMatchObject([{ username: "player_two", city: "Lahore" }]);
    expect(mock.rpc).toHaveBeenCalledWith("discover_public_athletes", {
      p_query: "player",
      p_city: "Lahore",
      p_sport_id: "football",
      p_skill_level: "advanced",
      p_limit: 20,
      p_offset: 0,
    });
  });

  it("creates an activity through the validated server-side RPC", async () => {
    const activityId = "00000000-0000-4000-8000-000000000010";
    const mock = mockPlatformClient([{ data: activityId, error: null }]);
    const repository = createCommunityPlatformRepository(mock.client);
    const activity = {
      sportId: "football",
      title: "Friday game",
      description: "",
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      endsAt: null,
      venueName: "City Sports Ground",
      city: "Lahore",
      capacity: 12,
      requiredSkillLevel: null,
      visibility: "public" as const,
    };

    await expect(repository.createActivity(activity)).resolves.toBe(activityId);
    expect(mock.rpc).toHaveBeenCalledWith("create_my_activity", expect.objectContaining({
      p_sport_id: "football",
      p_title: "Friday game",
      p_capacity: 12,
    }));
  });

  it("rejects invalid activity input before contacting Supabase", async () => {
    const mock = mockPlatformClient();
    const repository = createCommunityPlatformRepository(mock.client);

    await expect(repository.createActivity({
      sportId: "football",
      title: "x",
      description: "",
      startsAt: new Date(Date.now() - 1000).toISOString(),
      endsAt: null,
      venueName: "Ground",
      city: "Lahore",
      capacity: 1,
      requiredSkillLevel: null,
      visibility: "public",
    })).rejects.toMatchObject<Partial<PlatformRepositoryError>>({ code: "VALIDATION" });
    expect(mock.client.auth.getUser).not.toHaveBeenCalled();
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("returns a useful server error for full activities", async () => {
    const mock = mockPlatformClient([{
      data: null,
      error: { message: "This activity is full" },
    }]);
    const repository = createCommunityPlatformRepository(mock.client);

    await expect(repository.joinActivity("00000000-0000-4000-8000-000000000010"))
      .rejects.toMatchObject({
        code: "ACTIVITY_JOIN_FAILED",
        message: "This activity is full.",
      });
  });

  it("loads activity participants through the authenticated repository", async () => {
    const mock = mockPlatformClient([], {
      activity_participants: [{
        data: [{
          user_id: "00000000-0000-4000-8000-000000000002",
          joined_at: "2026-11-01T10:00:00.000Z",
          profile: {
            id: "00000000-0000-4000-8000-000000000002",
            username: "player_two",
            display_name: "Player Two",
            city: "Lahore",
          },
        }],
        error: null,
      }],
    });
    const repository = createCommunityPlatformRepository(mock.client);

    await expect(repository.loadActivityParticipants("00000000-0000-4000-8000-000000000010"))
      .resolves.toEqual([{
        userId: "00000000-0000-4000-8000-000000000002",
        joinedAt: "2026-11-01T10:00:00.000Z",
        profile: {
          id: "00000000-0000-4000-8000-000000000002",
          username: "player_two",
          display_name: "Player Two",
          city: "Lahore",
        },
      }]);
    expect(mock.client.auth.getUser).toHaveBeenCalledOnce();
    expect(mock.from).toHaveBeenCalledWith("activity_participants");
  });

  it("creates a post using only the authenticated identity", async () => {
    const post = {
      id: "00000000-0000-4000-8000-000000000020",
      author_id: userId,
      body: "Ready for a weekend game.",
      created_at: new Date().toISOString(),
      author: {
        id: userId,
        username: "player_one",
        display_name: "Player One",
        city: "Lahore",
      },
    };
    const mock = mockPlatformClient([], { posts: [{ data: post, error: null }] });
    const repository = createCommunityPlatformRepository(mock.client);

    await expect(repository.createCommunityPost(" Ready for a weekend game. ")).resolves.toMatchObject({
      author_id: userId,
      body: "Ready for a weekend game.",
      author: { username: "player_one" },
    });
    expect(mock.client.auth.getUser).toHaveBeenCalledOnce();
    expect(mock.from).toHaveBeenCalledWith("posts");
  });

  it("rejects invalid community posts before contacting Supabase", async () => {
    const mock = mockPlatformClient();
    const repository = createCommunityPlatformRepository(mock.client);

    await expect(repository.createCommunityPost("  ")).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(mock.client.auth.getUser).not.toHaveBeenCalled();
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("loads dashboard counts from authenticated social records", async () => {
    const mock = mockPlatformClient();
    const repository = createCommunityPlatformRepository(mock.client);

    await expect(repository.loadMySocialSummary()).resolves.toEqual({
      followers: 0,
      following: 0,
      connections: 0,
      posts: 0,
      unreadNotifications: 0,
    });
    expect(mock.client.auth.getUser).toHaveBeenCalledOnce();
    expect(mock.from).toHaveBeenCalledTimes(5);
    expect(mock.from).toHaveBeenCalledWith("player_follows");
    expect(mock.from).toHaveBeenCalledWith("player_connections");
    expect(mock.from).toHaveBeenCalledWith("notifications");
  });

  it("maps connection requests relative to the authenticated user", async () => {
    const mock = mockPlatformClient([], {
      player_connections: [{
        data: [{
          id: "00000000-0000-4000-8000-000000000030",
          requester_id: "00000000-0000-4000-8000-000000000002",
          recipient_id: userId,
          status: "pending",
          created_at: new Date().toISOString(),
        }],
        error: null,
      }],
    });
    const repository = createCommunityPlatformRepository(mock.client);

    const connections = await repository.loadPlayerConnections(["00000000-0000-4000-8000-000000000002"]);
    expect(connections.get("00000000-0000-4000-8000-000000000002")).toEqual({
      id: "00000000-0000-4000-8000-000000000030",
      status: "pending",
      direction: "incoming",
    });
  });
});
