import { collection, doc, DocumentData, getDoc, getDocs, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import type { ActProfile, ActSocialLinks, CreateActProfilePayload } from "@/src/types/acts";

const sanitizeLinks = (links?: ActSocialLinks) => {
  if (!links) {
    return undefined;
  }
  const entries = Object.entries(links)
    .map(([key, value]) => [key, value?.trim() ?? ""] as const)
    .filter(([, value]) => Boolean(value));
  if (!entries.length) {
    return undefined;
  }
  return Object.fromEntries(entries) as ActSocialLinks;
};

// ...existing code...

const toDateOrNull = (value: unknown) => (value instanceof Timestamp ? value.toDate() : null);

const mapActSnapshot = (id: string, data: DocumentData): ActProfile => ({
  id,
  ownerUid: (data.ownerUid as string) ?? id,
  name: data.name as string,
  category: data.category as ActProfile["category"],
  profileImageRef: data.profileImageRef as string,
  links: (data.links as ActSocialLinks | undefined) ?? null,
  location: data.location as ActProfile["location"],
  createdAt: toDateOrNull(data.createdAt),
  updatedAt: toDateOrNull(data.updatedAt),
});

export const getAllActs = async (): Promise<ActProfile[]> => {
  const actsSnapshot = await getDocs(collection(db, "acts"));
  return actsSnapshot.docs.map((docSnap) => mapActSnapshot(docSnap.id, docSnap.data()));
};

export const createActProfile = async ({
  ownerUid,
  name,
  category,
  profileImageRef,
  links,
  location,
}: CreateActProfilePayload) => {
  // Sanitize the location object to remove undefined fields
  const cleanLocation = Object.fromEntries(
    Object.entries(location).filter(([_, value]) => value !== undefined)
  );

  const payload: Record<string, unknown> = {
    ownerUid,
    name,
    category,
    profileImageRef,
    location: cleanLocation,  // Use the cleaned location
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const sanitizedLinks = sanitizeLinks(links);
  if (sanitizedLinks) {
    payload.links = sanitizedLinks;
  }

  await setDoc(doc(db, "acts", ownerUid), payload);

  // Set hasActProfile flag on user document
  const userDocRef = doc(db, "users", ownerUid);
  await setDoc(userDocRef, { hasActProfile: true }, { merge: true });

  return ownerUid;
};

// ...existing code...

export const getActProfileById = async (actUid: string): Promise<ActProfile> => {
  const actDocRef = doc(db, "acts", actUid);
  const actSnap = await getDoc(actDocRef);
  if (!actSnap.exists()) {
    throw new Error("Act profile not found.");
  }

  return mapActSnapshot(actSnap.id, actSnap.data());
};
