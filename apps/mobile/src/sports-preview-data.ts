export type PreviewAthlete = {
  id: string;
  name: string;
  sportId: string;
  points: number;
  movement: "up" | "same" | "down";
};

export type PreviewChallenge = {
  id: string;
  title: string;
  sportId: string | null;
  target: string;
  sampleProgress: number;
  sampleTarget: number;
  deadline: string;
  description: string;
  safetyNote: string;
};

export type PreviewTrainer = {
  id: string;
  name: string;
  area: string;
  sportIds: string[];
  specialties: string[];
  qualificationClaim: string;
  profile: string;
};

export const previewAthletes: PreviewAthlete[] = [
  { id: "athlete-01", name: "Demo Athlete 01", sportId: "running", points: 120, movement: "up" },
  { id: "athlete-02", name: "Demo Athlete 02", sportId: "football", points: 110, movement: "same" },
  { id: "athlete-03", name: "Demo Athlete 03", sportId: "badminton", points: 90, movement: "down" },
  { id: "athlete-04", name: "Demo Athlete 04", sportId: "running", points: 80, movement: "up" },
  { id: "athlete-05", name: "Demo Athlete 05", sportId: "cricket", points: 70, movement: "same" },
  { id: "athlete-06", name: "Demo Athlete 06", sportId: "football", points: 60, movement: "down" },
];

export const previewChallenges: PreviewChallenge[] = [
  {
    id: "challenge-consistency",
    title: "Three sessions, your pace",
    sportId: null,
    target: "Complete 3 workouts",
    sampleProgress: 2,
    sampleTarget: 3,
    deadline: "Example deadline · 7 days",
    description: "A flexible weekly goal built around completed activity, not venue visits or check-ins.",
    safetyNote: "Rest days are encouraged. Do not train through pain to meet a target.",
  },
  {
    id: "challenge-running",
    title: "Lahore easy miles",
    sportId: "running",
    target: "Log 2 easy runs",
    sampleProgress: 2,
    sampleTarget: 2,
    deadline: "Example deadline · 10 days",
    description: "A low-pressure running challenge concept for steady, comfortable sessions.",
    safetyNote: "Choose a pace that feels manageable and take rest when needed.",
  },
  {
    id: "challenge-racquet",
    title: "Racquet return",
    sportId: "badminton",
    target: "Complete 2 badminton workouts",
    sampleProgress: 0,
    sampleTarget: 2,
    deadline: "Example deadline · 14 days",
    description: "A sport-specific example based on workouts completed and logged by participants.",
    safetyNote: "Warm up and stop if you feel pain or unusual discomfort.",
  },
];

export const previewTrainers: PreviewTrainer[] = [
  {
    id: "trainer-01",
    name: "Demo Coach A",
    area: "Gulberg · demo area",
    sportIds: ["fitness-training", "weightlifting"],
    specialties: ["Strength fundamentals", "Movement technique"],
    qualificationClaim: "Example qualification claim · not verified",
    profile: "A sample trainer profile showing how areas of focus could be presented. No real trainer, credential check, availability, or booking is represented.",
  },
  {
    id: "trainer-02",
    name: "Demo Coach B",
    area: "Model Town · demo area",
    sportIds: ["running"],
    specialties: ["Running basics", "Return-to-training"],
    qualificationClaim: "Example qualification claim · not verified",
    profile: "A sample trainer profile. MOVEIT has not verified qualifications, client outcomes, ratings, or availability.",
  },
  {
    id: "trainer-03",
    name: "Demo Coach C",
    area: "Johar Town · demo area",
    sportIds: ["football"],
    specialties: ["Football conditioning", "Mobility"],
    qualificationClaim: "Example qualification claim · not verified",
    profile: "A sample trainer profile. No contact, booking, payment, or review flow is currently available.",
  },
];
