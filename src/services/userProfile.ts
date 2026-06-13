import { updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/src/lib/firebase";
import type { GeocodeLocationResult, LocationMode } from "@/src/services/mapbox";
import { AppUser } from "../types/auth";

export type UserLocationPayload = GeocodeLocationResult & {
  rawInput: string;
  mode: LocationMode;
};

export type CompleteProfilePayload = {
  uid: string;
  displayName: string;
  location: UserLocationPayload;
};

export const saveCompletedProfile = async ({
  uid,
  displayName,
  location,
}: CompleteProfilePayload) => {
  const userDocRef = doc(db, "users", uid);
  const docSnap = await getDoc(userDocRef);
  const isNew = !docSnap.exists();

  // Sanitize the location object to remove undefined fields
  const cleanLocation = Object.fromEntries(
    Object.entries(location).filter(([_, value]) => value !== undefined)
  );

  await setDoc(
    userDocRef,
    {
      displayName,
      location: cleanLocation,
      profileCompleted: true,
      updatedAt: serverTimestamp(),
      ...(isNew && { createdAt: serverTimestamp() }),
    },
    { merge: true }
  );

  if (auth.currentUser?.uid === uid) {
    await updateProfile(auth.currentUser, { displayName });
  }
};

export const getAppUserFromFirestore = async (
    uid: string
): Promise<AppUser> => {
    const docRef = doc(db, 'users', uid)
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
        return docSnap.data() as AppUser
    } else {
        throw new Error('No such user profile!')
    }
}

export const updateStageLightsPreference = async (
  uid: string,
  enabled: boolean
): Promise<void> => {
  const userDocRef = doc(db, "users", uid)
  await setDoc(
    userDocRef,
    { stageLightsEnabled: enabled, updatedAt: serverTimestamp() },
    { merge: true }
  )
}

export const updateHasVenueProfile = async (
  uid: string,
  value: boolean
): Promise<void> => {
  const userDocRef = doc(db, "users", uid)
  await setDoc(
    userDocRef,
    { hasVenueProfile: value, updatedAt: serverTimestamp() },
    { merge: true }
  )
}
