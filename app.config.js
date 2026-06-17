/**
 * Example app config that sets a runtime env var used by the app.
 * You can change EXPO_RUNTIME_ENV to 'prod' when building for production.
 */
module.exports = ({ config }) => {
  // Read environment variable set by CLI or CI
  const runtimeEnv = process.env.EXPO_RUNTIME_ENV || process.env.NODE_ENV || "dev";

  return {
    ...config,
    extra: {
      runtimeEnv,
      // Firebase configs
        firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
        firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
        firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
        firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
        firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
        // Google OAuth client IDs for Expo AuthSession
        googleExpoClientId: process.env.GOOGLE_EXPO_CLIENT_ID,
        googleIosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
        googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
        googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID,
    },
  };
};
