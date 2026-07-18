# FoodFinder: Admin Model & Public iOS Launch Plan

This document captures the design decisions around catalog/user management and
lays out the roadmap for turning FoodFinder into a public iOS app for Austin.

## Where things stand

- One **shared master catalog** (`restaurants`, one row per physical location)
  feeds every family's list via `brands` + `group_restaurants`.
- Auth is **group-based**: a family shares one name + password; members are
  passwordless profiles. There are no emails, no roles, no user directory.
- The "iOS app" today is the web app installed as a **PWA** — there is no
  native project.

## Account management: the two options considered

### Option A — Owner admin console (built now)

A `/admin` area gated by an `ADMIN_SECRET` environment variable and a signed
cookie. No change to how families log in; works identically on web and phones
(it's a web page). Gives the owner:

- a directory of every group: members, list size, visit count, last activity;
- group rename / password reset / delete;
- a master-catalog editor (edit, delete, see per-row tracking, CSV bulk import).

**Why chosen now:** zero disruption, one env var to set up, and it solves the
actual pain (visibility, recovery, catalog hygiene) today. Its limits are real
but acceptable at current scale: one shared admin secret, no per-user identity,
no email-based recovery for families where every device logged out (the owner
resets it by hand instead).

### Option B — Real per-user accounts (deferred to public launch)

Migrate to **Supabase Auth**: individual email + password (or magic-link)
accounts, a `users` table with a `role` column, families as invite/join-code
entities, email password-reset, and the admin console keyed off `role='admin'`
instead of a shared secret.

**Why deferred:** it's a breaking change to every family's login flow and only
becomes *necessary* when the app is public — Apple requires in-app account
deletion and credible account security for App Store apps with accounts, and a
public user base needs self-serve password recovery. Build it as Phase 1 of the
launch plan below, not before.

## New-family onboarding (built now)

Rejected as a default: auto-importing the entire catalog (~2,000 locations ≈
~1,600 brands) — the wheel, votes, and ratings degrade badly on an untriaged
list that big. Instead, new groups land on `/start` after picking a profile:

1. **Browse and hand-pick** — the catalog browser (now with "add all shown").
2. **Add whole cuisines** — bulk-add every match to the wishlist.
3. **Google Takeout import** — the existing flow.
4. **Add everything** — the full catalog as wishlist, behind a confirm, for
   families who prefer pruning to picking.

Bulk adds are batched server-side (`trackRestaurantsBulk`) and never overwrite
the status of brands a family already tracks.

---

# Public iOS app for Austin — the roadmap

**Chosen path: Capacitor wrapper.** The existing Next.js app is wrapped in a
native shell (a WKWebView pointed at the deployed app) with native
capabilities layered in. ~95% of the code stays shared with the web app; the
alternative (native SwiftUI) means rebuilding every feature twice plus a REST
API layer, for months of extra work and permanent double maintenance.

**The honest risk:** Apple's App Review guideline 4.2 (minimum functionality)
rejects apps that are "just a website." Mitigation is to make the shell
genuinely native where it counts: push notifications, haptics on the wheel,
native share sheet, offline splash/error states, and app-quality navigation.
Wrapped apps ship this way routinely, but budget for one rejection-and-resubmit
cycle.

## Phase 0 — Hardening (prerequisite, ~1 week) — ✅ mostly done

Security and correctness work that should happen before any public exposure:

- ✅ Passwords now hash with **bcrypt** (`lib/password.ts`); legacy SHA-256
  hashes verify and migrate automatically on the next successful login.
- ✅ The `"foodfinder-dev-secret"` fallback fails hard in production when a
  real database is configured (`lib/secret.ts`) — `AUTH_SECRET` is required.
- ✅ **Rate limiting** on login (10/5 min), group creation (5/hour), password
  change, and admin login (`lib/rateLimit.ts`). Per-instance in-memory; move
  to a shared store (Upstash) if abuse shows up in practice.
- ✅ `middleware.ts` verifies the signed household cookie at the edge before
  any app page runs (per-page checks retained as the second layer).
- ✅ **Vercel Analytics** wired into the root layout (enable in the Vercel
  dashboard). Sentry deferred until there's public traffic to triage.
- ⏳ Operational, on the owner: set the Google Places **budget alert and
  per-day quota caps** (see DEPLOY.md §3) and review attribution requirements
  when Places data gets public exposure.

## Phase 1 — Accounts for the public (Option B, ~2–3 weeks)

- Supabase Auth with email/password + magic links; `users` table with `role`.
- Families become first-class: a user creates a family, invites others by
  **join code or link** (replaces the shared-password model).
- Email password reset; **in-app account deletion** (App Store requirement).
- Migration path for existing groups: on first login, each family member
  claims their profile with an email.
- Admin console switches from `ADMIN_SECRET` to `role='admin'`.
- Terms of service + privacy policy pages (required for App Store submission,
  and Google Places data usage must be disclosed).

## Phase 2 — The Capacitor shell (~2 weeks)

- Apple Developer account ($99/yr), bundle ID, App Store Connect app record.
- Add Capacitor to the repo (`@capacitor/ios`); configure the shell to load
  the production URL with a native splash screen, offline error page, and
  status-bar/safe-area styling.
- **Push notifications** (the single biggest "feels native" win): APNs via
  `@capacitor/push-notifications`, a `device_tokens` table, and a send path
  (e.g. Supabase Edge Function). First notification use-cases: "family vote
  started — cast your pick," weekly Discover digest.
- Native touches: haptics on wheel spin and vote, native share sheet for
  restaurant links, app icon + launch screen assets.
- Deep links / universal links so shared restaurant URLs open the app.

## Phase 3 — App Store submission (~1–2 weeks including review)

- App Store Connect metadata: name, subtitle, description, keywords,
  screenshots (6.7" and 6.1" sets), privacy nutrition labels (accounts,
  location-adjacent data, analytics), age rating, support URL, privacy
  policy URL.
- TestFlight beta with a handful of Austin families; fix what they hit.
- Submit; respond to review feedback (see the 4.2 note above).

## Phase 4 — Austin launch operations (ongoing)

- **Catalog quality becomes a product surface:** the admin catalog editor is
  now the moderation tool. Consider requiring `google_place_id` on new public
  submissions, and a periodic sweep for closed restaurants (Places "business
  status") to keep the catalog fresh.
- Rethink family-created catalog rows: today any family "add" grows the shared
  catalog. For public use, either keep new rows **private to the family** until
  admin-approved, or auto-accept only rows with a verified Google place id.
- Seed depth: the 2,045-restaurant Austin seed is a strong start; refresh it
  quarterly via the Places sweep.
- Costs at small scale: Apple $99/yr; Vercel and Supabase free tiers hold until
  real traction; Google Places is the variable to watch (set quotas).
- Feature changes worth making for strangers: onboarding copy that doesn't
  assume one family, empty-state polish, a public landing page, and
  server-side input validation everywhere a form exists.

**Rough total: 6–9 weeks of part-time work to a submitted app**, with Phases
0–1 being the bulk of the engineering and the shell itself being days, not
weeks.
