# LocalActs (Expo + TypeScript starter)

LocalActs is an Expo-managed (TypeScript) application that now ships with a complete Firebase authentication flow, Google OAuth via Expo AuthSession, role-based onboarding, and gated navigation for fan and artist experiences.

## Firebase & OAuth configuration

1. Provide your Firebase web credentials via environment variables consumed by `app.config.js`:
   - `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`
2. Configure Google OAuth client IDs for Expo AuthSession:
   - `GOOGLE_EXPO_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_WEB_CLIENT_ID`
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

