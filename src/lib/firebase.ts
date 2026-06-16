import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBZqxIIoEl5tIpb_XnhCu8qukDKGyfFWHM",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Validate that required config values are present
const missingConfigValues = Object.entries(firebaseConfig)
  .filter(([key, value]) => value === undefined)
  .map(([key]) => key);

if (missingConfigValues.length > 0) {
  console.error(
    "Firebase initialization error: Missing environment variables:",
    missingConfigValues,
    "Make sure your .env.local file is present with EXPO_PUBLIC_* variables"
  );
}

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app, "local-acts");
const storage = getStorage(app);
export { auth, db, storage };

