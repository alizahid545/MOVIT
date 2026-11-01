import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  sportsCatalogue,
  type AthleteProfile,
  type CoachProfileInput,
  type VenueListingInput,
} from "@moveit/shared";
import {
  createDirectoryRepository,
  type BusinessProfile,
  type CoachListing,
  type DirectoryInquiry,
  type VenueListing,
} from "@moveit/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

type DirectoryKind = "venues" | "coaches";

export function DirectoryPanel({ client, profile, initialKind = "venues" }: {
  client: SupabaseClient;
  profile: AthleteProfile;
  initialKind?: DirectoryKind;
}) {
  const [kind, setKind] = useState<DirectoryKind>(initialKind);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState(profile.city);
  const [sportId, setSportId] = useState("");
  const [venues, setVenues] = useState<VenueListing[]>([]);
  const [coaches, setCoaches] = useState<CoachListing[]>([]);
  const [venueInquiries, setVenueInquiries] = useState<DirectoryInquiry[]>([]);
  const [coachInquiries, setCoachInquiries] = useState<DirectoryInquiry[]>([]);
  const [businesses, setBusinesses] = useState<BusinessProfile[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState<"venue" | "gym" | "club" | "academy">("venue");
  const [venueName, setVenueName] = useState("");
  const [venueDescription, setVenueDescription] = useState("");
  const [venueArea, setVenueArea] = useState("");
  const [venueSportId, setVenueSportId] = useState("");
  const [coachHeadline, setCoachHeadline] = useState("");
  const [coachBio, setCoachBio] = useState("");
  const [coachArea, setCoachArea] = useState("");
  const [coachSportIds, setCoachSportIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const repository = useMemo(() => createDirectoryRepository(client), [client]);
  useEffect(() => { setKind(initialKind); }, [initialKind]);
  const loadBusinesses = useCallback(async () => {
    try {
      const [ownedBusinesses, receivedVenueInquiries, receivedCoachInquiries] = await Promise.all([
        repository.loadMyBusinesses(),
        repository.loadMyVenueInquiries(),
        repository.loadMyCoachInquiries(),
      ]);
      setBusinesses(ownedBusinesses);
      setVenueInquiries(receivedVenueInquiries);
      setCoachInquiries(receivedCoachInquiries);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your business profiles could not be loaded.");
    }
  }, [repository]);

  const search = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const filters = { query, city, sportId: sportId || undefined, limit: 20, offset: 0 };
      if (kind === "venues") {
        const rows = await repository.discoverVenues(filters);
        setVenues(rows);
        setHasMore(rows.length === 20);
      } else {
        const rows = await repository.discoverCoaches(filters);
        setCoaches(rows);
        setHasMore(rows.length === 20);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Directory listings could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [repository, kind, query, city, sportId]);

  const loadMore = async () => {
    if (moreLoading || !hasMore) return;
    setMoreLoading(true);
    setError("");
    try {
      if (kind === "venues") {
        const rows = await repository.discoverVenues({
          query,
          city,
          sportId: sportId || undefined,
          limit: 20,
          offset: venues.length,
        });
        setVenues((current) => [...current, ...rows]);
        setHasMore(rows.length === 20);
      } else {
        const rows = await repository.discoverCoaches({
          query,
          city,
          sportId: sportId || undefined,
          limit: 20,
          offset: coaches.length,
        });
        setCoaches((current) => [...current, ...rows]);
        setHasMore(rows.length === 20);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "More listings could not be loaded.");
    } finally {
      setMoreLoading(false);
    }
  };

  useEffect(() => { void search(); }, [search]);
  useEffect(() => { void loadBusinesses(); }, [loadBusinesses]);

  const createBusiness = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const business = await repository.createBusiness({
        name: businessName,
        businessType,
        city,
        area: venueArea,
      });
      setBusinesses((current) => [business, ...current]);
      setBusinessName("");
      setNotice("Business profile created. Add a venue listing below to appear in discovery.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Business profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const createVenue = async () => {
    if (!businesses[0]) {
      setError("Create a business profile before adding a venue.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const input: VenueListingInput = {
        businessId: businesses[0].id,
        name: venueName,
        description: venueDescription,
        city,
        area: venueArea,
        sportIds: venueSportId ? [venueSportId] : [],
        status: "published",
      };
      await repository.createVenue(input);
      setVenueName("");
      setVenueDescription("");
      setNotice("Venue published. Listings are owner-submitted and have not been independently verified.");
      await search();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Venue listing could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const saveCoach = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const input: CoachProfileInput = {
        headline: coachHeadline,
        bio: coachBio,
        city,
        area: coachArea,
        sportIds: coachSportIds,
        specialties: [],
        isPublished: true,
      };
      await repository.saveMyCoachProfile(input);
      setNotice("Coach profile published. MOVEIT has not verified qualifications or credentials.");
      await search();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Coach profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const sendInquiry = async (targetId: string, type: DirectoryKind) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (type === "venues") await repository.createVenueInquiry(targetId, messages[targetId] ?? "");
      else await repository.createCoachInquiry(targetId, messages[targetId] ?? "");
      setMessages((current) => ({ ...current, [targetId]: "" }));
      setNotice("Your inquiry was sent privately to the listing owner.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your inquiry could not be sent.");
    } finally {
      setSaving(false);
    }
  };

  const updateInquiry = async (inquiry: DirectoryInquiry) => {
    setSaving(true);
    setError("");
    try {
      if (inquiry.listingType === "venue") {
        await repository.updateVenueInquiryStatus(inquiry.id, "responded");
      } else {
        await repository.updateCoachInquiryStatus(inquiry.id, "responded");
      }
      await loadBusinesses();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Inquiry status could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  const toggleCoachSport = (id: string) => {
    setCoachSportIds((current) => current.includes(id)
      ? current.filter((value) => value !== id)
      : current.length < 20 ? [...current, id] : current);
  };

  return (
    <div className="hub-directory">
      <div className="hub-directory-filters">
        <div className="hub-tabs" aria-label="Directory type">
          <button type="button" className={kind === "venues" ? "active" : ""} onClick={() => setKind("venues")}>Venues & gyms</button>
          <button type="button" className={kind === "coaches" ? "active" : ""} onClick={() => setKind("coaches")}>Coaches</button>
        </div>
        <label>Search<input value={query} onChange={(event) => setQuery(event.currentTarget.value)} maxLength={80} placeholder={kind === "venues" ? "Venue or business" : "Coach, sport or specialty"} /></label>
        <label>City / area<input value={city} onChange={(event) => setCity(event.currentTarget.value)} maxLength={80} /></label>
        <label>Sport<select value={sportId} onChange={(event) => setSportId(event.currentTarget.value)}><option value="">All sports</option>{sportsCatalogue.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label>
      </div>

      {error ? <div className="hub-error" role="alert">{error}</div> : null}
      {notice ? <div className="hub-notice" role="status">{notice}</div> : null}

      <div className="hub-list">
        {loading ? <Empty>Loading live {kind}…</Empty> : null}
        {!loading && kind === "venues" && venues.map((venue) => (
          <article className="hub-card" key={venue.id}>
            <div className="hub-card-main">
              <strong>{venue.name}</strong>
              <span>{venue.businessName} · {venue.area ? `${venue.area}, ` : ""}{venue.city}</span>
              <span>{venue.sportIds.map((id) => sportsCatalogue.find((sport) => sport.id === id)?.name ?? id).join(" · ") || "Sports not specified"}</span>
              {venue.description ? <p>{venue.description}</p> : null}
              <small>Owner-listed · not independently verified · no booking or availability claims</small>
            </div>
            <InquiryForm id={venue.id} message={messages[venue.id] ?? ""} saving={saving} onChange={(value) => setMessages((current) => ({ ...current, [venue.id]: value }))} onSend={() => void sendInquiry(venue.id, "venues")} />
          </article>
        ))}
        {!loading && kind === "coaches" && coaches.map((coach) => (
          <article className="hub-card" key={coach.userId}>
            <div className="hub-card-main">
              <strong>{coach.displayName || `@${coach.username}`}</strong>
              <span>{coach.headline || "MOVEIT coach"} · {coach.area ? `${coach.area}, ` : ""}{coach.city}</span>
              <span>{coach.sportIds.map((id) => sportsCatalogue.find((sport) => sport.id === id)?.name ?? id).join(" · ") || "Sports not specified"}</span>
              {coach.bio ? <p>{coach.bio}</p> : null}
              <small>Self-published · qualifications and credentials are not verified</small>
            </div>
            <InquiryForm id={coach.userId} message={messages[coach.userId] ?? ""} saving={saving} onChange={(value) => setMessages((current) => ({ ...current, [coach.userId]: value }))} onSend={() => void sendInquiry(coach.userId, "coaches")} />
          </article>
        ))}
        {!loading && kind === "venues" && venues.length === 0 ? <Empty>No matching published venue listings. Try a different filter or create a listing below.</Empty> : null}
        {!loading && kind === "coaches" && coaches.length === 0 ? <Empty>No matching published coaches. Try a different filter or create a profile below.</Empty> : null}
        {!loading && hasMore ? <button type="button" className="secondary-button" disabled={moreLoading} onClick={() => void loadMore()}>{moreLoading ? "Loading…" : `Load more ${kind}`}</button> : null}
      </div>

      <section className="hub-directory-create" aria-labelledby="create-directory-heading">
        <h3 id="create-directory-heading">List your venue or coach profile</h3>
        {kind === "venues" ? (
          <>
            <div className="hub-form">
              <label>Business name<input value={businessName} onChange={(event) => setBusinessName(event.currentTarget.value)} maxLength={120} /></label>
              <label>Business type<select value={businessType} onChange={(event) => setBusinessType(event.currentTarget.value as typeof businessType)}><option value="venue">Venue</option><option value="gym">Gym</option><option value="club">Club</option><option value="academy">Academy</option></select></label>
              <button type="button" className="secondary-button" disabled={saving || !businessName.trim()} onClick={() => void createBusiness()}>{saving ? "Saving…" : "Create business profile"}</button>
            </div>
            {businesses.length ? (
              <div className="hub-form">
                <p>Business profile: {businesses[0].name} · {businesses[0].status}</p>
                <label>Venue name<input value={venueName} onChange={(event) => setVenueName(event.currentTarget.value)} maxLength={120} /></label>
                <label>Area<input value={venueArea} onChange={(event) => setVenueArea(event.currentTarget.value)} maxLength={80} /></label>
                <label>Description<textarea value={venueDescription} onChange={(event) => setVenueDescription(event.currentTarget.value)} maxLength={2000} /></label>
                <label>Sport<select value={venueSportId} onChange={(event) => setVenueSportId(event.currentTarget.value)}><option value="">Not specified</option>{sportsCatalogue.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label>
                <button type="button" className="primary-button" disabled={saving || !venueName.trim()} onClick={() => void createVenue()}>{saving ? "Publishing…" : "Publish venue listing"}</button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="hub-form">
            <label>Headline<input value={coachHeadline} onChange={(event) => setCoachHeadline(event.currentTarget.value)} maxLength={120} /></label>
            <label>Area<input value={coachArea} onChange={(event) => setCoachArea(event.currentTarget.value)} maxLength={80} /></label>
            <label>About<textarea value={coachBio} onChange={(event) => setCoachBio(event.currentTarget.value)} maxLength={2000} /></label>
            <fieldset className="hub-sport-choices"><legend>Sports</legend>{sportsCatalogue.map((sport) => <label key={sport.id}><input type="checkbox" checked={coachSportIds.includes(sport.id)} onChange={() => toggleCoachSport(sport.id)} />{sport.name}</label>)}</fieldset>
            <button type="button" className="primary-button" disabled={saving} onClick={() => void saveCoach()}>{saving ? "Publishing…" : "Publish coach profile"}</button>
          </div>
        )}
      </section>

      <section className="hub-list" aria-labelledby="directory-inquiries-heading">
        <h3 id="directory-inquiries-heading">Incoming inquiries</h3>
        {[...venueInquiries, ...coachInquiries].map((inquiry) => (
          <article className="hub-card" key={`${inquiry.listingType}-${inquiry.id}`}>
            <div className="hub-card-main">
              <strong>{inquiry.listingName} · {inquiry.status}</strong>
              <span>From MOVEIT account {inquiry.requesterId.slice(0, 8)}</span>
              <p>{inquiry.message}</p>
            </div>
            {inquiry.status === "new" ? <button type="button" className="secondary-button" disabled={saving} onClick={() => void updateInquiry(inquiry)}>Mark responded</button> : null}
          </article>
        ))}
        {!venueInquiries.length && !coachInquiries.length ? <Empty>No incoming venue or coaching inquiries yet.</Empty> : null}
      </section>
    </div>
  );
}

function InquiryForm({ id, message, saving, onChange, onSend }: {
  id: string;
  message: string;
  saving: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="hub-form">
      <label htmlFor={`inquiry-${id}`}>Private inquiry<textarea id={`inquiry-${id}`} value={message} onChange={(event) => onChange(event.currentTarget.value)} maxLength={2000} /></label>
      <button type="button" className="secondary-button" disabled={saving || !message.trim()} onClick={onSend}>Send inquiry</button>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="hub-empty" role="status">{children}</div>;
}
