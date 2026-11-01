import { useState } from "react";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button, Card, Header, Icon, Page, SectionTitle } from "../src/components/ui";
import { followPreviewProfile, getPreviewFollowStatus, previewSocialProfiles } from "../src/profile-social-preview";
import { sportsCatalogue } from "../src/sports-catalogue";
import { useMoveitTheme } from "../src/theme";

export default function PreviewPlayersScreen() {
  const { colors } = useMoveitTheme();
  const [, setRevision] = useState(0);
  const [error, setError] = useState("");

  return (
    <Page>
      <Header eyebrow="FICTIONAL PREVIEWS · LOCAL ONLY" title="Sample players." action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} />
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
        These sample identities are fictional and exist only to preview follow states. No accounts, requests, or profile data are remote.
      </Text>
      <SectionTitle title="Player profiles" />
      {previewSocialProfiles.map((profile) => {
        const status = getPreviewFollowStatus(profile.id);
        const label = status === "accepted" ? "Following · open" : status === "pending" ? "Request pending" : status === "rejected" ? "Request declined" : profile.visibility === "private" ? "Request to follow" : "Follow";
        return (
          <Card key={profile.id}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Icon name={profile.visibility === "public" ? "user" : "lock"} size={18} color={colors.muted} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: colors.text, fontSize: 14, fontWeight: "600" }}>
                  {profile.visibility === "private" ? "Private profile preview" : profile.displayName}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  {profile.visibility === "private" ? "Private · send a follow request to connect" : `@${profile.username} · public · ${profile.city}`}
                </Text>
              </View>
            </View>
            {profile.visibility === "public" ? (
              <Text style={{ color: colors.muted, fontSize: 11 }}>
                {profile.sportIds.map((id) => sportsCatalogue.find((sport) => sport.id === id)?.name ?? "Sport").join(" · ")}
              </Text>
            ) : null}
            <Button label="View sample profile" variant="secondary" onPress={() => router.push({ pathname: "/profiles/[id]", params: { id: profile.id } })} />
            {status !== "accepted" && status !== "pending" ? (
              <Button label={label} onPress={() => {
                try {
                  followPreviewProfile(profile.id);
                  setError("");
                  setRevision((value) => value + 1);
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : "Follow preview unavailable.");
                }
              }} />
            ) : (
              <Button label={label} variant="quiet" disabled onPress={() => undefined} />
            )}
          </Card>
        );
      })}
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
    </Page>
  );
}
