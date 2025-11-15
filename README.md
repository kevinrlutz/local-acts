# LocalActs (Expo + TypeScript starter)

LocalActs is an Expo-managed (TypeScript) application that now ships with a complete Firebase authentication flow, Google OAuth via Expo AuthSession, role-based onboarding, and gated navigation for fan and artist experiences.

## Current onboarding flow

- `app/(auth)/sign-up.tsx` handles email/password account creation alongside Google OAuth using the Firebase JS SDK.
- `app/(auth)/account-setup.tsx` collects the user's display name plus either a zip code or city/state combination, geocodes it through Mapbox, and persists the coordinates to Firestore.
- `src/lib/firebase.ts` centralises the Firebase bootstrap (including React Native persistence) so both screens share the same auth + database instances.
- `src/services/mapbox.ts` and `src/services/userProfile.ts` wrap third-party calls to keep the screens lightweight.

## Required environment variables

These values must be surfaced through `app.config.js` (or EAS secrets) using the Expo `EXPO_PUBLIC_` prefix so they are available at runtime:

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Firebase web API key |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project id |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender id |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Firebase app id |
| `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` | (Optional) Firebase measurement id |
| `EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID` | Google OAuth client for Expo Go |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth client for Android dev builds |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth client for iOS dev builds |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth client for web |
| `EXPO_PUBLIC_MAPBOX_TOKEN` | Mapbox geocoding access token |

Without these variables the signup and account setup screens will block submission with descriptive errors so issues are caught before production.

## Firebase & OAuth configuration

1. Provide your Firebase web credentials via environment variables consumed by `app.config.js` (see `EXPO_PUBLIC_*` table above).
2. Configure Google OAuth client IDs for Expo AuthSession (again using the `EXPO_PUBLIC_GOOGLE_*` variables listed above).
3. Supply `EXPO_PUBLIC_MAPBOX_TOKEN` for the account-setup geocoder before shipping.
3. `src/firebase/config.ts` validates all Firebase values at runtime; missing keys will throw with guidance.
4. `src/firebase/init.ts` initialises the modular SDK, using AsyncStorage-backed persistence so auth survives restarts in the managed workflow.

## Auth module structure

```
src/
  auth/
    AuthGate.tsx               // listens for auth state, fetches Firestore profile, drives routing
    errors.ts                  // Firebase error → user-friendly message mapping
    screens/
      LoginScreen.tsx          // email/password login + Google AuthSession sign-in
      SignupScreen.tsx         // account creation with name capture
      ResetPasswordScreen.tsx  // password reset via email
      RoleSelectScreen.tsx     // fan vs artist selection + Firestore profile write
  firebase/
    config.ts                  // centralised Firebase config sourced from app.config.js extras
    init.ts                    // lazy accessors for app/auth/firestore instances
  providers/
    Providers.tsx              // SafeArea + React Query + Firebase bootstrap wrapper
  store/
    useAuthStore.ts            // Zustand store for auth status, user payload, and sign-out helper
  types/
    auth.ts                    // shared UserRole, AppUser, and AuthStatus types
app/
  _layout.tsx                  // wraps router with Providers + AuthGate
  (auth)/                      // login, signup, reset-password screens
  (role)/role-select.tsx       // role onboarding
  (fan)/fan/...                // fan stack (discover, favorites)
  (artist)/artist/...          // artist stack (profile, shows)
```

## Firestore document shape

Role metadata is persisted to `users/{uid}` when the role is chosen:

```json
{
  "displayName": "User supplied name",
  "role": "fan" | "artist",
  "createdAt": serverTimestamp(),
  "updatedAt": serverTimestamp()
}
```

Extend this document with additional fan/artist profile fields as you expand LocalActs.

## Manual test checklist

1. **Signup** – create a new email/password account, confirm the role selector appears, choose a role, and verify navigation to the correct stack. Relaunch to confirm persistence.
2. **Email login** – sign in with an existing user whose role is already set and ensure you are routed to the proper stack automatically.
3. **Password reset** – request a reset email and confirm the confirmation message appears and the email arrives.
4. **Google sign-in** – after configuring OAuth IDs, authenticate with Google and ensure Firebase logs you in and routing follows the stored role.
5. **Role enforcement** – delete the `role` field for a user in Firestore and relaunch; you should be taken back to the RoleSelect screen until a role is saved.
6. **Logout** – sign out from both fan and artist flows; you should land on the login screen with state cleared.

Run `npm install` after updating environment values so the project picks up `firebase`, `expo-auth-session`, `@tanstack/react-query`, `zustand`, and other dependencies.

### Important note about env handling

Do **not** import `dotenv` in client-side Expo code (anything under `app/` or bundled by Metro). `dotenv` pulls in Node-only modules and will crash the app. Use `app.config.js` (already configured) or EAS secrets instead.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the Expo development server:

   ```bash
   npx expo start
   ```

3. Scan the QR code with Expo Go, run on an emulator, or use a development build as needed.

The project uses Expo Router, so screens are organised by file structure in the `app/` directory. When you are ready for a fresh scaffold run `npm run reset-project` to archive the example screens.

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/)
- [Firebase for Web v9](https://firebase.google.com/docs/web/modular-upgrade)

