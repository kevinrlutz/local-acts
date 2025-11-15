import { updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/src/lib/firebase";
import type { GeocodeLocationResult, LocationMode } from "@/src/services/mapbox";

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
  console.log(db.toJSON());
  console.log("Saving profile for user:", uid);
  console.log("Display Name:", displayName);
  console.log("Location:", location);
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
  console.log('Profile saved successfully for user:', uid);

  if (auth.currentUser?.uid === uid) {
    await updateProfile(auth.currentUser, { displayName });
  }
};

