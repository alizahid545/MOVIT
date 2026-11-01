import { z } from "zod";
export * from "./sports-catalogue";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(24, "Username must be 24 characters or fewer.")
  .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, and underscores.")
  .transform((value) => value.toLowerCase());

export const emailSchema = z.string().trim().email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const passwordResetSchema = z.object({
  email: emailSchema,
});

export const authFormSchema = (mode: "signin" | "signup" | "reset") =>
  z
    .object({
      email: emailSchema,
      password: z.string().optional(),
    })
    .superRefine(({ password }, context) => {
      if (mode !== "reset" && !password) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password"],
          message: "Enter your password.",
        });
      } else if (mode === "signup" && password && password.length < 8) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password"],
          message: "Password must be at least 8 characters.",
        });
      }
    });

export type AuthFormInput = z.infer<ReturnType<typeof authFormSchema>>;

export const profileSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1, "Enter your name.").max(60),
  bio: z.string().trim().max(280, "Bio must be 280 characters or fewer."),
  city: z.string().trim().min(1, "Enter your city.").max(80),
});

export const avatarUploadSchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"], {
    error: "Choose a JPEG, PNG, or WebP image.",
  }),
  size: z.number().int().positive().max(5 * 1024 * 1024, "Image must be 5 MiB or smaller."),
});

export const sportSkillLevelSchema = z.enum(["beginner", "intermediate", "advanced", "professional"]);

export const sportPreferenceSchema = z.object({
  sportId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/, "Choose a sport from MOVEIT’s catalogue."),
  skillLevel: sportSkillLevelSchema.nullable(),
  isPreferred: z.boolean(),
});

export const sportPreferencesInputSchema = z
  .array(sportPreferenceSchema.extend({ skillLevel: sportSkillLevelSchema }))
  .max(20, "Choose no more than 20 sports.")
  .superRefine((preferences, context) => {
    const sportIds = preferences.map(({ sportId }) => sportId);
    if (new Set(sportIds).size !== sportIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose each sport only once.",
      });
    }
  });

export const profileVisibilitySchema = z.enum(["public", "private"]);

export const fitnessGoalsSchema = z.array(
  z.string().trim().min(1, "Enter a fitness goal.").max(120, "Fitness goals must be 120 characters or fewer."),
).max(12, "Choose no more than 12 fitness goals.")
  .refine((goals) => new Set(goals.map((goal) => goal.toLowerCase())).size === goals.length,
    "Choose each fitness goal only once.");

export const athleteFitnessGoalOptions = [
  { value: "improve-stamina", label: "Improve stamina" },
  { value: "build-strength", label: "Build strength" },
  { value: "build-muscle", label: "Build muscle" },
  { value: "weight-management", label: "Weight management" },
  { value: "general-fitness", label: "General fitness" },
  { value: "improve-mobility", label: "Improve mobility" },
  { value: "build-consistency", label: "Build consistency" },
] as const;

export const athletePreferencesSchema = z.object({
  fitnessGoals: fitnessGoalsSchema,
  discoveryRadiusKm: z.number().int().min(1).max(100).nullable(),
  visibility: profileVisibilitySchema,
});

export const athleteOnboardingStepSchema = z.enum([
  "personal",
  "sports",
  "fitness",
  "location",
  "review",
  "complete",
]);

export const athleteOnboardingStateSchema = z.object({
  version: z.number().int().nonnegative(),
  step: athleteOnboardingStepSchema.nullable(),
  completedAt: z.string().datetime().nullable(),
});

export const athleteProfileSchema = profileSchema.extend({
  avatarUrl: z.union([
    z.literal(""),
    z.string().trim().url("Enter a valid avatar URL.").refine(
      (value) => /^https?:\/\//i.test(value),
      "Avatar URLs must use HTTP or HTTPS.",
    ),
  ]).transform((value) => value || null),
  sportsInterests: z.array(z.string().trim().min(1).max(80))
    .max(20)
    .refine((sports) => new Set(sports).size === sports.length, "Choose each sport only once."),
  fitnessGoals: z.array(z.string().trim().min(1).max(120)).max(12),
});

export const communityPostSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write something before posting.")
    .max(2000, "Posts must be 2,000 characters or fewer."),
});

export const activityVisibilitySchema = z.enum(["public", "private"]);
export const activityStatusSchema = z.enum(["published", "cancelled"]);

export const activityInputSchema = z.object({
  sportId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/, "Choose a sport from MOVEIT’s catalogue."),
  title: z.string().trim().min(3, "Add an activity title.").max(120, "Title must be 120 characters or fewer."),
  description: z.string().trim().max(2000, "Description must be 2,000 characters or fewer."),
  startsAt: z.string().datetime({ offset: true, message: "Choose a valid start date and time." }),
  endsAt: z.string().datetime({ offset: true, message: "Choose a valid end date and time." }).nullable(),
  venueName: z.string().trim().min(1, "Enter a venue or meeting place.").max(160),
  city: z.string().trim().min(1, "Enter a city or area.").max(80),
  capacity: z.number().int().min(2, "Capacity must be at least 2.").max(200, "Capacity cannot exceed 200."),
  requiredSkillLevel: sportSkillLevelSchema.nullable(),
  visibility: activityVisibilitySchema,
}).superRefine((activity, context) => {
  const startsAt = Date.parse(activity.startsAt);
  if (!Number.isFinite(startsAt) || startsAt <= Date.now()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startsAt"],
      message: "Choose a start time in the future.",
    });
  }
  if (activity.endsAt && Date.parse(activity.endsAt) <= startsAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endsAt"],
      message: "End time must be after the start time.",
    });
  }
});

export const activitySearchSchema = z.object({
  query: z.string().trim().max(80).optional(),
  sportId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/).optional(),
  city: z.string().trim().max(80).optional(),
  requiredSkillLevel: sportSkillLevelSchema.optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).max(10000).default(0),
});

export const directorySearchSchema = z.object({
  query: z.string().trim().max(80).optional(),
  sportId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/).optional(),
  city: z.string().trim().max(80).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).max(10000).default(0),
});

export const businessProfileInputSchema = z.object({
  name: z.string().trim().min(2).max(120),
  businessType: z.enum(["venue", "gym", "club", "academy"]),
  city: z.string().trim().min(1).max(80),
  area: z.string().trim().max(80),
});

export const venueListingInputSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000),
  city: z.string().trim().min(1).max(80),
  area: z.string().trim().max(80),
  sportIds: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/))
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length, "Choose each sport only once."),
  status: z.enum(["draft", "published"]),
});

export const coachProfileInputSchema = z.object({
  headline: z.string().trim().max(120),
  bio: z.string().trim().max(2000),
  city: z.string().trim().min(1).max(80),
  area: z.string().trim().max(80),
  sportIds: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/))
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length, "Choose each sport only once."),
  specialties: z.array(z.string().trim().min(1).max(80))
    .max(20)
    .refine((items) => new Set(items.map((item) => item.toLowerCase())).size === items.length,
      "Choose each specialty only once."),
  isPublished: z.boolean(),
});

export const directoryInquirySchema = z.object({
  message: z.string().trim().min(1, "Write a message before sending.").max(2000),
});

export const postCommentSchema = z.object({
  body: z.string().trim().min(1, "Write a comment first.").max(1000, "Comments must be 1,000 characters or fewer."),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type AthleteProfileInput = z.infer<typeof athleteProfileSchema>;
export type AvatarUploadInput = z.infer<typeof avatarUploadSchema>;
export type AthletePreferencesInput = z.infer<typeof athletePreferencesSchema>;
export type AthleteOnboardingStep = z.infer<typeof athleteOnboardingStepSchema>;
export type AthleteOnboardingState = z.infer<typeof athleteOnboardingStateSchema>;
export type SportSkillLevel = z.infer<typeof sportSkillLevelSchema>;
export type SportPreferenceInput = z.infer<typeof sportPreferencesInputSchema>[number];
export type SportPreference = z.infer<typeof sportPreferenceSchema>;
export type CommunityPostInput = z.infer<typeof communityPostSchema>;
export type ActivityInput = z.infer<typeof activityInputSchema>;
export type ActivitySearchInput = z.infer<typeof activitySearchSchema>;
export type DirectorySearchInput = z.infer<typeof directorySearchSchema>;
export type BusinessProfileInput = z.infer<typeof businessProfileInputSchema>;
export type VenueListingInput = z.infer<typeof venueListingInputSchema>;
export type CoachProfileInput = z.infer<typeof coachProfileInputSchema>;
export type DirectoryInquiryInput = z.infer<typeof directoryInquirySchema>;
export type ActivityStatus = z.infer<typeof activityStatusSchema>;
export type ActivityVisibility = z.infer<typeof activityVisibilitySchema>;
export type PostCommentInput = z.infer<typeof postCommentSchema>;

export type ActivityRecord = ActivityInput & {
  id: string;
  organizerId: string;
  status: ActivityStatus;
  participantCount: number;
  joinedByCurrentUser: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DiscoveredAthlete = PublicPlayerProfile & {
  avatarObjectPath: string | null;
  avatarPublicUrl: string | null;
};

export type PostComment = {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string;
  author: Pick<PublicPlayerProfile, "id" | "username" | "display_name"> | null;
};

export type AthleteProfile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  city: string;
  avatarObjectPath: string | null;
  avatarPublicUrl: string | null;
  visibility: z.infer<typeof profileVisibilitySchema>;
  discoveryRadiusKm: number | null;
  createdAt: string;
  updatedAt: string;
};

export type Profile = Omit<ProfileInput, "displayName"> & {
  id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
  visibility: "public" | "private";
};

export type PublicPlayerProfile = {
  id: string;
  username: string;
  display_name: string;
  city: string;
  bio: string;
};

export type ConnectionStatus = "pending" | "accepted" | "rejected";

export type PlayerConnectionRecord = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: ConnectionStatus;
  created_at: string;
};

export type PlayerConnectionView = {
  id: string;
  status: ConnectionStatus;
  direction: "incoming" | "outgoing";
};

export function getPlayerConnectionView(
  connections: PlayerConnectionRecord[],
  currentUserId: string,
  otherUserId: string,
): PlayerConnectionView | null {
  const relation = connections
    .filter((connection) =>
      (connection.requester_id === currentUserId && connection.recipient_id === otherUserId) ||
      (connection.requester_id === otherUserId && connection.recipient_id === currentUserId),
    )
    .sort((left, right) =>
      right.created_at.localeCompare(left.created_at) || right.id.localeCompare(left.id),
    )[0];

  if (!relation) return null;
  return {
    id: relation.id,
    status: relation.status,
    direction: relation.requester_id === currentUserId ? "outgoing" : "incoming",
  };
}

export type CommunityPost = {
  id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: Pick<PublicPlayerProfile, "id" | "username" | "display_name" | "city"> | null;
};

export function toProfileUpdate(input: ProfileInput) {
  return {
    username: input.username,
    display_name: input.displayName,
    bio: input.bio,
    city: input.city,
  };
}

export const fitnessMetricSchema = z.enum([
  "steps",
  "distance_meters",
  "active_minutes",
  "workout_minutes",
]);

export type FitnessMetric = z.infer<typeof fitnessMetricSchema>;

export const workoutSetSchema = z.object({
  repetitions: z.number().int().min(1).max(1000),
  weight_kg: z.number().min(0).max(10000).nullable(),
});

export const workoutExerciseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  sets: z.array(workoutSetSchema).max(100),
});

export const workoutSchema = z.object({
  workout_type: z.string().trim().min(1).max(60),
  performed_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid workout date.")
    .refine((date) => {
      const parsed = new Date(`${date}T00:00:00.000Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
    }, "Enter a valid workout date."),
  duration_minutes: z.number().int().min(1).max(1440),
  notes: z.string().max(2000),
  exercises: z.array(workoutExerciseSchema).max(50),
});

export type WorkoutInput = z.infer<typeof workoutSchema>;

export const fitnessGoalSchema = z.object({
  metric: fitnessMetricSchema,
  target: z.number().positive().max(100000000),
}).superRefine(({ metric, target }, context) => {
  if ((metric === "steps" || metric.endsWith("_minutes")) && !Number.isInteger(target)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["target"], message: "Use a whole number for this goal." });
  }
});

export type FitnessGoalInput = z.infer<typeof fitnessGoalSchema>;

export const dailyMetricSchema = z.object({
  metric: z.enum(["steps", "distance_meters", "active_minutes"]),
  value: z.number().min(0).max(100000000),
}).superRefine(({ metric, value }, context) => {
  if ((metric === "steps" || metric === "active_minutes") && !Number.isInteger(value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Use a whole number for this metric." });
  }
});

export type DailyMetricInput = z.infer<typeof dailyMetricSchema>;

export const bodyWeightSchema = z.object({
  weight_kg: z.number().min(1).max(1000),
  notes: z.string().max(500),
});

export type BodyWeightInput = z.infer<typeof bodyWeightSchema>;

export type WorkoutSet = {
  id: string;
  set_number: number;
  repetitions: number;
  weight_kg: number | null;
};

export type WorkoutExercise = {
  id: string;
  name: string;
  sort_order: number;
  sets: WorkoutSet[];
};

export type Workout = {
  id: string;
  user_id: string;
  workout_type: string;
  performed_at: string;
  duration_minutes: number;
  notes: string;
  created_at: string;
  updated_at: string;
  exercises: WorkoutExercise[];
};

export type FitnessGoal = {
  user_id: string;
  metric: FitnessMetric;
  target: number;
  updated_at: string;
};

export type FitnessDailyMetric = {
  user_id: string;
  metric_date: string;
  metric: Exclude<FitnessMetric, "workout_minutes">;
  value: number;
  source: "manual";
};

export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDailyFitnessTotals(
  dateKey: string,
  workouts: Pick<Workout, "performed_at" | "duration_minutes">[],
  metrics: Pick<FitnessDailyMetric, "metric_date" | "metric" | "value" | "source">[],
) {
  const totals: Record<FitnessMetric, number> = {
    steps: 0,
    distance_meters: 0,
    active_minutes: 0,
    workout_minutes: 0,
  };

  const dailyMetricByType = new Map<
    Exclude<FitnessMetric, "workout_minutes">,
    Pick<FitnessDailyMetric, "metric_date" | "metric" | "value">
  >();
  for (const metric of metrics) {
    if (metric.metric_date !== dateKey) continue;
    dailyMetricByType.set(metric.metric, metric);
  }
  for (const metric of dailyMetricByType.values()) {
    totals[metric.metric] = metric.value;
  }
  for (const workout of workouts) {
    if (getLocalDateKey(new Date(workout.performed_at)) === dateKey) {
      totals.workout_minutes += workout.duration_minutes;
    }
  }
  return totals;
}

export function getWeeklyWorkoutMinutes(
  workouts: Pick<Workout, "performed_at" | "duration_minutes">[],
  today = new Date(),
): number[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index, 12);
    const key = getLocalDateKey(day);
    return workouts.reduce((total, workout) =>
      getLocalDateKey(new Date(workout.performed_at)) === key
        ? total + workout.duration_minutes
        : total, 0);
  });
}

export function getWorkoutPerformanceSummary(workouts: Workout[]) {
  const exerciseRecords = new Map<string, { name: string; weight_kg: number; repetitions: number }>();

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const key = exercise.name.trim().toLowerCase();
      if (!key) continue;
      for (const set of exercise.sets) {
        if (set.weight_kg === null) continue;
        const current = exerciseRecords.get(key);
        if (!current || set.weight_kg > current.weight_kg) {
          exerciseRecords.set(key, {
            name: exercise.name,
            weight_kg: set.weight_kg,
            repetitions: set.repetitions,
          });
        }
      }
    }
  }

  return {
    workoutCount: workouts.length,
    totalMinutes: workouts.reduce((total, workout) => total + workout.duration_minutes, 0),
    exerciseRecords: [...exerciseRecords.values()].sort((left, right) => left.name.localeCompare(right.name)),
  };
}
