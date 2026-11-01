import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { Button, Card, Header, Icon, Page, SectionTitle } from "../../src/components/ui";
import {
  canViewChallenge,
  getChallengeStatus,
  getPreviewOwnerId,
  invitePreviewChallengeParticipant,
  joinPreviewChallenge,
  leavePreviewChallenge,
  listPreviewChallengeInvitations,
  listPreviewChallenges,
  reportPreviewChallengeProgress,
  setPreviewChallengeStatus,
  transitionPreviewChallengeInvitation,
  type PreviewChallengeRecord,
} from "../../src/challenge-preview";
import { previewAreFriends, previewSocialProfiles } from "../../src/profile-social-preview";
import { sportsCatalogue } from "../../src/sports-catalogue";
import { useMoveitTheme } from "../../src/theme";

export default function ChallengeDetailScreen() {
  const { colors } = useMoveitTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const challengeId = Array.isArray(id) ? id[0] : id;
  const viewerId = getPreviewOwnerId();
  const [challenge, setChallenge] = useState<PreviewChallengeRecord | null>(null);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [invitationRevision, setInvitationRevision] = useState(0);

  const refresh = useCallback(() => {
    setChallenge(listPreviewChallenges().find((item) => item.id === challengeId) ?? null);
    setMessage("");
  }, [challengeId]);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  const invitations = useMemo(
    () => challenge ? listPreviewChallengeInvitations(challenge.id) : [],
    [challenge?.id, invitationRevision],
  );
  const acceptedInviteeIds = invitations.filter((invitation) => invitation.status === "accepted").map((invitation) => invitation.inviteeId);

  const updateMessage = (action: () => PreviewChallengeRecord, success: string) => {
    try {
      setChallenge(action());
      setMessage(success);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The preview action could not be completed.");
    }
  };

  if (!challenge || !canViewChallenge(challenge, viewerId)) {
    return (
      <Page>
        <Header eyebrow="CHALLENGE PREVIEW" title="Challenge unavailable." action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} />
        <Card>
          <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
            This challenge is unavailable in the local preview, or its audience does not allow access. Private challenges are never shown in public search.
          </Text>
        </Card>
      </Page>
    );
  }

  const isCreator = challenge.creatorId === viewerId;
  const isJoined = challenge.participantIds.includes(viewerId);
  const status = getChallengeStatus(challenge);
  const sportName = sportsCatalogue.find((sport) => sport.id === challenge.sportId)?.name ?? "Sport unavailable";
  const currentProgress = challenge.progressByParticipant[viewerId] ?? 0;
  const updateInvitation = (action: () => void, success: string) => {
    try {
      action();
      setChallenge(listPreviewChallenges().find((item) => item.id === challengeId) ?? null);
      setInvitationRevision((value) => value + 1);
      setMessage(success);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "The invitation preview could not be updated.");
    }
  };

  return (
    <Page>
      <Header eyebrow="LOCAL CHALLENGE · NOT REMOTE" title={challenge.title} action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} />
      <Card>
        <View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}>
          <Icon name="flag" size={18} color={colors.primary} />
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{statusLabel(status)}</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>· {challenge.audience.toUpperCase()}</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{challenge.description}</Text>
        <Text style={{ color: colors.text, fontSize: 12 }}>{sportName} · {challenge.startsOn} to {challenge.endsOn}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Created by you · local preview creator</Text>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>Goal: {challenge.target} {challenge.unit} · {metricLabel(challenge.metric)}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Eligibility: {challenge.eligibilityRules}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>Completion: {challenge.completionRules}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>
          {challenge.participantIds.length} local participant{challenge.participantIds.length === 1 ? "" : "s"}
          {challenge.participantLimit ? ` · limit ${challenge.participantLimit}` : ""}
        </Text>
        {challenge.rewardType !== "none" ? (
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            Proposed {challenge.rewardType}{challenge.rewardPoints ? ` · ${challenge.rewardPoints} points` : ""}{challenge.reward ? ` · ${challenge.reward}` : ""} · not issued or redeemable
          </Text>
        ) : null}
        <Text style={{ color: colors.danger, fontSize: 11, lineHeight: 16 }}>
          Progress is self-reported and unverified. No verified achievements or rewards are issued.
        </Text>
      </Card>

      <SectionTitle title="Your progress" />
      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>{currentProgress} / {challenge.target} {challenge.unit}</Text>
      {status === "active" ? (
        isJoined ? (
          <View style={{ gap: 9 }}>
            <TextInput
              accessibilityLabel="Self-reported challenge progress"
              value={progress}
              onChangeText={(value) => setProgress(value.replace(/[^\d.]/g, ""))}
              placeholder={`Enter your ${challenge.unit}`}
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              style={{ minHeight: 46, color: colors.text, backgroundColor: colors.field, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 13 }}
            />
            <Button label="Update self-reported progress" variant="secondary" onPress={() => {
              const value = Number(progress);
              updateMessage(
                () => reportPreviewChallengeProgress(challenge.id, viewerId, value),
                value >= challenge.target ? "Target reached in self-reported preview progress." : "Preview progress updated locally.",
              );
            }} />
            <Button label="Leave challenge" variant="quiet" onPress={() => updateMessage(() => leavePreviewChallenge(challenge.id, viewerId), "You left this local challenge preview.")} />
          </View>
        ) : (
          <Button label="Join local preview challenge" onPress={() => updateMessage(() => joinPreviewChallenge(challenge.id, viewerId, [], acceptedInviteeIds), "Joined in local preview only.")} />
        )
      ) : null}

      {isCreator && challenge.status === "open" ? (
        <View style={{ gap: 9 }}>
          {challenge.audience !== "public" ? (
            <Card>
              <SectionTitle title="Invitations · local preview" />
              <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>
                Invitations are not sent to accounts. Sample recipient actions below only simulate accept/reject states in this app session.
                {challenge.audience === "friends" ? " Friends means mutual accepted follows." : ""}
              </Text>
              {previewSocialProfiles.map((profile) => {
                const invitation = invitations.find((item) => item.inviteeId === profile.id);
                const isMutualFriend = previewAreFriends(profile.id);
                const canInvite = challenge.audience === "private" || isMutualFriend;
                return (
                  <View key={profile.id} style={{ gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 9 }}>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>
                      {profile.visibility === "private" ? "Private sample profile" : profile.displayName}
                    </Text>
                    {invitation ? (
                      <>
                        <Text style={{ color: colors.muted, fontSize: 11 }}>Invitation · {invitation.status}</Text>
                        {invitation.status === "pending" ? (
                          <>
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <View style={{ flex: 1 }}>
                                <Button label="Accept as sample invitee" variant="secondary" onPress={() => updateInvitation(
                                  () => { transitionPreviewChallengeInvitation(challenge.id, profile.id, profile.id, "accept"); },
                                  "Sample invitee accepted locally.",
                                )} />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Button label="Reject as sample invitee" variant="quiet" onPress={() => updateInvitation(
                                  () => { transitionPreviewChallengeInvitation(challenge.id, profile.id, profile.id, "reject"); },
                                  "Sample invitee rejected locally.",
                                )} />
                              </View>
                            </View>
                            <Button label="Cancel invitation" variant="quiet" onPress={() => updateInvitation(
                              () => { transitionPreviewChallengeInvitation(challenge.id, viewerId, profile.id, "cancel"); },
                              "Invitation cancelled locally.",
                            )} />
                          </>
                        ) : null}
                        {invitation.status === "accepted" ? (
                          <>
                            {!challenge.participantIds.includes(profile.id) && status === "active" ? (
                              <Button label="Join as accepted sample invitee" variant="secondary" onPress={() => updateInvitation(
                                () => { joinPreviewChallenge(challenge.id, profile.id, [], acceptedInviteeIds); },
                                "Sample invitee joined locally.",
                              )} />
                            ) : null}
                            <Button label="Remove invitation" variant="quiet" onPress={() => updateInvitation(
                              () => { transitionPreviewChallengeInvitation(challenge.id, viewerId, profile.id, "remove"); },
                              "Invitation access removed locally.",
                            )} />
                          </>
                        ) : null}
                        {["rejected", "cancelled", "removed"].includes(invitation.status) ? (
                          <Text style={{ color: colors.muted, fontSize: 10 }}>A new invitation can be sent if appropriate.</Text>
                        ) : null}
                      </>
                    ) : canInvite ? (
                      <Button label="Invite fictional sample profile" variant="secondary" onPress={() => updateInvitation(
                        () => { invitePreviewChallengeParticipant(challenge.id, viewerId, profile.id, isMutualFriend ? [profile.id] : []); },
                        "Invitation created in local preview only.",
                      )} />
                    ) : (
                      <Text style={{ color: colors.muted, fontSize: 10 }}>Not eligible: this sample profile is not a mutual accepted follower.</Text>
                    )}
                  </View>
                );
              })}
            </Card>
          ) : null}
          <SectionTitle title="Creator controls · local preview" />
          <Button label="Edit challenge" icon="edit-2" variant="secondary" onPress={() => router.push({ pathname: "/challenges/create", params: { id: challenge.id } })} />
          <Button label="Mark challenge completed" icon="check" variant="secondary" disabled={status === "upcoming"} onPress={() => updateMessage(() => setPreviewChallengeStatus(challenge.id, viewerId, "completed"), "Challenge marked completed in local preview.")} />
          {confirmCancel ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.danger, fontSize: 12 }}>Cancel this challenge? This cannot be undone in the preview.</Text>
              <Button label="Confirm cancellation" variant="secondary" onPress={() => updateMessage(() => setPreviewChallengeStatus(challenge.id, viewerId, "cancelled"), "Challenge cancelled in local preview.")} />
              <Button label="Keep challenge" variant="quiet" onPress={() => setConfirmCancel(false)} />
            </View>
          ) : (
            <Button label="Cancel challenge" variant="quiet" onPress={() => setConfirmCancel(true)} />
          )}
        </View>
      ) : null}
      {message ? <Text accessibilityRole="alert" style={{ color: message.includes("only") || message.includes("reached") ? colors.accent : colors.danger, fontSize: 12 }}>{message}</Text> : null}
    </Page>
  );
}

function metricLabel(metric: PreviewChallengeRecord["metric"]): string {
  return {
    workout_count: "completed workouts",
    duration_minutes: "training duration",
    distance_meters: "distance",
    steps: "steps",
    custom: "custom self-reported metric",
  }[metric];
}

function statusLabel(status: ReturnType<typeof getChallengeStatus>): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
