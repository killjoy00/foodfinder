# FoodFinder on your iPhone 📱

This folder is a real iPhone app — an [Expo](https://expo.dev) (React
Native) client for your FoodFinder server. It reuses the exact same
decision logic as the web app (the wheel weighting, vote rules, import
parsing all live in `../lib`), and talks to your deployed site through
its API. No Mac is ever required: you test with the free **Expo Go** app,
and Expo's cloud service (**EAS**) compiles the App Store binary for you.

## Step 0 — one-time server update (~2 min)

The mobile API ships with the web app, so your Vercel deployment needs to
be redeployed once from this branch/commit (no database changes, nothing
else to configure). After that, the same group name + password you use on
the web logs the app in.

## Step 1 — run it on your iPhone tonight (~10 min, free)

1. On the iPhone: install **Expo Go** from the App Store.
2. On any computer (Windows/Mac/Linux) with [Node](https://nodejs.org):

   ```bash
   git clone <this repo> && cd foodfinder/mobile
   npm install
   npx expo start
   ```

3. Scan the QR code with the iPhone camera → the app opens in Expo Go.
   (Phone and computer must be on the same Wi-Fi; if they aren't, use
   `npx expo start --tunnel`.)
4. Log in with your group name + password, and enter your site's URL
   (e.g. `https://your-foodfinder.vercel.app`) when asked. It's saved
   on the device after that.

Edits to the code hot-reload live on the phone — this is the everyday
development loop.

> Tip: to skip typing the server URL, create `mobile/.env` with
> `EXPO_PUBLIC_API_URL=https://your-foodfinder.vercel.app` before
> starting.

## Step 2 — share it with the family (free)

Everyone installs Expo Go and scans the same QR code while your dev
server runs. For an always-available copy without your computer running,
create a free account at [expo.dev](https://expo.dev), then:

```bash
npx eas-cli login
npx eas init          # links this project to your account (writes projectId)
npx eas update        # publishes the JS bundle; open it via the expo.dev link
```

## Step 3 — real app on real phones (Apple Developer Program, $99/yr)

When you're ready for a proper install (home-screen icon, no Expo Go):

1. Join the [Apple Developer Program](https://developer.apple.com/programs/)
   ($99/year, ~1 day for approval).
2. Build in Expo's cloud — no Mac, EAS handles certificates automatically:

   ```bash
   npx eas build --platform ios --profile production
   ```

3. **TestFlight** (recommended for the family): `npx eas submit -p ios`,
   then invite family members by email in App Store Connect → TestFlight.
   They install via the TestFlight app; updates arrive automatically.
4. **App Store** (public): same `eas submit`, then fill in the listing in
   App Store Connect and submit for review.

Before building, you may want to set your own iOS `bundleIdentifier` in
`app.json` (currently `com.mindellfamily.foodfinder`) and drop your own
icon into `assets/`.

## How this app is wired

- **Server**: `app/api/mobile/*` in the Next.js app wraps the same data
  layer the website uses. Login returns a signed household token; the app
  stores it in the iOS keychain (`expo-secure-store`) and sends it as a
  bearer header, plus the chosen profile as `X-FF-Profile`.
- **Shared logic**: `metro.config.js` maps `@shared/*` to `../lib/*`, so
  the picker, vote tally, distance, insights, duplicate detection, and
  Takeout parsing are literally the web app's modules. (This needs
  `experiments.onDemandFilesystem: "UNSTABLE_ALLOW_ALL"` in `app.json`
  so Metro will read files outside `mobile/`.)
- **Screens** (`app/`): expo-router file routes — five tabs mirroring the
  web nav (Tonight / Vote / Places / Discover / More) plus stack screens
  for restaurant detail/add/edit, catalog browse, duplicates, insights,
  import/export, and settings.

## Useful commands

```bash
npm run typecheck            # TypeScript over the whole app
npx expo start               # dev server + QR code
npx expo export --platform ios   # prove the bundle compiles
npx expo-doctor              # health check
```

## Building the next app

This setup is the template: `create-expo-app` for the shell, a small
token-authenticated JSON API on the backend, `expo start` + Expo Go for
the dev loop, and EAS for builds. Copy the pattern, not the code.
