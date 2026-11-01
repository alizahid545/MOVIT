import { useMemo, useState } from "react";
import { router } from "expo-router";
import { Text, TextInput, View } from "react-native";
import { Button, Card, Header, Icon, Page, Pill, SectionTitle } from "../src/components/ui";
import {
  followPreviewProfile,
  getPreviewFollowStatus,
  previewSocialProfiles,
  removePreviewFollowing,
} from "../src/profile-social-preview";
import { findSport } from "../src/sports-catalogue";
import { useMoveitTheme } from "../src/theme";

export default function NearbyPlayersScreen() {
  const { colors } = useMoveitTheme();
  const [query, setQuery] = useState("");
  const [areaQuery, setAreaQuery] = useState("");
  const [sportFilter, setSportFilter] = useState("All sports");
  const [followError, setFollowError] = useState("");
  const [, setRevision] = useState(0);
  const sports = [...new Set(previewSocialProfiles.flatMap((profile) => profile.sportIds))];
  const results = useMemo(() => previewSocialProfiles.filter((profile) => {
    const text = `${profile.displayName} ${profile.username} ${profile.city}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) &&
      profile.city.toLowerCase().includes(areaQuery.trim().toLowerCase()) &&
      (sportFilter === "All sports" || profile.sportIds.includes(sportFilter));
  }), [query, areaQuery, sportFilter]);

  return (
    <Page>
      <Header
        eyebrow="PLAYER DISCOVERY · LOCAL PREVIEW"
        title="Find your people."
        action={<Button label="Back" variant="quiet" onPress={() => router.back()} />}
      />
      <Card style={{ backgroundColor: colors.surfaceAlt }}>
        <View style={{ flexDirection: "row", gap: 9, alignItems: "center" }}>
          <Icon name="info" size={17} color={colors.accent} />
          <Text style={{ flex: 1, color: colors.text, fontSize: 12, lineHeight: 18 }}>
            These are fictional sample profiles for interface preview—not real nearby people. Location permission and live player matching are not connected.
          </Text>
        </View>
      </Card>
      <TextInput
        accessibilityLabel="Search sample players by name or username"
        value={query}
        onChangeText={setQuery}
        placeholder="Search name or username"
        placeholderTextColor={colors.muted}
        style={{ minHeight: 48, color: colors.text, backgroundColor: colors.field, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 }}
      />
      <TextInput
        accessibilityLabel="Filter by city or general area"
        value={areaQuery}
        onChangeText={setAreaQuery}
        placeholder="City or general area"
        placeholderTextColor={colors.muted}
        style={{ minHeight: 48, color: colors.text, backgroundColor: colors.field, borderColor: colors.border, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14 }}
      />
      <View style={{ gap: 9 }}>
        <SectionTitle title="Sport" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pill label="All sports" selected={sportFilter === "All sports"} onPress={() => setSportFilter("All sports")} />
          {sports.map((sportId) => (
            <Pill key={sportId} label={findSport(sportId)?.name ?? sportId} selected={sportFilter === sportId} onPress={() => setSportFilter(sportId)} />
          ))}
        </View>
      </View>
      <View style={{ gap: 12 }}>
        <SectionTitle title={`${results.length} sample ${results.length === 1 ? "profile" : "profiles"}`} />
        {results.length ? results.map((profile) => {
          const status = getPreviewFollowStatus(profile.id);
          const displaySports = profile.sportIds.map((id) => findSport(id)?.name ?? id).join(" · ");
          return (
            <Card key={profile.id}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                <View style={{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceAlt }}>
                  <Icon name="user" size={18} color={colors.muted} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{profile.displayName}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>@{profile.username} · {profile.city}</Text>
                </View>
                <Pill label="SAMPLE" />
              </View>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Sports · {displaySports}</Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>Skill level and “looking to play” status are not available for this sample.</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button label="View profile" variant="secondary" onPress={() => router.push({ pathname: "/profiles/[id]", params: { id: profile.id } })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label={status === "accepted" ? "Unfollow" : status === "pending" ? "Cancel request" : profile.visibility === "private" ? "Request follow" : "Follow"}
                    variant={status === "accepted" ? "quiet" : "primary"}
                    onPress={() => {
                      try {
                        setFollowError("");
                        if (status === "accepted" || status === "pending") removePreviewFollowing(profile.id);
                        else followPreviewProfile(profile.id);
                        setRevision((revision) => revision + 1);
                      } catch (caught) {
                        setFollowError(caught instanceof Error ? caught.message : "The local follow action could not be completed.");
                      }
                    }}
                  />
                </View>
              </View>
            </Card>
          );
        }) : (
          <Card>
            <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>No matching sample profiles</Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>These filters search only the fictional preview profiles; they do not search real MOVEIT players.</Text>
          </Card>
        )}
        {followError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 11 }}>{followError}</Text> : null}
      </View>
      <Button label="Create a game instead" icon="plus" variant="secondary" onPress={() => router.navigate("/(tabs)/create")} />
      <Text style={{ color: colors.muted, fontSize: 10, lineHeight: 16 }}>
        Area search uses only the sample city text. Radius matching, skill filters, and live “looking to play” status are unavailable. No exact or live location is collected or displayed. Follow actions update local preview state only.
      </Text>
    </Page>
  );
}
