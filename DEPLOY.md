# Deploying FoodFinder — one-time setup (~10 minutes)

> **Already deployed? One-time database update for the "defer your vote"
> feature.** Open Supabase → SQL Editor → New query, paste the contents of
> `supabase/migrations/0002_vote_defer.sql`, and Run. Until you do, starting
> or deferring a vote will error; everything else keeps working.


After this checklist, every push to the repo deploys automatically and the
app runs itself. You need: a GitHub account (you have one), and free
accounts on Supabase and Vercel. No credit card for either.

## 1. Create the database (Supabase, ~4 min)

1. Go to <https://supabase.com> → **Start your project** → sign in with GitHub.
2. **New project** — name it `foodfinder`, pick a strong database password
   (you won't need it again, but save it), choose the region closest to home.
3. Wait ~1 minute for the project to provision.
4. Left sidebar → **SQL Editor** → **New query**. Paste the entire contents
   of [`supabase/schema.sql`](supabase/schema.sql) from this repo and hit **Run**.
   You should see "Success. No rows returned".
5. Left sidebar → **Project Settings** (gear) → **API**. Copy two values:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **`service_role` key** (under "Project API keys" — the secret one,
     *not* `anon`). Treat it like a password.

## 2. Deploy the app (Vercel, ~4 min)

1. Go to <https://vercel.com> → sign up with GitHub.
2. **Add New… → Project** → import the `foodfinder` repository.
3. Before clicking Deploy, expand **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | the Project URL from step 1.5 |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role key from step 1.5 |
   | `FAMILY_PASSWORD` | whatever password the family will type to get in |
   | `CRON_SECRET` | any random string (mash the keyboard) |

4. Click **Deploy**. ~2 minutes later you get a URL like
   `https://foodfinder-xyz.vercel.app`. That's your app — open it, enter the
   family password, add your family members, done.

> The weekly discovery sweep and the database keep-alive ping are already
> configured in `vercel.json`; Vercel picks them up automatically.

## 3. Optional: Google Places key (~3 min, unlocks Discover)

Without this everything works except restaurant autocomplete, the
new-restaurant feed, and recommendations.

1. Go to <https://console.cloud.google.com> → create a project.
2. **APIs & Services → Library** → enable **Places API (New)**.
3. **APIs & Services → Credentials → Create credentials → API key**.
   Under "API restrictions", restrict the key to the Places API (New).
4. **Billing**: Google requires a billing account, but personal usage stays
   inside the free monthly caps. To be safe, set a budget alert at $5
   (Billing → Budgets & alerts).
5. In Vercel: **Project → Settings → Environment Variables** → add
   `GOOGLE_PLACES_API_KEY`, then **Deployments → ⋯ → Redeploy**.
6. In the app: **Settings → Home location** — enter your ZIP code and a
   radius (exact coordinates also work, under "Advanced").

## 4. Put it on everyone's phone (1 min each)

Open the app URL in the phone browser, log in once, pick your profile, then:

- **iPhone**: Share button → **Add to Home Screen**
- **Android**: browser menu → **Install app** / **Add to Home screen**

It behaves like a native app from then on; the login sticks for a year.

## 5. Seed your restaurants

Fastest path: **Settings → Import from Google Takeout**. At
<https://takeout.google.com>, click "Deselect all", then tick exactly two
items in the alphabetical product list: **"Maps (your places)"** (under M,
right after "Maps" — contains `Reviews.json` and `Saved Places.json`) and
**"Saved"** (under S — contains one CSV per saved list, like
`Favorites.csv` and `Want to go.csv`). Export, unzip, and upload any of
those files in the app: reviews become "Been there" with your ratings;
saved places and list CSVs go to the wishlist. Untick non-restaurants in
the preview. Then spend five minutes adding cuisines/prices to your top
spots — the picker gets smarter with every rating and visit you log.

## Troubleshooting

- **"Demo mode" banner showing in production** — the Supabase env vars are
  missing or typo'd in Vercel; re-check step 2.3 and redeploy.
- **Discover tab says key not set** — step 3.5 (and redeploy after adding it).
- **Database paused** (free tier pauses after ~7 days idle) — the keep-alive
  cron prevents this; if it ever happens, open the Supabase dashboard and
  click Restore.
