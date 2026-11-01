import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { Button, Card, Header, Icon, Page, SectionTitle } from "../../src/components/ui";
import { followPreviewProfile, getPreviewFollowStatus, previewProfileCanViewRestricted, previewSocialProfiles, removePreviewFollowing } from "../../src/profile-social-preview";
import { sportsCatalogue } from "../../src/sports-catalogue";
import { useMoveitTheme } from "../../src/theme";

export default function PreviewPlayerProfileScreen() {
  const { colors } = useMoveitTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profileId = Array.isArray(id) ? id[0] : id;
  const profile = useMemo(() => previewSocialProfiles.find((item) => item.id === profileId), [profileId]);
  const [, setRevision] = useState(0);
  const [message, setMessage] = useState("");
  const status = profile ? getPreviewFollowStatus(profile.id) : null;
  const canSeeRestricted = profile ? previewProfileCanViewRestricted(profile.id) : false;

  if (!profile) {
    return <Page><Header eyebrow="LOCAL PREVIEW" title="Profile unavailable." action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} /><Text style={{ color: colors.muted }}>This sample profile is not available.</Text></Page>;
  }

  const actOnFollow = () => {
    try {
      if (status === "accepted") removePreviewFollowing(profile.id);
      else followPreviewProfile(profile.id);
      setMessage(profile.visibility === "private" && status !== "accepted" ? "Follow request sent in this local preview." : "Preview follow state updated locally.");
      setRevision((value) => value + 1);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Follow action unavailable.");
    }
  };

  return (
    <Page>
      <Header
        eyebrow="FICTIONAL PROFILE · LOCAL ONLY"
        title={profile.visibility === "private" ? "Private profile preview." : profile.displayName}
        action={<Button label="Back" variant="quiet" onPress={() => router.back()} />}
      />
      <Card>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Icon name={profile.visibility === "public" ? "user" : "lock"} size={20} color={colors.muted} />
          <View style={{ flex: 1 }}>
            {profile.visibility === "public" ? (
              <>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}>@{profile.username}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Public profile · {profile.city}</Text>
              </>
            ) : (
              <Text style={{ color: colors.muted, fontSize: 11 }}>Private profile · request access to restricted details</Text>
            )}
          </View>
        </View>
        {canSeeRestricted ? (
          <>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{profile.bio}</Text>
            <SectionTitle title="Sports" />
            <Text style={{ color: colors.text, fontSize: 12 }}>{profile.sportIds.map((sportId) => sportsCatalogue.find((sport) => sport.id === sportId)?.name ?? "Sport").join(" · ")}</Text>
          </>
        ) : (
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Restricted profile details are visible only to approved followers.</Text>
        )}
      </Card>
      <Button
        label={status === "accepted" ? "Unfollow sample profile" : status === "pending" ? "Cancel follow request" : profile.visibility === "private" ? "Request to follow" : "Follow sample profile"}
        icon={status === "accepted" ? "user-minus" : "user-plus"}
        variant={status === "accepted" ? "secondary" : "primary"}
        onPress={() => {
          if (status === "pending") {
            removePreviewFollowing(profile.id);
            setMessage("Follow request cancelled locally.");
            setRevision((value) => value + 1);
          } else {
            actOnFollow();
          }
        }}
      />
      {message ? <Text accessibilityRole="alert" style={{ color: colors.muted, fontSize: 11 }}>{message}</Text> : null}
      <Text style={{ color: colors.muted, fontSize: 10 }}>No real account or remotely persisted follow relationship is involved.</Text>
    </Page>
  );
}
