import { updateProfile } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/src/lib/firebase";
import type { GeocodeLocationResult, LocationMode } from "@/src/services/mapbox";
import { AppUser } from '../types/auth';

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
  await setDoc(
    doc(db, "users", uid),
    {
      displayName,
      location,
      profileCompleted: true,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: false }
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

