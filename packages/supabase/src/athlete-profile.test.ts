import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ProfileRepositoryError, createAthleteProfileRepository } from "./athlete-profile";

const userId = "00000000-0000-4000-8000-000000000001";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: userId,
    username: "moveit_player",
    display_name: "MOVEIT Player",
    bio: "",
    city: "Lahore",
    visibility: "public",
    avatar_object_path: null,
    avatar_url: null,
    discovery_radius_km: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function mockClient(results: Array<{ data?: unknown; error?: unknown }> = []) {
  const select = vi.fn();
  const update = vi.fn();
  const insert = vi.fn();
  const eq = vi.fn();
  const rpc = vi.fn(async () => results.shift() ?? { data: null, error: null });
  const maybeSingle = vi.fn(async () => results.shift() ?? { data: null, error: null });
  const single = vi.fn(async () => results.shift() ?? { data: null, error: null });
  const builder = {
    select: (...args: unknown[]) => { select(...args); return builder; },
    update: (...args: unknown[]) => { update(...args); return builder; },
    insert: (...args: unknown[]) => { insert(...args); return builder; },
    eq: (...args: unknown[]) => { eq(...args); return builder; },
    maybeSingle,
    single,
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(results.shift() ?? { data: [], error: null }).then(resolve, reject),
  };
  const from = vi.fn(() => builder);
  const upload = vi.fn(async () => ({ data: { path: "unused" }, error: null }));
  const remove = vi.fn(async () => ({ data: [], error: null }));
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://project.example/storage/v1/object/public/moveit-avatars/${path}` },
  }));
  const client = {
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: userId } }, error: null })) },
    from,
    rpc,
    storage: {
      from: vi.fn(() => ({ upload, remove, getPublicUrl })),
    },
  } as unknown as SupabaseClient;

  return { client, select, update, insert, eq, rpc, from, maybeSingle, single, upload, remove, getPublicUrl };
}

afterEach(() => vi.restoreAllMocks());

describe("createAthleteProfileRepository", () => {
  it("loads only the profile belonging to the authenticated user", async () => {
    const mock = mockClient([{ data: row(), error: null }]);
    const repository = createAthleteProfileRepository(mock.client);

    await expect(repository.loadMyProfile()).resolves.toMatchObject({
      id: userId,
      displayName: "MOVEIT Player",
      avatarPublicUrl: null,
    });
    expect(mock.eq).toHaveBeenCalledWith("id", userId);
  });

  it("updates validated profile fields using the authenticated identity", async () => {
    const mock = mockClient([{ data: row({ username: "new_player", display_name: "New Player" }), error: null }]);
    const repository = createAthleteProfileRepository(mock.client);

    const saved = await repository.saveMyProfile({
      username: "New_Player",
      displayName: "New Player",
      bio: "",
      city: "Lahore",
    });

    expect(saved.username).toBe("new_player");
    expect(mock.update).toHaveBeenCalledWith({
      username: "new_player",
      display_name: "New Player",
      bio: "",
      city: "Lahore",
    });
    expect(mock.eq).toHaveBeenCalledWith("id", userId);
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it("returns a clear username conflict error", async () => {
    const mock = mockClient([{
      data: null,
      error: { code: "23505", constraint: "profiles_username_key", message: "duplicate key" },
    }]);
    const repository = createAthleteProfileRepository(mock.client);

    await expect(repository.saveMyProfile({
      username: "taken_user",
      displayName: "Player",
      bio: "",
      city: "Lahore",
    })).rejects.toMatchObject<Partial<ProfileRepositoryError>>({ code: "USERNAME_TAKEN" });
  });

  it("loads sports only for the authenticated user", async () => {
    const mock = mockClient([{
      data: [
        { sport_id: "football", skill_level: "intermediate", is_preferred: true },
      ],
      error: null,
    }]);
    const repository = createAthleteProfileRepository(mock.client);

    await expect(repository.loadMySportPreferences()).resolves.toEqual([
      { sportId: "football", skillLevel: "intermediate", isPreferred: true },
    ]);
    expect(mock.from).toHaveBeenCalledWith("profile_sports_preferences");
    expect(mock.eq).toHaveBeenCalledWith("user_id", userId);
  });

  it("saves validated sports without accepting a user ID from the caller", async () => {
    const mock = mockClient([
      { data: null, error: null },
      {
        data: [{ sport_id: "football", skill_level: "advanced", is_preferred: true }],
        error: null,
      },
    ]);
    const repository = createAthleteProfileRepository(mock.client);

    await expect(repository.saveMySportPreferences([
      { sportId: "football", skillLevel: "advanced", isPreferred: true },
    ])).resolves.toEqual([
      { sportId: "football", skillLevel: "advanced", isPreferred: true },
    ]);
    expect(mock.rpc).toHaveBeenCalledWith("save_my_sports_preferences", {
      p_preferences: [{ sportId: "football", skillLevel: "advanced", isPreferred: true }],
    });
    expect(mock.eq).toHaveBeenCalledWith("user_id", userId);
  });

  it("rejects invalid sports before contacting Supabase", async () => {
    const mock = mockClient();
    const repository = createAthleteProfileRepository(mock.client);

    await expect(repository.saveMySportPreferences([
      { sportId: "football!", skillLevel: "beginner", isPreferred: false },
    ])).rejects.toMatchObject<Partial<ProfileRepositoryError>>({ code: "VALIDATION" });
    expect(mock.client.auth.getUser).not.toHaveBeenCalled();
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("loads private preferences using the authenticated owner and handles missing goals", async () => {
    const mock = mockClient([
      { data: { visibility: "private", discovery_radius_km: 25 }, error: null },
      { data: null, error: null },
    ]);
    const repository = createAthleteProfileRepository(mock.client);

    await expect(repository.loadMyAthletePreferences()).resolves.toEqual({
      fitnessGoals: [],
      discoveryRadiusKm: 25,
      visibility: "private",
    });
    expect(mock.from).toHaveBeenCalledWith("profiles");
    expect(mock.from).toHaveBeenCalledWith("profile_fitness_goals");
    expect(mock.eq).toHaveBeenCalledWith("id", userId);
    expect(mock.eq).toHaveBeenCalledWith("user_id", userId);
  });

  it("saves validated preferences through the owner-derived RPC", async () => {
    const mock = mockClient([
      { data: null, error: null },
      { data: { visibility: "public", discovery_radius_km: 10 }, error: null },
      { data: { fitness_goals: ["build-strength"] }, error: null },
    ]);
    const repository = createAthleteProfileRepository(mock.client);

    await expect(repository.saveMyAthletePreferences({
      fitnessGoals: ["build-strength"],
      discoveryRadiusKm: 10,
      visibility: "public",
    })).resolves.toEqual({
      fitnessGoals: ["build-strength"],
      discoveryRadiusKm: 10,
      visibility: "public",
    });
    expect(mock.rpc).toHaveBeenCalledWith("save_my_athlete_preferences", {
      p_fitness_goals: ["build-strength"],
      p_discovery_radius_km: 10,
      p_visibility: "public",
    });
  });

  it("loads versioned onboarding state for the authenticated owner", async () => {
    const mock = mockClient([{
      data: {
        athlete_onboarding_version: 2,
        athlete_onboarding_step: "location",
        athlete_onboarding_completed_at: null,
      },
      error: null,
    }]);
    const repository = createAthleteProfileRepository(mock.client);

    await expect(repository.loadMyAthleteOnboardingState()).resolves.toEqual({
      version: 2,
      step: "location",
      completedAt: null,
    });
    expect(mock.eq).toHaveBeenCalledWith("user_id", userId);
  });

  it("saves onboarding progress through an owner-derived RPC", async () => {
    const mock = mockClient([{ data: null, error: null }]);
    const repository = createAthleteProfileRepository(mock.client);

    await expect(repository.saveMyAthleteOnboardingState("review", true)).resolves.toBeUndefined();
    expect(mock.rpc).toHaveBeenCalledWith("save_my_athlete_onboarding_state", {
      p_step: "review",
      p_completed: true,
    });
  });

  it("rejects invalid athlete preferences before contacting Supabase", async () => {
    const mock = mockClient();
    const repository = createAthleteProfileRepository(mock.client);

    await expect(repository.saveMyAthletePreferences({
      fitnessGoals: ["build-strength"],
      discoveryRadiusKm: 101,
      visibility: "public",
    })).rejects.toMatchObject<Partial<ProfileRepositoryError>>({ code: "VALIDATION" });
    expect(mock.client.auth.getUser).not.toHaveBeenCalled();
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("creates a missing profile with only the authenticated user's ID", async () => {
    const mock = mockClient([
      { data: null, error: null },
      { data: row({ username: "new_player", display_name: "New Player" }), error: null },
    ]);
    const repository = createAthleteProfileRepository(mock.client);

    await repository.saveMyProfile({
      username: "New_Player",
      displayName: "New Player",
      bio: "",
      city: "Lahore",
    });

    expect(mock.insert).toHaveBeenCalledWith({
      id: userId,
      username: "new_player",
      display_name: "New Player",
      bio: "",
      city: "Lahore",
    });
  });

  it("rejects disallowed avatar files before making authenticated requests", async () => {
    const mock = mockClient();
    const repository = createAthleteProfileRepository(mock.client);

    await expect(repository.uploadAvatar({
      bytes: new Uint8Array(10),
      mimeType: "image/svg+xml",
    })).rejects.toMatchObject<Partial<ProfileRepositoryError>>({ code: "AVATAR_INVALID" });
    expect(mock.client.auth.getUser).not.toHaveBeenCalled();
    expect(mock.upload).not.toHaveBeenCalled();
  });

  it("uploads a new immutable avatar and removes the previous owned object", async () => {
    const oldPath = `${userId}/00000000-0000-4000-8000-000000000002.jpg`;
    const nextPath = `${userId}/00000000-0000-4000-8000-000000000003.png`;
    const mock = mockClient([
      { data: row({ avatar_object_path: oldPath }), error: null },
      { data: row({ avatar_object_path: nextPath }), error: null },
    ]);
    const repository = createAthleteProfileRepository(mock.client, () => "00000000-0000-4000-8000-000000000003");

    const saved = await repository.uploadAvatar({
      bytes: new Uint8Array([1, 2, 3]),
      mimeType: "image/png",
    });

    expect(mock.upload).toHaveBeenCalledWith(nextPath, new Uint8Array([1, 2, 3]), {
      contentType: "image/png",
      upsert: false,
    });
    expect(saved.avatarObjectPath).toBe(nextPath);
    expect(mock.remove).toHaveBeenCalledWith([oldPath]);
  });

  it("clears the avatar reference and deletes only the saved owned object", async () => {
    const oldPath = `${userId}/00000000-0000-4000-8000-000000000002.webp`;
    const mock = mockClient([
      { data: row({ avatar_object_path: oldPath }), error: null },
      { data: row(), error: null },
    ]);
    const repository = createAthleteProfileRepository(mock.client);

    const saved = await repository.removeAvatar();

    expect(saved.avatarObjectPath).toBeNull();
    expect(mock.update).toHaveBeenCalledWith({ avatar_object_path: null, avatar_url: null });
    expect(mock.remove).toHaveBeenCalledWith([oldPath]);
  });
});
