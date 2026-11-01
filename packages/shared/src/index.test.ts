import { describe, expect, it } from "vitest";
import {
  authFormSchema,
  athleteProfileSchema,
  athleteOnboardingStepSchema,
  athletePreferencesSchema,
  activityInputSchema,
  activitySearchSchema,
  businessProfileInputSchema,
  coachProfileInputSchema,
  fitnessGoalsSchema,
  directoryInquirySchema,
  directorySearchSchema,
  venueListingInputSchema,
  avatarUploadSchema,
  bodyWeightSchema,
  communityPostSchema,
  dailyMetricSchema,
  fitnessGoalSchema,
  getDailyFitnessTotals,
  getLocalDateKey,
  getPlayerConnectionView,
  getWorkoutPerformanceSummary,
  getWeeklyWorkoutMinutes,
  profileSchema,
  sportPreferencesInputSchema,
  sportSkillLevelSchema,
  toProfileUpdate,
  usernameSchema,
  workoutSchema,
} from "./index";

describe("usernameSchema", () => {
  it("normalizes valid usernames to lowercase", () => {
    expect(usernameSchema.parse("FastBreak_7")).toBe("fastbreak_7");
  });

  it("rejects usernames with unsupported characters", () => {
    expect(usernameSchema.safeParse("fast break").success).toBe(false);
  });
});

describe("profileSchema", () => {
  it("requires a usable profile and accepts optional bio", () => {
    expect(profileSchema.parse({
      username: "AliRuns",
      displayName: "Ali",
      city: "Lahore",
      bio: "",
    })).toMatchObject({ username: "aliruns", city: "Lahore" });
  });

  it("rejects bios over the supported limit", () => {
    expect(profileSchema.safeParse({
      username: "ali_runner",
      displayName: "Ali",
      city: "Lahore",
      bio: "x".repeat(281),
    }).success).toBe(false);
  });

  it("matches the profile table's text limits and username format", () => {
    const valid = {
      username: "athlete_7",
      displayName: "A".repeat(60),
      city: "C".repeat(80),
      bio: "B".repeat(280),
    };
    expect(profileSchema.safeParse(valid).success).toBe(true);
    expect(profileSchema.safeParse({ ...valid, username: "ab" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, username: "a".repeat(25) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, username: "name-with-dash" }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, displayName: "A".repeat(61) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, city: "C".repeat(81) }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, city: " " }).success).toBe(false);
  });

  it("restricts avatar uploads to the allowed MIME types and 5 MiB limit", () => {
    for (const mimeType of ["image/jpeg", "image/png", "image/webp"]) {
      expect(avatarUploadSchema.safeParse({ mimeType, size: 5 * 1024 * 1024 }).success).toBe(true);
    }
    expect(avatarUploadSchema.safeParse({ mimeType: "image/svg+xml", size: 100 }).success).toBe(false);
    expect(avatarUploadSchema.safeParse({ mimeType: "image/png", size: 5 * 1024 * 1024 + 1 }).success).toBe(false);
    expect(avatarUploadSchema.safeParse({ mimeType: "image/png", size: 0 }).success).toBe(false);
  });

  it("maps validated form fields to the database column names", () => {
    expect(toProfileUpdate({
      username: "ali_runner",
      displayName: "Ali",
      city: "Lahore",
      bio: "",
    })).toEqual({
      username: "ali_runner",
      display_name: "Ali",
      city: "Lahore",
      bio: "",
    });
  });
});

describe("athleteProfileSchema", () => {
  const validProfile = {
    username: "moveit_player",
    displayName: "Moveit Player",
    bio: "",
    city: "Lahore",
    avatarUrl: "",
    sportsInterests: ["cricket", "football"],
    fitnessGoals: ["Train three times a week"],
  };

  it("accepts profile details and normalizes a blank avatar URL", () => {
    expect(athleteProfileSchema.parse(validProfile)).toMatchObject({
      avatarUrl: null,
      sportsInterests: ["cricket", "football"],
      fitnessGoals: ["Train three times a week"],
    });
  });

  it("rejects invalid avatar URLs and excessive list lengths", () => {
    expect(athleteProfileSchema.safeParse({ ...validProfile, avatarUrl: "not a URL" }).success).toBe(false);
    expect(athleteProfileSchema.safeParse({ ...validProfile, avatarUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(athleteProfileSchema.safeParse({ ...validProfile, sportsInterests: Array(21).fill("sport") }).success).toBe(false);
    expect(athleteProfileSchema.safeParse({ ...validProfile, fitnessGoals: Array(13).fill("goal") }).success).toBe(false);
    expect(athleteProfileSchema.safeParse({ ...validProfile, sportsInterests: ["cricket", "cricket"] }).success).toBe(false);
  });
});

describe("sport preferences validation", () => {
  const preferences = [
    { sportId: "football", skillLevel: "intermediate", isPreferred: true },
    { sportId: "table-tennis", skillLevel: "beginner", isPreferred: false },
  ] as const;

  it("accepts multiple catalogue IDs with self-reported skill and preferred states", () => {
    expect(sportPreferencesInputSchema.parse(preferences)).toEqual(preferences);
  });

  it("rejects duplicate IDs, unsupported IDs, invalid levels, and more than 20 entries", () => {
    expect(sportPreferencesInputSchema.safeParse([
      preferences[0],
      { ...preferences[0], isPreferred: false },
    ]).success).toBe(false);
    expect(sportPreferencesInputSchema.safeParse([
      { ...preferences[0], sportId: "Football!" },
    ]).success).toBe(false);
    expect(sportPreferencesInputSchema.safeParse([
      { ...preferences[0], skillLevel: "expert" },
    ]).success).toBe(false);
    expect(sportPreferencesInputSchema.safeParse(
      Array.from({ length: 21 }, (_, index) => ({
        sportId: `sport-${index}`,
        skillLevel: "beginner",
        isPreferred: false,
      })),
    ).success).toBe(false);
  });

  it("supports the required professional skill level", () => {
    expect(sportSkillLevelSchema.parse("professional")).toBe("professional");
    expect(sportPreferencesInputSchema.safeParse([
      { sportId: "football", skillLevel: "professional", isPreferred: true },
    ]).success).toBe(true);
  });
});

describe("athlete preferences validation", () => {
  it("validates optional fitness goals, radius and visibility", () => {
    expect(athletePreferencesSchema.parse({
      fitnessGoals: ["improve-stamina", "build-strength"],
      discoveryRadiusKm: 25,
      visibility: "private",
    })).toMatchObject({ discoveryRadiusKm: 25, visibility: "private" });
    expect(athletePreferencesSchema.safeParse({
      fitnessGoals: [],
      discoveryRadiusKm: null,
      visibility: "public",
    }).success).toBe(true);
  });

  it("rejects duplicate goals, excessive lists, and invalid radius values", () => {
    expect(fitnessGoalsSchema.safeParse(["Improve stamina", "improve stamina"]).success).toBe(false);
    expect(fitnessGoalsSchema.safeParse(Array(13).fill("goal")).success).toBe(false);
    expect(athletePreferencesSchema.safeParse({
      fitnessGoals: [],
      discoveryRadiusKm: 101,
      visibility: "public",
    }).success).toBe(false);
  });

  it("accepts only known versioned athlete onboarding steps", () => {
    expect(athleteOnboardingStepSchema.safeParse("review").success).toBe(true);
    expect(athleteOnboardingStepSchema.safeParse("unknown").success).toBe(false);
  });
});

describe("activity validation", () => {
  const validActivity = {
    sportId: "football",
    title: "Friday evening football",
    description: "Friendly game, bring water.",
    startsAt: new Date(Date.now() + 86_400_000).toISOString(),
    endsAt: null,
    venueName: "City Sports Ground",
    city: "Lahore",
    capacity: 12,
    requiredSkillLevel: "beginner" as const,
    visibility: "public" as const,
  };

  it("accepts a future activity with supported capacity and constraints", () => {
    expect(activityInputSchema.parse(validActivity)).toMatchObject({
      sportId: "football",
      capacity: 12,
      visibility: "public",
    });
  });

  it("rejects past dates, invalid limits, and end dates before the start", () => {
    expect(activityInputSchema.safeParse({
      ...validActivity,
      startsAt: new Date(Date.now() - 86_400_000).toISOString(),
    }).success).toBe(false);
    expect(activityInputSchema.safeParse({ ...validActivity, capacity: 1 }).success).toBe(false);
    expect(activityInputSchema.safeParse({
      ...validActivity,
      endsAt: new Date(Date.now() + 1000).toISOString(),
    }).success).toBe(false);
  });

  it("applies validated, bounded discovery pagination defaults", () => {
    expect(activitySearchSchema.parse({ city: "Lahore" })).toMatchObject({
      city: "Lahore",
      limit: 20,
      offset: 0,
    });
    expect(activitySearchSchema.safeParse({ limit: 100 }).success).toBe(false);
  });
});

describe("venue and coach directory validation", () => {
  it("validates bounded filters and directory inquiry messages", () => {
    expect(directorySearchSchema.safeParse({ query: "court", city: "Lahore", limit: 50, offset: 100 }).success).toBe(true);
    expect(directorySearchSchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(directoryInquirySchema.safeParse({ message: "Please share your training schedule." }).success).toBe(true);
    expect(directoryInquirySchema.safeParse({ message: " " }).success).toBe(false);
    expect(directoryInquirySchema.safeParse({ message: "x".repeat(2001) }).success).toBe(false);
  });

  it("rejects invalid business, venue and coach profile values", () => {
    expect(businessProfileInputSchema.safeParse({
      name: "City Fitness",
      businessType: "gym",
      city: "Lahore",
      area: "Gulberg",
    }).success).toBe(true);
    expect(businessProfileInputSchema.safeParse({
      name: "x",
      businessType: "gym",
      city: "Lahore",
      area: "",
    }).success).toBe(false);
    const venue = {
      businessId: "00000000-0000-4000-8000-000000000001",
      name: "City Courts",
      description: "",
      city: "Lahore",
      area: "Gulberg",
      sportIds: ["tennis"],
      status: "published" as const,
    };
    expect(venueListingInputSchema.safeParse(venue).success).toBe(true);
    expect(venueListingInputSchema.safeParse({ ...venue, sportIds: ["tennis", "tennis"] }).success).toBe(false);
    expect(venueListingInputSchema.safeParse({ ...venue, name: "x" }).success).toBe(false);
    expect(coachProfileInputSchema.safeParse({
      headline: "Running coach",
      bio: "",
      city: "Lahore",
      area: "",
      sportIds: ["running"],
      specialties: ["Beginner training"],
      isPublished: true,
    }).success).toBe(true);
    expect(coachProfileInputSchema.safeParse({
      headline: "",
      bio: "",
      city: "",
      area: "",
      sportIds: [],
      specialties: [],
      isPublished: true,
    }).success).toBe(false);
  });
});

describe("authFormSchema", () => {
  it("allows email-only password reset requests", () => {
    expect(authFormSchema("reset").safeParse({ email: "person@example.com" }).success).toBe(true);
  });

  it("requires an eight-character password at sign-up", () => {
    expect(authFormSchema("signup").safeParse({ email: "person@example.com", password: "short" }).success).toBe(false);
    expect(authFormSchema("signup").safeParse({ email: "person@example.com", password: "long-enough" }).success).toBe(true);
  });
});

describe("communityPostSchema", () => {
  it("trims post text and enforces the 2,000 character limit", () => {
    expect(communityPostSchema.parse({ body: "  Game tonight?  " })).toEqual({
      body: "Game tonight?",
    });
    expect(communityPostSchema.safeParse({ body: "   " }).success).toBe(false);
    expect(communityPostSchema.safeParse({ body: "x".repeat(2001) }).success).toBe(false);
  });
});

describe("getPlayerConnectionView", () => {
  const outgoing = {
    id: "connection-1",
    requester_id: "player-a",
    recipient_id: "player-b",
    status: "pending" as const,
    created_at: "2026-10-26T04:00:00.000Z",
  };

  it("returns the outgoing pending state", () => {
    expect(getPlayerConnectionView([outgoing], "player-a", "player-b")).toEqual({
      id: "connection-1",
      status: "pending",
      direction: "outgoing",
    });
  });

  it("returns the incoming direction and newest state", () => {
    const latest = {
      ...outgoing,
      id: "connection-2",
      requester_id: "player-b",
      recipient_id: "player-a",
      status: "accepted" as const,
      created_at: "2026-10-26T04:01:00.000Z",
    };
    expect(getPlayerConnectionView([outgoing, latest], "player-a", "player-b")).toEqual({
      id: "connection-2",
      status: "accepted",
      direction: "incoming",
    });
  });

  it("does not report a connection to oneself or an unrelated player", () => {
    expect(getPlayerConnectionView([outgoing], "player-a", "player-a")).toBeNull();
    expect(getPlayerConnectionView([outgoing], "player-a", "player-c")).toBeNull();
  });
});

describe("fitness validation and progress", () => {
  it("validates workout dates, duration, and exercise set values", () => {
    const valid = {
      workout_type: "Strength",
      performed_on: "2026-10-26",
      duration_minutes: 45,
      notes: "",
      exercises: [{ name: "Squat", sets: [{ repetitions: 8, weight_kg: 40 }] }],
    };
    expect(workoutSchema.safeParse(valid).success).toBe(true);
    expect(workoutSchema.safeParse({ ...valid, performed_on: "2026-02-30" }).success).toBe(false);
    expect(workoutSchema.safeParse({ ...valid, duration_minutes: 0 }).success).toBe(false);
    expect(workoutSchema.safeParse({
      ...valid,
      exercises: [{ name: "Squat", sets: [{ repetitions: 0, weight_kg: -1 }] }],
    }).success).toBe(false);
  });

  it("validates metric entry units and configurable goal targets", () => {
    expect(dailyMetricSchema.safeParse({ metric: "steps", value: 1200 }).success).toBe(true);
    expect(dailyMetricSchema.safeParse({ metric: "steps", value: 1.5 }).success).toBe(false);
    expect(fitnessGoalSchema.safeParse({ metric: "active_minutes", target: 30 }).success).toBe(true);
    expect(fitnessGoalSchema.safeParse({ metric: "steps", target: 10.5 }).success).toBe(false);
    expect(fitnessGoalSchema.safeParse({ metric: "distance_meters", target: 0 }).success).toBe(false);
    expect(bodyWeightSchema.safeParse({ weight_kg: 70, notes: "" }).success).toBe(true);
    expect(bodyWeightSchema.safeParse({ weight_kg: 0, notes: "" }).success).toBe(false);
  });

  it("calculates totals by local calendar date without duplicating workout duration", () => {
    const date = new Date(2026, 9, 26, 12);
    const dateKey = getLocalDateKey(date);
    const totals = getDailyFitnessTotals(
      dateKey,
      [
        { performed_at: date.toISOString(), duration_minutes: 40 },
        { performed_at: new Date(2026, 9, 25, 12).toISOString(), duration_minutes: 25 },
      ],
      [
        { metric_date: dateKey, metric: "steps", value: 2500 },
        { metric_date: dateKey, metric: "active_minutes", value: 22 },
      ],
    );
    expect(totals).toEqual({
      steps: 2500,
      distance_meters: 0,
      active_minutes: 22,
      workout_minutes: 40,
    });
  });

  it("builds a seven-day workout-minute summary in chronological order", () => {
    const today = new Date(2026, 9, 26, 12);
    const workouts = [
      { performed_at: new Date(2026, 9, 20, 12).toISOString(), duration_minutes: 30 },
      { performed_at: new Date(2026, 9, 26, 12).toISOString(), duration_minutes: 45 },
    ];
    expect(getWeeklyWorkoutMinutes(workouts, today)).toEqual([30, 0, 0, 0, 0, 0, 45]);
  });

  it("summarizes saved workouts and finds the highest logged exercise weight", () => {
    const workouts = [{
      id: "workout-1",
      user_id: "player-1",
      workout_type: "Strength",
      performed_at: "2026-10-26T12:00:00.000Z",
      duration_minutes: 40,
      notes: "",
      created_at: "2026-10-26T12:00:00.000Z",
      updated_at: "2026-10-26T12:00:00.000Z",
      exercises: [{
        id: "exercise-1",
        name: "Squat",
        sort_order: 0,
        sets: [
          { id: "set-1", set_number: 1, repetitions: 8, weight_kg: 40 },
          { id: "set-2", set_number: 2, repetitions: 5, weight_kg: 50 },
        ],
      }],
    }];

    expect(getWorkoutPerformanceSummary(workouts)).toEqual({
      workoutCount: 1,
      totalMinutes: 40,
      exerciseRecords: [{ name: "Squat", weight_kg: 50, repetitions: 5 }],
    });
    expect(getWorkoutPerformanceSummary([])).toEqual({
      workoutCount: 0,
      totalMinutes: 0,
      exerciseRecords: [],
    });
  });
});
