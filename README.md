# LocalActs (Expo + TypeScript starter)

This repo contains a minimal Expo (TypeScript) app scaffolded to integrate Firebase (Web v9 modular), React Query, Zustand, and Expo Router.

Key files and where to paste Firebase config:

- `src/firebase/firebaseConfig.ts` — paste your Firebase config for `dev` and `prod` into the provided objects.
- `app.config.js` — sets `EXPO_RUNTIME_ENV` into `process.env`/`Constants.manifest.extra` so `src/firebase/init.ts` can pick the right config at runtime.

How the runtime config works:

- At build/run time set `EXPO_RUNTIME_ENV=prod` or `EXPO_RUNTIME_ENV=dev` (default: `dev`).
- The app reads that value using `process.env.EXPO_RUNTIME_ENV` (Node) or `Constants.manifest.extra.runtimeEnv` in managed Expo if you prefer.

Minimal file tree (created/modified):

app/
  _layout.tsx         — wraps router with Providers + AuthGate
  index.tsx           — landing page
  home.tsx            — Home screen
  login.tsx           — Login placeholder
src/
  firebase/
    firebaseConfig.ts — place your firebase placeholders here
    init.ts           — initializes firebase (modular SDK) based on env
  providers/
    Providers.tsx     — QueryClient + SafeArea + initFirebase
  auth/
    AuthGate.tsx      — subscribes to onAuthStateChanged and updates store
  store/
    useAuthStore.ts   — minimal Zustand store for user state

Dependencies to install (see package.json):

- firebase
- @tanstack/react-query
- zustand

Usage notes:

- Fill `src/firebase/firebaseConfig.ts` with your real config values.
- Start in dev: `EXPO_RUNTIME_ENV=dev expo start` (Windows PowerShell: use `$env:EXPO_RUNTIME_ENV = 'dev'; expo start`).
- Build for prod: set `EXPO_RUNTIME_ENV=prod` in your CI or local env before building.

Important: do NOT import `dotenv` in client-side code (any file under `app/` or used by Metro).
`dotenv` depends on Node built-ins (like `crypto`) and will break the Expo runtime. Use one of these
patterns instead:

- Use `app.config.js` (already present) to pass runtime values via `extra` and read them with
  `expo-constants` or `process.env` at build time.
- Use EAS secrets / environment variables in CI for production credentials.
- For local dev, set `EXPO_RUNTIME_ENV` in PowerShell before starting Expo, e.g.:

```powershell
$env:EXPO_RUNTIME_ENV = 'dev'; expo start
```
# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
