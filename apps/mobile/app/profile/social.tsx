import { useState } from "react";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button, Card, Header, Page, Pill, SectionTitle } from "../../src/components/ui";
import {
  decidePreviewFollowRequest,
  getPreviewProfileCounts,
  listPreviewFollowRelations,
  previewSocialProfiles,
  getPreviewOwnerVisibility,
  removePreviewFollower,
  removePreviewFollowing,
  requestFollowPreviewOwner,
} from "../../src/profile-social-preview";
import { useMoveitTheme } from "../../src/theme";

type SocialList = "followers" | "following" | "requests";

export default function PreviewSocialListsScreen() {
  const { colors } = useMoveitTheme();
  const [list, setList] = useState<SocialList>("followers");
  const [, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const relations = listPreviewFollowRelations();
  const counts = getPreviewProfileCounts();
  const rows = list === "followers"
    ? relations.filter((item) => item.followedId === "local-preview-owner" && item.status === "accepted").map((item) => ({ id: item.followerId, status: item.status }))
    : list === "following"
      ? relations.filter((item) => item.followerId === "local-preview-owner" && item.status === "accepted").map((item) => ({ id: item.followedId, status: item.status }))
      : relations.filter((item) => item.followedId === "local-preview-owner" && item.status === "pending").map((item) => ({ id: item.followerId, status: item.status }));

  const refresh = (successMessage: string) => {
    setMessage(successMessage);
    setRevision((value) => value + 1);
  };

  return (
    <Page>
      <Header eyebrow="LOCAL PREVIEW · FICTIONAL RELATIONSHIPS" title="Followers & following." action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pill label={`Followers · ${counts.followers}`} selected={list === "followers"} onPress={() => setList("followers")} />
        <Pill label={`Following · ${counts.following}`} selected={list === "following"} onPress={() => setList("following")} />
        <Pill label={`Requests · ${counts.incomingRequests}`} selected={list === "requests"} onPress={() => setList("requests")} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>These states exist only in temporary preview memory. Mutual accepted follows define “friends”; following alone does not.</Text>
      <SectionTitle title={list === "followers" ? "Followers" : list === "following" ? "Following" : "Pending requests"} />
      {rows.length ? rows.map((row) => {
        const profile = previewSocialProfiles.find((item) => item.id === row.id);
        if (!profile) return null;
        return (
          <Card key={row.id}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>{profile.displayName}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>@{profile.username} · fictional sample profile</Text>
            {list === "requests" ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><Button label="Approve" onPress={() => { decidePreviewFollowRequest(profile.id, "approve"); refresh("Request approved in local preview."); }} /></View>
                <View style={{ flex: 1 }}><Button label="Reject" variant="secondary" onPress={() => { decidePreviewFollowRequest(profile.id, "reject"); refresh("Request rejected in local preview."); }} /></View>
              </View>
            ) : (
              <Button
                label={list === "followers" ? "Remove follower" : "Unfollow"}
                variant="secondary"
                onPress={() => {
                  if (list === "followers") removePreviewFollower(profile.id);
                  else removePreviewFollowing(profile.id);
                  refresh("Relationship removed in local preview.");
                }}
              />
            )}
          </Card>
        );
      }) : (
        <Card>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "600" }}>No {list} yet</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>No sample relationship is seeded as if it were real.</Text>
        </Card>
      )}
      {list === "requests" && getPreviewOwnerVisibility() === "private" ? (
        <Button label="Simulate a sample follow request" variant="secondary" onPress={() => {
          try {
            const current = listPreviewFollowRelations();
            const senderId = "preview-player-racquet";
            if (current.some((item) => item.followerId === senderId && item.followedId === "local-preview-owner" && item.status === "pending")) {
              setMessage("A sample request is already pending.");
              return;
            }
            requestFollowPreviewOwner(senderId);
            refresh("Sample follow request created locally.");
          } catch (caught) {
            setMessage(caught instanceof Error ? caught.message : "Sample request could not be created.");
          }
        }} />
      ) : null}
      {list === "requests" && getPreviewOwnerVisibility() === "public" ? (
        <Text style={{ color: colors.muted, fontSize: 11 }}>Public profile follows do not require approval. Switch your preview profile to private to test pending requests.</Text>
      ) : null}
      {message ? <Text accessibilityRole="alert" style={{ color: colors.muted, fontSize: 11 }}>{message}</Text> : null}
      <Text style={{ color: colors.danger, fontSize: 10, lineHeight: 16 }}>Block/report actions and server-side privacy enforcement are not available in this preview.</Text>
    </Page>
  );
}
