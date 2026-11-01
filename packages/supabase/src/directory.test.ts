import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDirectoryRepository, DirectoryRepositoryError } from "./directory";

const userId = "00000000-0000-4000-8000-000000000001";

function mockDirectoryClient(rpcData: unknown[] = [], singleData: unknown[] = []) {
  const inserted: unknown[] = [];
  const rpc = vi.fn(async () => ({ data: rpcData.shift() ?? [], error: null }));
  const from = vi.fn(() => {
    const builder = {
      insert: vi.fn((value: unknown) => {
        inserted.push(value);
        return builder;
      }),
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      order: vi.fn(() => builder),
      upsert: vi.fn((value: unknown) => {
        inserted.push(value);
        return builder;
      }),
      single: vi.fn(async () => ({ data: singleData.shift() ?? null, error: null })),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(resolve, reject),
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
  return { client, rpc, from, inserted };
}

describe("createDirectoryRepository", () => {
  it("uses validated filters for live venue and coach discovery", async () => {
    const mock = mockDirectoryClient([[{
      id: "00000000-0000-4000-8000-000000000010",
      business_id: "00000000-0000-4000-8000-000000000011",
      name: "City Courts",
      description: "",
      city: "Lahore",
      area: "Gulberg",
      sport_ids: ["tennis"],
      business_name: "City Sports",
      created_at: "2026-10-30T12:00:00.000Z",
    }]]);
    const repository = createDirectoryRepository(mock.client);

    await expect(repository.discoverVenues({
      query: "court",
      city: "Lahore",
      sportId: "tennis",
      limit: 10,
    })).resolves.toMatchObject([{ name: "City Courts", businessName: "City Sports", sportIds: ["tennis"] }]);
    expect(mock.rpc).toHaveBeenCalledWith("discover_public_venues", {
      p_query: "court",
      p_city: "Lahore",
      p_sport_id: "tennis",
      p_limit: 10,
      p_offset: 0,
    });
  });

  it("derives business ownership from the authenticated user", async () => {
    const mock = mockDirectoryClient([], [{
      id: "00000000-0000-4000-8000-000000000020",
      owner_id: userId,
      name: "My Gym",
      business_type: "gym",
      city: "Lahore",
      area: "Gulberg",
      status: "published",
      created_at: "2026-10-30T12:00:00.000Z",
    }]);
    const repository = createDirectoryRepository(mock.client);
    const input = {
      name: "My Gym",
      businessType: "gym" as const,
      city: "Lahore",
      area: "Gulberg",
      ownerId: "00000000-0000-4000-8000-000000000099",
    };

    await repository.createBusiness(input);
    expect(mock.inserted[0]).toMatchObject({ owner_id: userId, business_type: "gym", status: "published" });
    expect(mock.inserted[0]).not.toMatchObject({ owner_id: input.ownerId });
  });

  it("rejects malformed business data before accessing Supabase", async () => {
    const mock = mockDirectoryClient();
    const repository = createDirectoryRepository(mock.client);

    await expect(repository.createBusiness({
      name: "x",
      businessType: "gym",
      city: "Lahore",
      area: "",
    })).rejects.toMatchObject<Partial<DirectoryRepositoryError>>({ code: "VALIDATION" });
    expect(mock.client.auth.getUser).not.toHaveBeenCalled();
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("sends inquiries with the authenticated requester identity", async () => {
    const mock = mockDirectoryClient();
    const repository = createDirectoryRepository(mock.client);

    await repository.createCoachInquiry("00000000-0000-4000-8000-000000000002", "Can we discuss coaching?");
    expect(mock.inserted[0]).toEqual({
      coach_id: "00000000-0000-4000-8000-000000000002",
      requester_id: userId,
      message: "Can we discuss coaching?",
    });
  });
});
