import AsyncStorage from '@react-native-async-storage/async-storage';
import firebase from '@react-native-firebase/app';
import Constants from 'expo-constants';
import { FirebaseApp, initializeApp } from "firebase/app";
import { Auth, getAuth, initializeAuth } from "firebase/auth";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function initFirebase() {
  firebase.setReactNativeAsyncStorage(AsyncStorage);
  if (app) return { app, auth };
  const config = {
    apiKey: Constants.expoConfig?.extra?.firebaseApiKey,
    authDomain: Constants.expoConfig?.extra?.firebaseAuthDomain,
    projectId: Constants.expoConfig?.extra?.firebaseProjectId,
    storageBucket: Constants.expoConfig?.extra?.firebaseStorageBucket,
    messagingSenderId: Constants.expoConfig?.extra?.firebaseMessagingSenderId,
    appId: Constants.expoConfig?.extra?.firebaseAppId
  }
  app = initializeApp(config);

  try {
    // initializeAuth will throw if it's not supported in the environment;
    auth = initializeAuth(app) as Auth;
  } catch (e) {
    // Fallback for web or if the native persistence module isn't available
    console.log(e);
    auth = getAuth(app);
  }

  return { app, auth };
}

export function getFirebaseAuth() {
  if (!auth) initFirebase();
  return auth!;
}
