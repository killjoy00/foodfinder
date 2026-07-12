# 🍽️ FoodFinder

The family restaurant picker. Track where you eat, rate places per family
member, and let a weighted spin wheel settle "where should we eat tonight?"
— with filters, family votes, vetoes, and a wishlist.

## Features

- **Tonight picker** — filter by cuisine, price, tags (kid-friendly, patio,
  takeout…), who's eating, dine-in vs takeout; then spin the wheel. The pick
  is weighted: family favorites and places you haven't visited in a while
  come up more; a third Mexican night in a row gets penalized. An
  "adventure level" slider mixes in wishlist spots.
- **One-tap visit logging** — "We went! 🎉" keeps the history (and the
  recency weighting) fresh.
- **Family vote** — the wheel proposes three; everyone picks a favorite on
  their own phone and gets one veto. Most picks wins, vetoes knock options out.
- **Multiple groups** — each family is its own group (group name + password)
  with its own profiles, lists, ratings, and votes; restaurants are deduped
  into a shared catalog behind the scenes.
- **Per-person ratings** — Netflix-style profiles within a group;
  every family member rates places 1–10.
- **Wishlist** — places to try; first visit moves them to the rotation.
- **Discover** — a weekly sweep flags newly opened restaurants near home, and
  content-based recommendations suggest places matching the cuisines and
  price range your ratings show you love (requires a free Google Places key).
- **Google Takeout import** — seed the app from your existing Google Maps
  ratings and saved places in minutes. **CSV export** anytime.
- **PWA** — installs to phone home screens like a native app.
- **Deep links** — Google Maps and OpenTable from every result.

## iPhone app 📱

**[mobile/](mobile/GETTING-STARTED.md)** is a native iPhone app (Expo /
React Native) for the same data — same groups, profiles, wheel, and votes,
talking to your deployed site through `app/api/mobile/*`. Test it on your
phone in minutes with Expo Go, ship it via TestFlight/App Store with EAS
cloud builds — no Mac needed. See
**[mobile/GETTING-STARTED.md](mobile/GETTING-STARTED.md)**.

## Running it

```bash
npm install
npm run dev      # demo mode: in-memory sample data, no setup needed
npm test         # unit tests for picker/vote/import/export logic
npm run build    # production build
```

With no environment variables the app runs in **demo mode** (sample data,
resets on restart) so you can try everything immediately. To go live with
real persistent data, follow **[DEPLOY.md](DEPLOY.md)** — a ~10 minute
one-time setup on Vercel + Supabase free tiers ($0/month).

## How it's built

Next.js (App Router) + Tailwind, server actions for all mutations, and a
small data-adapter layer: `lib/data/supabase.ts` in production,
`lib/data/memory.ts` for demo mode. All the decision logic (weighted
picking, streak detection, vote tallying, Takeout parsing) lives in pure
functions under `lib/` with vitest coverage. Schema: `supabase/schema.sql`.
Weekly discovery sweep + database keep-alive run as Vercel crons
(`vercel.json`).
