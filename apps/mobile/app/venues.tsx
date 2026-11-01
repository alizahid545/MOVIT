import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { sportsCatalogue } from "@moveit/shared";
import { createDirectoryRepository, type DirectoryInquiry, type VenueListing } from "@moveit/supabase";
import { Button, Card, Header, Page, Pill, SectionTitle } from "../src/components/ui";
import { supabase } from "../src/supabase";
import { useMoveitTheme } from "../src/theme";

export default function VenueDiscoveryScreen() {
  const { colors } = useMoveitTheme();
  const repository = useMemo(() => supabase ? createDirectoryRepository(supabase) : null, []);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [sportId, setSportId] = useState("");
  const [venues, setVenues] = useState<VenueListing[]>([]);
  const [inquiries, setInquiries] = useState<DirectoryInquiry[]>([]);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!repository) {
      setError("Sign in and configure Supabase to browse published venues.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const rows = await repository.discoverVenues({
        query,
        city,
        sportId: sportId || undefined,
        limit: 20,
        offset: 0,
      });
      setVenues(rows);
      setHasMore(rows.length === 20);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Venue listings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [repository, query, city, sportId]);

  const loadMore = async () => {
    if (!repository || moreLoading || !hasMore) return;
    setMoreLoading(true);
    setError("");
    try {
      const rows = await repository.discoverVenues({
        query,
        city,
        sportId: sportId || undefined,
        limit: 20,
        offset: venues.length,
      });
      setVenues((current) => [...current, ...rows]);
      setHasMore(rows.length === 20);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "More venue listings could not be loaded.");
    } finally {
      setMoreLoading(false);
    }
  };

  const loadInquiries = useCallback(async () => {
    if (!repository) return;
    try {
      setInquiries(await repository.loadMyVenueInquiries());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Venue inquiries could not be loaded.");
    }
  }, [repository]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadInquiries(); }, [loadInquiries]);

  const sendInquiry = async (venueId: string) => {
    if (!repository) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await repository.createVenueInquiry(venueId, messages[venueId] ?? "");
      setMessages((current) => ({ ...current, [venueId]: "" }));
      setNotice("Your inquiry was sent privately to the venue owner.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your inquiry could not be sent.");
    } finally {
      setSaving(false);
    }
  };

  const updateInquiry = async (inquiry: DirectoryInquiry, status: DirectoryInquiry["status"]) => {
    if (!repository) return;
    setSaving(true);
    setError("");
    try {
      await repository.updateVenueInquiryStatus(inquiry.id, status);
      await loadInquiries();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Inquiry status could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.accent} />}>
      <Header eyebrow="LIVE VENUE DIRECTORY" title="Find a training space." action={<Button label="Back" variant="quiet" onPress={() => router.back()} />} />
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
        Listings are submitted by their owners and are not independently verified. MOVEIT does not show booking availability or prices here.
      </Text>
      <TextInput accessibilityLabel="Search venues" value={query} onChangeText={setQuery} placeholder="Search venue, business or area" placeholderTextColor={colors.muted} style={inputStyle(colors)} />
      <TextInput accessibilityLabel="Filter by city" value={city} onChangeText={setCity} placeholder="City or area" placeholderTextColor={colors.muted} style={inputStyle(colors)} />
      <View style={{ gap: 8 }}>
        <SectionTitle title="Sport" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pill label="All sports" selected={!sportId} onPress={() => setSportId("")} />
          {sportsCatalogue.map((sport) => <Pill key={sport.id} label={sport.name} selected={sportId === sport.id} onPress={() => setSportId(sport.id)} />)}
        </View>
      </View>
      <Button label="List a venue" icon="plus" variant="secondary" onPress={() => router.push({ pathname: "/business/register", params: { mode: "live" } })} />
      {error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 12 }}>{error}</Text> : null}
      {notice ? <Text accessibilityRole="status" style={{ color: colors.accent, fontSize: 12 }}>{notice}</Text> : null}
      {loading && venues.length === 0 ? <ActivityIndicator accessibilityLabel="Loading venues" color={colors.accent} /> : null}
      <View style={{ gap: 12 }}>
        <SectionTitle title={`${venues.length} live ${venues.length === 1 ? "listing" : "listings"}`} />
        {venues.map((venue) => (
          <Card key={venue.id}>
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{venue.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{venue.businessName} · {[venue.area, venue.city].filter(Boolean).join(", ")}</Text>
            <Text style={{ color: colors.text, fontSize: 12 }}>
              {venue.sportIds.map((id) => sportsCatalogue.find((sport) => sport.id === id)?.name ?? id).join(" · ") || "Sports not specified"}
            </Text>
            {venue.description ? <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{venue.description}</Text> : null}
            <Text style={{ color: colors.muted, fontSize: 10 }}>Owner-listed · not independently verified · no booking or availability claims</Text>
            <TextInput
              accessibilityLabel={`Inquiry for ${venue.name}`}
              value={messages[venue.id] ?? ""}
              onChangeText={(value) => setMessages((current) => ({ ...current, [venue.id]: value }))}
              multiline
              maxLength={2000}
              placeholder="Write a private inquiry"
              placeholderTextColor={colors.muted}
              style={[inputStyle(colors), { minHeight: 76, textAlignVertical: "top", paddingTop: 12 }]}
            />
            <Button label="Send inquiry" disabled={saving || !(messages[venue.id] ?? "").trim()} onPress={() => void sendInquiry(venue.id)} />
          </Card>
        ))}
        {!loading && venues.length === 0 && !error ? (
          <Card>
            <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>No published venue listings</Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Try another city or sport. Local preview venues are kept separate from this live directory.</Text>
          </Card>
        ) : null}
      </View>
      <View style={{ gap: 12 }}>
        <SectionTitle title={`Venue inquiries · ${inquiries.length}`} />
        {inquiries.map((inquiry) => (
          <Card key={inquiry.id}>
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{inquiry.listingName} · {inquiry.status}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>From MOVEIT account {inquiry.requesterId.slice(0, 8)}</Text>
            <Text style={{ color: colors.text, fontSize: 12, lineHeight: 18 }}>{inquiry.message}</Text>
            {inquiry.status !== "closed" ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}><Button label="Mark responded" variant="secondary" disabled={saving} onPress={() => void updateInquiry(inquiry, "responded")} /></View>
                <View style={{ flex: 1 }}><Button label="Close" variant="secondary" disabled={saving} onPress={() => void updateInquiry(inquiry, "closed")} /></View>
              </View>
            ) : null}
          </Card>
        ))}
        {!inquiries.length ? <Text style={{ color: colors.muted, fontSize: 11 }}>No incoming venue inquiries yet.</Text> : null}
      </View>
      {!loading && hasMore ? <Button label={moreLoading ? "Loading…" : "Load more venues"} variant="secondary" disabled={moreLoading} onPress={() => void loadMore()} /> : null}
      {!loading && venues.length > 0 ? <Button label="Refresh listings" variant="quiet" onPress={() => void load()} /> : null}
    </Page>
  );
}

function inputStyle(colors: ReturnType<typeof useMoveitTheme>["colors"]) {
  return {
    minHeight: 46,
    color: colors.text,
    backgroundColor: colors.field,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
  } as const;
}
