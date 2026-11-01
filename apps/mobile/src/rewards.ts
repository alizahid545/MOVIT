import { readDevelopmentData, writeDevelopmentData } from "./local-development-repository";

export type PointsOwnerType = "athlete" | "venue";
export type PointsEntryStatus = "pending" | "confirmed" | "reversed" | "expired";
export type PointsEventType =
  | "booking_completed"
  | "attendance_verified"
  | "payment_verified"
  | "repeat_visit"
  | "reliable_fulfilment"
  | "genuine_review"
  | "community_contribution"
  | "offer_redemption"
  | "reversal";

export type PointsRule = {
  id: string;
  ownerType: PointsOwnerType;
  eventType: PointsEventType;
  points: number;
  enabled: boolean;
  reason: string;
  dailyLimit?: number;
};

export type PointsLedgerEntry = {
  id: string;
  ownerType: PointsOwnerType;
  ownerId: string;
  eventRef: string;
  eventType: PointsEventType;
  points: number;
  status: PointsEntryStatus;
  createdAt: string;
  reason: string;
};

export type QualifyingPointsEvent = {
  ownerType: PointsOwnerType;
  ownerId: string;
  eventRef: string;
  eventType: PointsEventType;
  lifecycle: "completed" | "cancelled" | "refunded" | "invalid";
  evidence: "trusted_service" | "local_preview" | "user_claim";
  reason?: string;
};

export type TierDefinition = {
  id: string;
  name: string;
  minimumPoints: number;
  advancementCriteria: string;
  minimumCompletedBookings?: number;
  minimumFulfilmentRate?: number;
};

export type RewardsOffer = {
  id: string;
  venueId: string;
  venueName: string;
  title: string;
  description: string;
  pointsCost: number;
  redemptionLimitPerAthlete: number;
  startsAt: string;
  expiresAt: string;
  eligibleSportIds: string[];
  eligibility: string;
  demonstration: boolean;
};

export type RewardRedemption = {
  id: string;
  offerId: string;
  athleteId: string;
  createdAt: string;
  status: "pending" | "confirmed" | "rejected" | "expired";
};

export type VenueRankingCandidate = {
  venueId: string;
  points: number;
  completedBookings: number;
  fulfilledBookingRate: number;
  genuineRatingAverage: number | null;
  listingCompleteness: number;
  recentActivity: number;
  metricsVerified: boolean;
};

export type VenueRanking = {
  venueId: string;
  position: number;
  score: number;
  factors: string[];
};

const rules: PointsRule[] = [
  { id: "athlete-completed-booking", ownerType: "athlete", eventType: "booking_completed", points: 100, enabled: false, reason: "Eligible booking completed." },
  { id: "athlete-verified-attendance", ownerType: "athlete", eventType: "attendance_verified", points: 20, enabled: false, reason: "Attendance confirmed using an approved check-in." },
  { id: "athlete-verified-payment", ownerType: "athlete", eventType: "payment_verified", points: 30, enabled: false, reason: "Payment confirmed by an authorized payment workflow." },
  { id: "athlete-community", ownerType: "athlete", eventType: "community_contribution", points: 5, enabled: false, reason: "Eligible community contribution." },
  { id: "venue-completed-booking", ownerType: "venue", eventType: "booking_completed", points: 100, enabled: false, reason: "Eligible MOVEIT booking completed and fulfilled." },
  { id: "venue-repeat-visit", ownerType: "venue", eventType: "repeat_visit", points: 20, enabled: false, reason: "A returning athlete completed an eligible visit." },
  { id: "venue-reliable-fulfilment", ownerType: "venue", eventType: "reliable_fulfilment", points: 15, enabled: false, reason: "Booking fulfilled without an operator-caused cancellation." },
  { id: "venue-genuine-review", ownerType: "venue", eventType: "genuine_review", points: 5, enabled: false, reason: "Eligible review from a genuine completed booking." },
];

export const pointsRules: readonly PointsRule[] = rules;

export const athleteTiers: readonly TierDefinition[] = [
  { id: "athlete-starter", name: "Starter", minimumPoints: 100, advancementCriteria: "Earn 100 eligible activity points." },
  { id: "athlete-active", name: "Active", minimumPoints: 500, advancementCriteria: "Earn 500 eligible activity points." },
  { id: "athlete-committed", name: "Committed", minimumPoints: 1500, advancementCriteria: "Earn 1,500 eligible activity points." },
];

export const venueTiers: readonly TierDefinition[] = [
  { id: "venue-emerging", name: "Emerging", minimumPoints: 500, minimumCompletedBookings: 5, minimumFulfilmentRate: 0.9, advancementCriteria: "Reach 500 eligible venue points, complete 5 bookings, and maintain at least 90% fulfilment." },
  { id: "venue-established", name: "Established", minimumPoints: 2500, minimumCompletedBookings: 25, minimumFulfilmentRate: 0.95, advancementCriteria: "Reach 2,500 eligible venue points, complete 25 bookings, and maintain at least 95% fulfilment." },
  { id: "venue-excellent", name: "Excellent", minimumPoints: 10000, minimumCompletedBookings: 100, minimumFulfilmentRate: 0.98, advancementCriteria: "Reach 10,000 eligible venue points, complete 100 bookings, and maintain at least 98% fulfilment." },
];

export const demonstrationOffers: readonly RewardsOffer[] = [];

const storageKey = "rewards-ledger-preview";
let ledger: PointsLedgerEntry[] = [];
let redemptions: RewardRedemption[] = [];

export async function hydrateRewardsRepository(): Promise<void> {
  const saved = await readDevelopmentData<{ ledger: PointsLedgerEntry[]; redemptions: RewardRedemption[] }>(
    storageKey,
    { ledger: [], redemptions: [] },
  );
  ledger = Array.isArray(saved.ledger) ? saved.ledger : [];
  redemptions = Array.isArray(saved.redemptions) ? saved.redemptions : [];
}

export function getPointsRules(): readonly PointsRule[] {
  return rules.map((rule) => ({ ...rule }));
}

export function getPointsLedger(ownerType: PointsOwnerType, ownerId: string): PointsLedgerEntry[] {
  return ledger
    .filter((entry) => entry.ownerType === ownerType && entry.ownerId === ownerId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((entry) => ({ ...entry }));
}

export function getPointsSummary(ownerType: PointsOwnerType, ownerId: string) {
  const entries = getPointsLedger(ownerType, ownerId);
  const confirmed = entries.filter((entry) => entry.status === "confirmed");
  const pendingPoints = entries
    .filter((entry) => entry.status === "pending" && entry.eventType !== "offer_redemption")
    .reduce((total, entry) => total + entry.points, 0);
  const pendingRedemptionPoints = entries
    .filter((entry) => entry.status === "pending" && entry.eventType === "offer_redemption")
    .reduce((total, entry) => total + Math.abs(entry.points), 0);
  const earnedPoints = confirmed
    .filter((entry) => entry.eventType !== "offer_redemption")
    .reduce((total, entry) => total + entry.points, 0);
  const spentPoints = confirmed
    .filter((entry) => entry.eventType === "offer_redemption")
    .reduce((total, entry) => total + Math.abs(entry.points), 0);
  const availablePoints = Math.max(0, confirmed.reduce((total, entry) => total + entry.points, 0) - pendingRedemptionPoints);
  return { availablePoints, pendingPoints, pendingRedemptionPoints, earnedPoints, spentPoints, entries };
}

export function resolvePointsTier(
  ownerType: PointsOwnerType,
  points: number,
  hasQualifyingActivity: boolean,
  venueEvidence?: { completedBookings: number; fulfilledBookingRate: number },
): { current: TierDefinition; next: TierDefinition | null; progress: number } | null {
  if (!hasQualifyingActivity || !Number.isFinite(points) || points < 0) return null;
  if (ownerType === "venue" && (!venueEvidence ||
    !Number.isInteger(venueEvidence.completedBookings) || venueEvidence.completedBookings < 0 ||
    !Number.isFinite(venueEvidence.fulfilledBookingRate) || venueEvidence.fulfilledBookingRate < 0 || venueEvidence.fulfilledBookingRate > 1)) {
    return null;
  }
  const tiers = ownerType === "athlete" ? athleteTiers : venueTiers;
  const tierIsMet = (tier: TierDefinition) => points >= tier.minimumPoints &&
    (tier.minimumCompletedBookings === undefined || (venueEvidence?.completedBookings ?? 0) >= tier.minimumCompletedBookings) &&
    (tier.minimumFulfilmentRate === undefined || (venueEvidence?.fulfilledBookingRate ?? 0) >= tier.minimumFulfilmentRate);
  const current = [...tiers].reverse().find(tierIsMet);
  if (!current) return null;
  const currentIndex = tiers.findIndex((tier) => tier.id === current.id);
  const next = tiers.slice(currentIndex + 1).find((tier) => !tierIsMet(tier)) ?? null;
  if (!next) return { current, next: null, progress: 1 };
  const progressParts = [
    (points - current.minimumPoints) / (next.minimumPoints - current.minimumPoints),
  ];
  if (next.minimumCompletedBookings !== undefined) {
    const currentBookings = current.minimumCompletedBookings ?? 0;
    progressParts.push(
      ((venueEvidence?.completedBookings ?? 0) - currentBookings) /
      (next.minimumCompletedBookings - currentBookings),
    );
  }
  if (next.minimumFulfilmentRate !== undefined) {
    const currentFulfilment = current.minimumFulfilmentRate ?? 0;
    progressParts.push(
      ((venueEvidence?.fulfilledBookingRate ?? 0) - currentFulfilment) /
      (next.minimumFulfilmentRate - currentFulfilment),
    );
  }
  const progress = Math.max(0, Math.min(1, ...progressParts));
  return { current, next, progress };
}

export async function recordQualifyingPointsEvent(
  event: QualifyingPointsEvent,
  configuredRules: readonly PointsRule[] = pointsRules,
): Promise<PointsLedgerEntry | null> {
  if (!event.ownerId.trim() || !event.eventRef.trim()) throw new Error("A points owner and unique event reference are required.");
  if (event.lifecycle !== "completed" || event.evidence !== "trusted_service") return null;
  const rule = configuredRules.find((item) =>
    item.ownerType === event.ownerType && item.eventType === event.eventType && item.enabled,
  );
  if (!rule) return null;
  if (!Number.isInteger(rule.points) || rule.points <= 0) throw new Error("Points rules must use a positive integer award.");
  if (ledger.some((entry) => entry.ownerType === event.ownerType && entry.ownerId === event.ownerId && entry.eventRef === event.eventRef)) {
    return null;
  }
  const entry: PointsLedgerEntry = {
    id: createId("points"),
    ownerType: event.ownerType,
    ownerId: event.ownerId,
    eventRef: event.eventRef,
    eventType: event.eventType,
    points: rule.points,
    status: "confirmed",
    createdAt: new Date().toISOString(),
    reason: event.reason?.trim() || rule.reason,
  };
  ledger = [...ledger, entry];
  await persist();
  return { ...entry };
}

export async function reverseQualifyingEvent(
  ownerType: PointsOwnerType,
  ownerId: string,
  eventRef: string,
  reason: "cancelled" | "refunded" | "fraudulent" | "invalid",
): Promise<PointsLedgerEntry | null> {
  const original = ledger.find((entry) =>
    entry.ownerType === ownerType && entry.ownerId === ownerId &&
    entry.eventRef === eventRef && entry.status === "confirmed" && entry.eventType !== "offer_redemption",
  );
  if (!original) return null;
  const reversalRef = `reversal:${eventRef}:${reason}`;
  if (ledger.some((entry) => entry.ownerType === ownerType && entry.ownerId === ownerId && entry.eventRef === reversalRef)) {
    return null;
  }
  const reversal: PointsLedgerEntry = {
    id: createId("reversal"),
    ownerType,
    ownerId,
    eventRef: reversalRef,
    eventType: "reversal",
    points: -original.points,
    status: "confirmed",
    createdAt: new Date().toISOString(),
    reason: `Points reversed: qualifying event ${reason}.`,
  };
  ledger = ledger.map((entry) => entry.id === original.id ? { ...entry, status: "reversed" } : entry);
  ledger = [...ledger, reversal];
  await persist();
  return { ...reversal };
}

export function canRedeemOffer(
  offer: RewardsOffer,
  athleteId: string,
  availablePoints: number,
  now = new Date(),
): { eligible: boolean; reason: string } {
  if (!athleteId.trim()) return { eligible: false, reason: "An athlete profile is required." };
  if (!Number.isInteger(offer.pointsCost) || offer.pointsCost < 0 || !Number.isInteger(offer.redemptionLimitPerAthlete) || offer.redemptionLimitPerAthlete < 1) {
    return { eligible: false, reason: "Offer terms are invalid." };
  }
  if (offer.demonstration) return { eligible: false, reason: "Demonstration offers cannot be redeemed." };
  const startsAt = Date.parse(offer.startsAt);
  const expiresAt = Date.parse(offer.expiresAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(expiresAt) || startsAt > now.getTime() || expiresAt < now.getTime() || startsAt > expiresAt) {
    return { eligible: false, reason: "This offer is not currently active." };
  }
  const prior = redemptions.filter((redemption) =>
    redemption.offerId === offer.id && redemption.athleteId === athleteId &&
    (redemption.status === "pending" || redemption.status === "confirmed"),
  ).length;
  if (prior >= offer.redemptionLimitPerAthlete) return { eligible: false, reason: "You have reached this offer’s redemption limit." };
  if (availablePoints < offer.pointsCost) return { eligible: false, reason: "You do not have enough available points." };
  return { eligible: true, reason: "Eligible for redemption." };
}

export async function redeemOfferPreview(
  offer: RewardsOffer,
  athleteId: string,
  now = new Date(),
): Promise<RewardRedemption> {
  const summary = getPointsSummary("athlete", athleteId);
  const eligibility = canRedeemOffer(offer, athleteId, summary.availablePoints, now);
  if (!eligibility.eligible) throw new Error(eligibility.reason);
  if (offer.demonstration) throw new Error("Demonstration offers cannot be redeemed.");
  const redemption: RewardRedemption = {
    id: createId("redemption"),
    offerId: offer.id,
    athleteId,
    createdAt: now.toISOString(),
    status: "pending",
  };
  redemptions = [...redemptions, redemption];
  ledger = [...ledger, {
    id: createId("points"),
    ownerType: "athlete",
    ownerId: athleteId,
    eventRef: `offer-redemption:${redemption.id}`,
    eventType: "offer_redemption",
    points: -offer.pointsCost,
    status: "pending",
    createdAt: now.toISOString(),
    reason: `Redemption request for ${offer.title}; awaiting authoritative confirmation.`,
  }];
  await persist();
  return { ...redemption };
}

export function getOfferRedemptions(offerId: string, athleteId: string): RewardRedemption[] {
  return redemptions
    .filter((redemption) => redemption.offerId === offerId && redemption.athleteId === athleteId)
    .map((redemption) => ({ ...redemption }));
}

export function rankVenues(candidates: readonly VenueRankingCandidate[]): VenueRanking[] {
  const eligible = candidates.filter((candidate) =>
    candidate.metricsVerified &&
    Number.isInteger(candidate.points) && candidate.points >= 0 &&
    Number.isInteger(candidate.completedBookings) && candidate.completedBookings > 0 &&
    Number.isFinite(candidate.fulfilledBookingRate) && candidate.fulfilledBookingRate >= 0 && candidate.fulfilledBookingRate <= 1 &&
    (candidate.genuineRatingAverage === null || (Number.isFinite(candidate.genuineRatingAverage) && candidate.genuineRatingAverage >= 1 && candidate.genuineRatingAverage <= 5)) &&
    Number.isFinite(candidate.listingCompleteness) && candidate.listingCompleteness >= 0 && candidate.listingCompleteness <= 1 &&
    Number.isFinite(candidate.recentActivity) && candidate.recentActivity >= 0 && candidate.recentActivity <= 1,
  );
  if (eligible.length < 3 || eligible.some((candidate) => candidate.genuineRatingAverage === null)) return [];

  return eligible
    .map((candidate) => ({
      venueId: candidate.venueId,
      score: candidate.points * 0.1 + Math.min(candidate.completedBookings, 100) * 0.25 +
        candidate.fulfilledBookingRate * 20 + (candidate.genuineRatingAverage ?? 0) * 3 +
        candidate.listingCompleteness * 5 + candidate.recentActivity * 5,
      factors: ["Eligible points", "Completed bookings", "Fulfilment reliability", "Genuine customer rating", "Listing completeness", "Recent activity"],
    }))
    .sort((left, right) => right.score - left.score || left.venueId.localeCompare(right.venueId))
    .map((item, index) => ({ ...item, position: index + 1 }));
}

export async function resetRewardsForTests(): Promise<void> {
  ledger = [];
  redemptions = [];
  await writeDevelopmentData(storageKey, { ledger, redemptions });
}

async function persist(): Promise<void> {
  await writeDevelopmentData(storageKey, { ledger, redemptions });
}

function createId(prefix: string): string {
  return `local-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
