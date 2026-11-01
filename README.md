# MOVEIT

MOVEIT is a sports, fitness, recreation, and community platform starting in Lahore, Pakistan. It brings people, activities, sports, gyms, arenas, and recreation venues together in one application.

The core product loop is:

**Discover → Connect → Organize or Book → Participate → Build Community → Return**

MOVEIT is broader than a workout tracker or venue-booking app: the product vision is to help people find others to play with, explore sports and facilities, organize games, discover places to train, and participate in a connected sports community. English is the initial interface language. Expansion beyond Lahore is intended after the initial pilot is validated.

This repository contains a working mobile preview, a smaller web authentication/profile application, shared schemas and domain types, optional Supabase client factories, and database migrations. Feature status differs by platform and by whether Supabase is configured; this document separates verified code from local previews and planned work.

## Product and design principles

- Premium, mature sports-tech styling with clear hierarchy, strong typography, restrained effects, and purposeful whitespace.
- Use shared, theme-aware tokens, reusable components, accessible labels and touch targets, and responsive layouts.
- Keep demo content clearly labelled. Never present a local preview as a real person, venue, booking, payment, verification, rating, ranking, or notification.
- Keep exact personal or live location private. Nearby-player previews do not represent live location matching.
- Keep UI state separate from identity, business permissions, verification, and publication approval.
- Treat local role selection and local storage as development conveniences, never as authentication or authorization.

### Mobile theme tokens

These palettes are implemented in `apps/mobile/src/theme.tsx`.

| Token | Dark | Light |
|---|---|---|
| Background | `#0B0E0B` | `#F7F7F5` |
| Surface | `#141914` | `#FFFFFF` |
| Elevated surface | `#1C231B` | `#FFFFFF` |
| Primary text | `#F5F7F2` | `#191B19` |
| Secondary text | `#A3ADA0` | `#737770` |
| Border | `#2B3429` | `#E5E6E1` |
| Accent | `#B7FF45` | `#E92736` |
| Pressed accent | `#91D92B` | `#C91E2B` |
| Light accent surface | — | `#FFF1F2` |

Mobile supports Light, Dark, and System modes and persists the selection on-device. The web app has its own stylesheet and supports Light, Dark, and System selection, following the operating-system color scheme in System mode. The Athlete Card’s lime-dark/red-light treatment is the intended brand direction; a complete Athlete Card experience is not yet implemented.

## Technology and repository layout

### Confirmed stack

- **Mobile:** React Native 0.88, Expo SDK 58, TypeScript, Expo Router.
- **Web:** React, TypeScript, Vite.
- **Workspace/package manager:** npm workspaces with a checked-in `package-lock.json`.
- **Shared package:** Zod schemas and TypeScript domain types.
- **Backend integration:** Supabase JS client factory, optional environment-based clients, and PostgreSQL migration files.
- **Local mobile previews:** AsyncStorage with a versioned development-data namespace. Passwords, auth tokens, service keys, and sensitive health records must not be placed in this store.
- **Tests:** Vitest.

### Directory map

```text
.
├── apps/
│   ├── mobile/
│   │   ├── app/                 Expo Router routes and route groups
│   │   ├── src/                 UI components, themes, domain services and repositories
│   │   ├── app.json             Expo app identity and typed-route configuration
│   │   └── package.json         Expo start and mobile typecheck scripts
│   └── web/
│       ├── src/                 React entry point, auth/profile app, styles and client
│       ├── index.html
│       ├── vite.config.ts
│       └── package.json         Vite dev/build and web typecheck scripts
├── packages/
│   ├── shared/src/              Shared validation schemas and domain types
│   └── supabase/src/            Supabase client factory and shared profile repository
├── supabase/
│   ├── migrations/              Versioned SQL migration files with schema and RLS policies
│   └── config.toml
├── .env.example                 Environment variable names; values are blank
├── app.json                     Root Expo plugin configuration
├── package.json                 npm workspaces and root scripts
├── package-lock.json
├── tsconfig.base.json
└── tsconfig.json
```

Important mobile routes include:

- `app/(tabs)/`: Community, Venues, Fitness, Activities, and Profile are the primary destinations. Home, Discover, and Create remain reachable as secondary routes.
- `app/auth.tsx`, `app/onboarding.tsx`, `app/role-selection.tsx`: authentication, Athlete/Venue signup selection, and separate athlete/business onboarding entry points.
- `app/messages.tsx`, `app/notifications.tsx`, `app/profile/settings.tsx`, `app/profile/edit.tsx`: dedicated account destinations linked from the app header or Profile.
- `app/search.tsx`, `app/nearby-players.tsx`, `app/venues.tsx`, `app/venues/[slug].tsx`: discovery and venue screens.
- `app/challenges*`, `app/fitness*`, `app/rewards*`, `app/profiles*`, `app/players*`, and `app/trainers*`: feature routes.
- `app/business*`: separate business/venue preview workspace.

Reusable UI is in `apps/mobile/src/components/`. Key mobile modules include:

- `theme.tsx`, `styles.ts`: palettes, typography, spacing, radii, and shared styling.
- `sports-catalogue.ts`: canonical sport IDs, aliases, categories, and sport-specific metadata.
- `universal-search.ts`: local directory/search behavior over catalogue and preview datasets.
- `community-api.ts`, `fitness-api.ts`: Supabase-backed API calls with explicit local-preview behavior where supported.
- `packages/supabase/src/`: the shared authenticated-user-scoped athlete profile repository plus Supabase client factory and read-only Auth health check.
- `local-development-repository.ts`, `local-community-repository.ts`: versioned device-local preview persistence and community data.
- `account-onboarding.ts`, `development-profile.ts`, `challenge-preview.ts`, `venue-preview.ts`, `rewards.ts`: onboarding, profile, challenge, venue, and rewards preview/domain behavior.
- `demo-data.ts`, `sports-preview-data.ts`: isolated sample content.

`apps/web` is not a web version of all mobile routes: it implements Supabase email authentication, responsive account-backed athlete onboarding/profile editing, sport preferences, fitness/location preferences, and theme selection. Discovery and activity workflows remain incomplete.

## Feature inventory and current status

Status labels:

- **Implemented:** The behavior exists in code and the relevant local check has passed.
- **Partially implemented:** Some behavior exists, but important product or integration work remains.
- **UI only:** A screen or entry point exists without the underlying workflow.
- **Local/demo:** Behavior uses device-local state, seeded sample data, or a simulation rather than production services.
- **Planned:** Agreed product scope not yet implemented.
- **Blocked:** Requires an unresolved external integration, service, or decision.

“Implemented” does not imply a configured production backend, deployed migration, verified RLS policy, or production readiness.

| Feature | Status | What exists now | What remains |
|---|---|---|---|
| Expo app startup and routing | **Implemented** | Expo Router entry point, typed routes, root layout, hydration of local preview repositories, and retryable load-error state. | Device/store release configuration and production monitoring. |
| Primary mobile navigation | **Implemented** | Community, Venues, Fitness, Activities, and Profile are separate tabs; the app header links to Notifications and Messages. Home, Discover, and Create remain reachable as secondary routes. | Continued UX refinement, web parity, and end-to-end device testing. |
| Shared UI and icons | **Partially implemented** | Reusable mobile UI primitives, Feather icons from the installed Expo icon library, spacing/type tokens, and theme-aware components exist. | Broader consistency, accessibility audit, and reusable interaction/state components. |
| Mobile themes | **Partially implemented** | Light/dark palettes and a persisted System/Light/Dark preference exist, with storage errors surfaced. | Audit every route, contrast ratio, and system-mode transition. |
| Responsive and accessible UI | **Partially implemented** | Responsive scrollable layouts and selected accessible labels/roles/touch targets are present. | Systematic screen-reader, keyboard, contrast, and small/large-screen validation. |
| Email authentication | **Partially implemented** | Mobile signup requires Athlete or Venue selection and stores it as user-editable intent metadata, never as an authorization grant. Mobile and web call Supabase Auth for email/password sign-in and password-reset requests when configured; mobile uses SecureStore for native auth storage. | Web role-selection parity; verify actual account lifecycle, email verification and redirect settings, and production error handling. |
| Google auth and phone OTP | **Planned** | No provider flow is wired. | Configure providers and implement/test platform-specific callback/OTP flows. |
| Account onboarding and active role | **Partially implemented**; **Local/demo** | Athlete onboarding covers personal details, sports, fitness goals, discovery range, and review. Venue onboarding creates an account-backed business profile followed by a venue listing. Active-role preferences use the existing `user_onboarding` record; signup intent is not an authorization grant. | Trusted business membership/permissions and end-to-end testing against configured environments. |
| Business membership and permissions | **Planned**; **Local/demo** | A local business preview workspace exists. A separate `user_roles` table/migration exists for privileged app roles. | Trusted membership, owner/staff permissions, verification, venue approval, and secure business management. Selecting Business does not grant `venue_owner`. |
| Athlete profile | **Partially implemented** | Mobile and web share profile validation and repository contracts. Account-backed editing, public avatar lifecycle, sports and self-reported Beginner/Intermediate/Advanced/Professional levels, favourites, optional fitness goals, profile visibility, city, and an optional discovery radius are implemented. Versioned onboarding saves progress and resumes across personal, sports, fitness, location, and review steps. Device coordinates are read only after an explicit action and are not saved. Demo profile data remains separate. | Complete live discovery/activity integration, cross-account privacy tests, end-to-end testing on devices/browsers, and deployed app hosting remain outstanding. |
| Follower/following relationships | **Partially implemented** | Connected accounts have a backend `player_connections` request/accept/reject/cancel workflow for public profiles. Local profile previews model more states, including private requests and follower removal. | True follow semantics/counts, private-profile request support on backend, blocking/reporting, pagination, and verified authorization. Accepted player connections are the current “mutual friends” concept; they are not a separate friendship or a full follower system. |
| Athlete Card | **Partially implemented** | The Profile area links to rewards and locally derived activity/achievement summaries where data exists. | A complete scannable Athlete Card with identity, sports, balance, tier/progress, qualifying activity, history, and eligible offers. |
| Athlete Points and rewards | **Partially implemented**; **Local/demo** | `rewards.ts` defines disabled-by-default earning rules, ledger states, idempotency checks, reversals, redemption eligibility, tiers, and ranking calculations. Athlete and venue views/history display truthful empty states. | Trusted server-side qualifying events, real offers/redemptions, durable ledger, anti-abuse controls, and backend authorization. No app event currently qualifies for points. |
| Home dashboard | **Local/demo** | Scrollable Home includes search, Nearby Players and venue entry points, sports shortcuts, sample games/venues, fitness/challenge links, notifications, and demo interactions. | Live authorized catalogue, verified local inventory, real availability, and recommendation rules. |
| Create games and activities | **Local/demo** | Create supports local unpublished game drafts; sample game join/save actions are device-local previews. They do not publish an activity or reserve a place. | Shared game records, invitations/join requests, eligibility, capacity, attendance, moderation, and notifications. |
| Activities | **Partially implemented** | Dedicated tab discovers upcoming public activities from the existing account-backed activity repository and links to activity details; city and sport filters are available. | Broader filters, activity creation improvements, and end-to-end participation/notification testing. |
| Universal search | **Partially implemented**; **Local/demo** | Shared local search covers the canonical sports catalogue and sample activities, venues, groups, coaches, and public challenge previews. The dedicated Discover screen also searches published athletes, activities, venues, and coaches through authenticated Supabase repositories, with city/sport filters and pagination. | Unified cross-category search, broader filtering, and live events/teams/groups. Local sample results remain separate from backend records. |
| Sports catalogue | **Implemented** | A canonical shared catalogue with stable IDs, aliases, categories, and selected sport metadata feeds mobile, web, and account-backed sport preferences; catalogue behavior is tested. | Dedicated sport detail pages with live related records. |
| Nearby Players | **Partially implemented**; **Local/demo** | A dedicated screen and discovery entry points exist with clearly identified sample profiles and local navigation/follow-preview actions. | Real player query/search, availability/skill matching, privacy-aware location/radius, invitations, and backend relationships. No live proximity or precise location is provided. |
| Gyms and sports venues | **Partially implemented**; **Local/demo** | A dedicated authenticated directory lists owner-published venue records and supports private inquiries. Listings are explicitly not independently verified; prices, facilities, photos, and live availability are not implied. Separate sample listing/detail screens remain fictional local previews. | Venue moderation/verification, media, accurate facility details, and authorized live availability. |
| Venue/business management | **Partially implemented**; **Local/demo** | Mobile has a dedicated Venues destination and a live account-backed business/venue dashboard using existing owner-scoped records. A separate local preview still supports venue drafts, facilities, hours/pricing, review state, booking preview, and tournament drafts. | Parent business and branch lifecycle, staff permissions, uploads, real review/verification, and publication approval. |
| Bookings and availability | **Local/demo** | Venue detail offers a local booking/price/overlap preview; business-side preview state is not a reservation system. | Server-authoritative calendars, expiring holds, race-safe conflict prevention, confirmed status transitions, cancellation/refunds, attendance, and audit history. |
| Community feed | **Partially implemented** | With Supabase configured, mobile can read paginated text posts and create posts as the signed-in user. Without it, device-local posts can be created, edited, deleted, and paged. | Remote edit/delete, remote likes/comments/bookmarks, media, venue posts, notifications, and tested privacy policies. |
| Likes, comments, bookmarks | **Local/demo** | Device-local interactions are available in preview. | Shared account-backed records, abuse controls, notification delivery, and backend access policies. |
| Challenges | **Local/demo** | Local challenge create/edit/view, audience, dates, goals/rules, participation/progress preview, and invitation state transitions exist. Public local previews can appear in search. Progress is self-reported, not verified; proposed rewards are not issued. | Shared participation, backend access control, trusted/activity-derived progress, abuse prevention, and real reward issuance. |
| Fitness tracking | **Partially implemented; Supabase required** | Authenticated API and screens support workouts/exercises/sets, goals, manual daily metrics, body-weight entries, history, and summaries. Data is intended to remain account-backed, not copied into AsyncStorage. | Apply/review fitness migration in a project and test remote RLS. Apple Health and Health Connect are not integrated; no wearable permissions or sync are implemented. |
| Profile and settings | **Partially implemented** | Signed-in Profile is a separate account-backed view with profile details, sports, social summary, and an editor route. Settings exposes persistent theme, profile/privacy, role, and sign-out controls; account deletion is not simulated. | Expanded account preferences and end-to-end privacy/accessibility testing. |
| Account-backed athlete profile | **Partially implemented** | Phase 2.1, Phase 2.2, and the additive athlete onboarding/preferences migration are applied to the verified linked project. Profile rows retain existing visibility-scoped RLS; fitness goals and onboarding state are owner-only; avatar objects are public while owner writes are restricted; sport preferences retain public-profile read and owner-write policies. | Separate-account authorization tests, signup-trigger creation, activity discovery integration, and real-device end-to-end coverage remain. |
| Notifications | **Partially implemented** | Dedicated screen loads the existing account-backed notification records and supports marking one or all unread records as read. | Delivery generation, categories/preferences, deep links, and end-to-end authorization tests. No delivery is simulated by the client. |
| Private messages | **Planned** | Dedicated Messages screen explains that conversations are not yet stored or shown. | Conversation/message schema, membership authorization, RLS, realtime delivery, moderation, and notification integration. No fake conversation data is displayed. |
| Events and tournaments | **Local/demo** | Business users can create local tournament drafts using catalogue sports. Search and other screens include sample event concepts. | Public event records, registration, teams/fixtures/results, operations, real participant workflows, and notifications. |
| Teams, groups, and communities | **Local/demo**; **Planned** | Search can show isolated sample group records; there is no complete group-detail/membership workflow. | Account-backed groups, members, roles, events, feed, moderation, and discovery. |
| Venue Points, offers, and ranking | **Partially implemented**; **Local/demo** | Separate venue ledgers/rules/tier criteria and ranking calculations are implemented and unit-tested. Rules are disabled; no trusted venue evidence, offers, or valid ranking dataset exists. | Verified booking/payment/review signals, server-owned ledger, anti-manipulation controls, transparent criteria, and sufficient verified data. |
| Payments and settlements | **Planned**; **Blocked** | No payment provider or trusted transaction flow is connected. | Secure checkout, webhook verification, refunds, commissions, statements, payouts, reconciliation, and venue/business financial reporting. |
| Web application | **Partially implemented** | Vite/React web page supports Supabase email auth and account-backed athlete onboarding/profile editing when configured; it shows a setup state without credentials. | Web feature parity, signup role selection, responsive product routes, and deployment verification. |
| Supabase/backend | **Partially implemented**; **Blocked** | Optional client factories, mobile/web auth and data-access code, shared types, and eight SQL migrations exist. | Configure a project, review/apply migrations, verify auth/RLS/storage/functions, add missing product schemas, and test with ordinary accounts. |

## Data, local previews, and privacy boundaries

### Device-local development repository

`apps/mobile/src/local-development-repository.ts` persists development records with AsyncStorage under a versioned `moveit:development:v1:` namespace. Startup hydrates the profile, challenge, community, venue/business, activity, social, and rewards preview repositories before rendering routes. Storage and hydration errors are surfaced rather than silently treated as successful saves.

This is one device’s unencrypted development data, not an account database or secure boundary. It is not synchronized between devices or users. Local role selection is not authentication or server authorization. Demo likes, comments, follows, challenges, bookings, and venue records do not reach other users. Avoid placing passwords, access/refresh tokens, service keys, sensitive health data, or sensitive personal information in local storage. Fitness workouts, body weight, metrics, and goals are intentionally backend-only.

### Supabase and migrations

The supplied Supabase project URL and public publishable key are configured in app-specific, ignored local files (`apps/mobile/.env` and `apps/web/.env`). The tracked `.env.example` contains blank placeholders only. The CLI verified the linked project reference as `zuzusqpxjnqobwiafwog`; the initial five migrations, Phase 2.1 avatar migrations, and Phase 2.2 athlete sport-preference migration are recorded there. Authenticated profile editing and avatar lifecycle operations were tested against that project. These results apply only to this linked project; they do not prove other environments are configured.

The checked-in migrations are:

1. `20261026000000_phase1_foundation.sql` — creates the `app_role` and `profile_visibility` enums, `profiles` and `user_roles` tables, profile timestamp/user-creation triggers, and `has_app_role()`. Enables RLS on both tables; policies permit public-or-self profile reads, self profile updates, and own-role reads. Column grants restrict profile updates to editable profile fields.
2. `20261026041000_community_posts_and_connections.sql` — creates `posts` and `player_connections`, validation constraints, feed/owner/request indexes, and an updated-at trigger. Enables RLS and adds four post policies plus four connection-request policies for public-profile requests, owner-visible requests, recipient accept/reject, and requester cancellation. Grants are explicitly scoped to those operations/columns.
3. `20261026050000_fitness_tracking.sql` — creates the `fitness_metric` enum and `workouts`, `workout_exercises`, `workout_sets`, `fitness_goals`, `fitness_daily_metrics`, and `body_weight_entries`; adds validation constraints, indexes, update triggers, and `save_workout()`. Enables RLS on all six tables with owner-scoped policies, including ownership checks through the workout/exercise relations. Grants authenticated users CRUD subject to RLS and grants the workout RPC only to authenticated users.
4. `20261026062000_account_onboarding.sql` — creates `user_onboarding` for selected/completed/active role preferences, with subset and allowed-value constraints, an active-role index, and an updated-at trigger. Enables RLS with own-row select/insert/update policies and grants those operations only to authenticated users.
5. `20261028060000_athlete_profile_details.sql` — adds optional `avatar_url` and `sports_interests` to the existing auth-linked `profiles` table; creates `profile_fitness_goals` with owner-only RLS; updates the signup trigger to fall back to a generated unique username if supplied metadata is invalid or already taken; and adds an authenticated invoker RPC that atomically saves a user's public profile fields and private fitness goals.
6. `20261101051042_phase21_avatar_storage_and_profile.sql` — adds the constrained `avatar_object_path`, owner-scoped profile insert policy, and public `moveit-avatars` bucket with a 5 MiB limit and JPEG/PNG/WebP allowlist.
7. `20261101053833_avatar_owner_select_for_delete.sql` — lets authenticated users list objects only under their own UID folder. This is required by Supabase Storage deletion; it does not grant anonymous/public object listing.
8. `20261101054913_athlete_sport_preferences.sql` — adds owner-scoped `profile_sports_preferences`, backfills existing catalogue IDs with an unset skill level, and adds an authenticated invoker RPC that atomically saves validated sport IDs, skill levels, favourite flags, and the legacy `profiles.sports_interests` array.

The existing profile primary key `profiles.id` already references `auth.users(id)`; it is retained for compatibility with existing routes, foreign keys, and queries rather than adding a second `user_id`. The existing `handle_new_user()` trigger creates a profile row at signup; the new profile fields receive safe defaults/null values. Profile fitness goals are stored separately and readable only by their owner, even when the profile itself is public.

**Static RLS coverage check:** all 13 application tables declared across these migration files explicitly enable RLS and have at least one policy: `profiles`, `user_roles`, `posts`, `player_connections`, `workouts`, `workout_exercises`, `workout_sets`, `fitness_goals`, `fitness_daily_metrics`, `body_weight_entries`, `user_onboarding`, `profile_fitness_goals`, and `profile_sports_preferences`. The local Supabase config exposes `public` and `graphql_public`; these migrations create no app tables in `graphql_public`. This is a source review only: it does not inspect the remote project, prove migrations ran, or establish that policy behavior is correct. Some intended flows are deliberately absent from the current policies (for example private-profile follow requests and approved-follower access to private posts). The `user_onboarding` table stores preferences, not grants of privileged roles.

Migration history, avatar policies, and sports-preference RLS/function grants were verified on the linked MOVEIT project. Authenticated profile/avatar and sports-preference workflows were exercised on web. The checked-in migrations also define published venue/coach directories and private inquiries, activity participation, social interactions, and notifications; they do not provide venue-business membership authorization, bookings/payments, challenge or tournament workflows, follower-count summaries, or rewards ledgers/offers. Other environments still require an explicit project-reference check, migration review, and workflow verification before applying changes.

The Supabase client is initialized from these variable names (never commit their values):

- Mobile: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- Web: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

The existing variable names retain `ANON_KEY` for compatibility; the supplied `sb_publishable_...` key is the public client key passed to Supabase JS. These values are intentionally exposed to client bundles, so never substitute a service-role or secret key.

The mobile Auth screen’s **Test Supabase connection** control makes a read-only `GET` request to the configured project’s Auth health endpoint, with a 10-second timeout. It does not sign in, query a table, or change data. A successful health response is only a network/service health signal; use a real authenticated workflow to verify database access and policy behavior.

On native mobile, auth storage uses Expo SecureStore. The Vite web client persists auth sessions in browser storage and uses Supabase JS automatic token refresh; it does not use Next.js server components or middleware, and its browser storage is not an HttpOnly cookie. Never put a service-role key in a client app or `.env` file used by client bundles.

### Production authorization and data requirements

Before launch, design and verify database/server controls for:

- Foreign keys and immutable ownership for accounts, business memberships, venues, facilities, posts, challenges, participants, bookings, rewards, and ledger events.
- Unique constraints for usernames, follow/connection pairs, challenge participation, and idempotent qualifying events.
- Indexes for public discovery, owner/member lists, challenge dates/status, venue slugs, facility schedules, booking queues, and date-overlap checks.
- RLS that protects private profiles and content, follower-only resources, invite-only challenges, customer booking details, and business/staff operations. Search and notifications must never bypass these policies.
- Trusted server validation of role grants, ownership, challenge eligibility, participant limits, progress, attendance, booking totals/state changes, payment/refund webhooks, and point awards/redemptions.
- Atomic booking holds and overlap prevention; client-side checks are not sufficient to resolve concurrent reservations.
- Audit-safe, idempotent point ledger writes and reversals. Users must not be able to spoof event evidence, assign owner IDs, grant themselves points, set verification, or approve/publish their own venues.
- Privacy-safe media storage, reporting/abuse controls, and rate limits.

The SQL policies in the repository have not been exercised against a live project. Passing TypeScript, unit tests, and local previews is not proof of backend security.

## Athlete Card and MOVEIT Points direction

The agreed Athlete Card is a profile-integrated identity and activity summary, eventually including selected sports, qualifying activity, points balance, tier/progress, points history, and eligible venue offers. It is not a payment card. A universal MOVEIT Pass or separate Arena Card is outside the current scope.

The points design distinguishes pending, confirmed, redeemable, reversed, and expired points from reputation and tier progression. Potential events include completed eligible bookings, verified payment/attendance, participation, useful community contributions, and qualifying referrals. Awards must be event-deduplicated; cancellation, refunds, expiry, and invalid events need explicit rules.

Venue Points are separate from athlete points. Future ranking must consider verified completed activity, fulfilment/reliability, genuine reviews, listing quality, relevance, and recency—not points alone. No fake reviews/transactions, owner-edited balances, automatic verification, or guaranteed ranking should be allowed. Current local rules are disabled and no real qualifying events, offers, rewards balance, tier, or ranking are present.

## Current limitations and known gaps

- Supabase environment values are placeholders in the checked-in example; no remote project, migration application, or RLS verification is established by this repository.
- The web application does not provide the mobile product experience.
- Mobile local/demo workflows are not multi-user, synchronized, authoritative, or secure.
- Local business registration and venue management remain preview-only; the separate authenticated workflow creates account-backed business/venue directory records. Role choice does not grant business permissions or verification.
- Sample user/venue/event/trainer data is fictional. Sample venue prices and facility details are illustrative; no live availability or verified status is claimed.
- Universal search is a local index, not a backend search service. Player search and live nearby matching are not implemented.
- Notifications use existing account-backed records, but event generation and delivery workflows are incomplete. Private messaging has no schema or realtime backend and remains an honest empty state.
- Real booking conflict prevention, payments, refunds, commission, settlements, attendance verification, and financial reporting are absent.
- Google/phone authentication, media upload, wearables, and production rewards redemption are absent.
- No lint script is declared in the root or workspace package manifests.
- The web production build emits non-blocking Rollup warnings about annotation comments in the installed Zod package; with Supabase configured, Vite also reports a bundle chunk over 500 kB.
- The previous Fontisto font-resolution issue is not recorded here as a current confirmed issue; it was not the subject of the checks below.

## Development setup

### Prerequisites

- Node.js and npm compatible with the installed Expo SDK 58 toolchain. The earlier project setup specifies Node.js 20.19+ and npm 10+.
- For native device builds, the relevant iOS/Android toolchain; Expo Go support depends on a compatible Expo Go release.
- Supabase is optional for browsing local mobile previews, but required for connected auth, fitness data, and remote community features.

### Install dependencies

From the repository root:

```powershell
npm install
```

### Start mobile

```powershell
npm run dev:mobile
```

The Expo welcome screen offers **Explore the demo** without signing in. Use the Expo CLI prompts to open a simulator/device or scan the QR code. Local preview data remains on that device.

### Start web

```powershell
npm run dev:web
```

The web app requires its Supabase environment to use the auth/profile workflow; without it, it displays setup guidance rather than a mobile-style local demo.

### Checks available from the root

```powershell
npm run typecheck
npm test
npm run build:web
```

There is no configured lint command. The mobile workspace’s direct typecheck is also available:

```powershell
npm run typecheck --workspace @moveit/mobile
```

### Optional Supabase setup

1. Use the existing Supabase project URL and public publishable/anon key, or create a project and obtain its client-safe values. Never use a service-role key in the mobile or web app.
2. If the ignored app-specific `.env` files are absent in a fresh checkout, use `.env.example` as a template and set only the matching variable names above. Keep local env files out of version control.
3. Review every SQL migration against the target project and its existing migration history before applying.
4. Configure email/password, email verification, site URL, and redirect URLs in Supabase Auth.
5. Apply reviewed migrations with the Supabase CLI if appropriate for the target project, then verify each workflow and RLS policy using ordinary test accounts.

The Phase 2.1 `moveit-avatars` bucket and profile object-path changes are applied to the linked MOVEIT project. Public avatar reads do not make profile rows public; authenticated upload, listing, and delete policies are restricted to each caller's UID folder, and no public listing policy exists.

The mobile device must be able to reach the configured Supabase URL. `localhost` on a physical phone refers to the phone itself, not the development computer.

## Roadmap

Priorities below reflect the current gap between local product previews and a production service.

### Phase 1 — UI and local functionality

- Refine Community, Venues, Fitness, Activities, Profile, and both themes; keep Home, Discover, and Create available as secondary routes.
- Verify primary navigation, route links, empty/error/loading states, and accessibility.
- Complete the Athlete Card presentation and integrate it into Profile.
- Keep Athlete Points and Venue Points interfaces truthful and clearly local; do not enable awards without trusted evidence.
- Preserve a reliable Expo demo and avoid introducing fake backend success.

### Phase 2 — Core product workflows

- Complete account profile editing and player discovery with privacy-aware search.
- Define whether connections evolve into follows or remain mutual connections; keep UI and policy terminology consistent.
- Complete supported athlete community interactions and build venue-specific posting only if in scope.
- Develop sport detail, games, events, teams, and tournament participant workflows.
- Extend venue detail and business management for a parent business with multiple individually managed branches.
- Build booking interfaces and local workflow tests while clearly separating preview behavior from reservations.

### Phase 3 — Backend integration

- Select/configure Supabase and review/apply migrations through a controlled process.
- Validate authentication, profile visibility, account recovery, and role onboarding.
- Add business/membership/venue, availability/booking, challenges, notifications, media, and rewards schemas as product requirements are finalized.
- Add RLS and trusted server operations for role grants, business membership, private content, bookings, payments, and points.
- Implement atomic availability holds, state transitions, payment/refund webhooks, idempotent ledgers, redemption eligibility, and audit history.
- Test policies and concurrent workflows with separate ordinary accounts; client tests are not a substitute.

### Phase 4 — Lahore pilot readiness

- Onboard and verify real venues and required business documentation.
- Validate prices, facilities, operating schedules, booking operations, and support procedures.
- Test payment, cancellation, refund, settlement, privacy, security, performance, and outage cases.
- Validate points/discount rules against trusted transactions and genuine reviews.
- Establish moderation, abuse reporting, monitoring, support, incident response, and release criteria before expansion.

Other agreed but unimplemented scope includes streaks, wearable integrations, AI coaching/matching, advanced analytics, venue verification/administration, and production rewards redemption. Each remains **Planned** until an actual implementation and its dependencies are verified.

## Working conventions

- Use TypeScript types and shared Zod validation from `packages/shared` where the same model or input is used across apps.
- Keep routes under the existing Expo Router hierarchy; preserve the primary Community, Venues, Fitness, Activities, and Profile tabs and keep business workspace routes separate.
- Keep UI independent of storage details. Add repository/service functions rather than coupling screens directly to Supabase or raw demo arrays.
- Use `sports-catalogue.ts` canonical IDs and aliases instead of introducing duplicate sport lists.
- Keep themes token-driven and use the existing component/icon patterns. Add accessible names, roles, adequate touch targets, and contrast.
- Every async screen should distinguish loading, empty, success, and error states. Do not turn errors into success-shaped local fallbacks.
- Mark local/sample content as demo and never imply remote delivery, verification, booking, payment, or persistence.
- Add focused Vitest coverage for pure validation and state transitions. Remote authorization and RLS require separate project-backed tests.

## Verification performed

Latest local verification:

| Command | Result |
|---|---|
| `npm test` | Passed: 16 test files, 139 tests. |
| `npm run typecheck` | Passed: mobile and web TypeScript checks. |
| `npm run build:web` | Passed: TypeScript build check and Vite production build. Existing Zod annotation and large-chunk warnings remain non-blocking. |
| `npx expo export --platform web` (from `apps/mobile`) | Passed: Expo bundled the mobile app and its routes. |
| `git diff --check` | Passed. |
| Mobile configured Supabase Auth health request and UI check | Passed: HTTP 200; the screen displayed reachable status. The request did not sign in or query/write app data. |
| Migration RLS audit | All 13 application tables across the checked-in migrations enable RLS and have policies; remote sports table RLS, grants, invoker function settings, and execute permissions were queried on MOVEIT. |
| Lint | Not run: no lint script is configured. |
| Authenticated workflows | Profile editing and avatar lifecycle passed earlier; sport preference create, reload/prefill, and removal passed against the linked backend. Test values were removed and the initial empty state was restored. Cross-account authorization was not tested. |
| Phase 2.1 migrations | Applied remotely: `20261101051042_phase21_avatar_storage_and_profile.sql` and `20261101053833_avatar_owner_select_for_delete.sql`; bucket, RLS policy, limits, and object cleanup were verified on the linked project. |
| Phase 2.2 migration | Applied remotely: `20261101054913_athlete_sport_preferences.sql`; table RLS, grants, function `search_path`, invoker status, execute permissions, and migration history were verified. |
| Native iOS/Android build | Not run. |
