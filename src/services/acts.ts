import { addDoc, collection, deleteDoc, deleteField, doc, DocumentData, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import type { UserLocationPayload } from "@/src/services/userProfile";
import type { ActEvent, ActProfile, ActSocialLinks, CreateActEventPayload, CreateActProfilePayload } from "@/src/types/acts";

const sanitizeLinks = (links?: ActSocialLinks) => {
  if (!links) {
    return undefined;
  }
  const entries = Object.entries(links)
    .map(([key, value]) => [key, value?.trim() ?? ""] as const);
  if (!entries.length) {
    return undefined;
  }
  return Object.fromEntries(entries) as ActSocialLinks;
};

const DESCRIPTION_MAX_LENGTH = 250;

const normalizeDescription = (description?: string | null) => {
  const trimmed = description?.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length > DESCRIPTION_MAX_LENGTH ? trimmed.slice(0, DESCRIPTION_MAX_LENGTH) : trimmed;
};

// ...existing code...

const toDateOrNull = (value: unknown) => (value instanceof Timestamp ? value.toDate() : null);

const mapEventSnapshot = (actId: string, eventId: string, data: DocumentData): ActEvent => ({
  id: eventId,
  actId,
  title: data.title as string,
  description: (data.description as string | undefined) ?? null,
  location: (data.location as string | undefined) ?? null,
  ticketLink: (data.ticketLink as string | undefined) ?? null,
  eventDate: toDateOrNull(data.eventDate) ?? new Date(),
  hasTime: Boolean(data.hasTime),
  createdAt: toDateOrNull(data.createdAt),
  updatedAt: toDateOrNull(data.updatedAt),
});

const mapActSnapshot = (id: string, data: DocumentData): ActProfile => ({
  id,
  ownerUid: (data.ownerUid as string) ?? id,
  name: data.name as string,
  category: data.category as ActProfile["category"],
  profileImageRef: data.profileImageRef as string,
  description: (data.description as string | undefined) ?? null,
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
  description,
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

  const normalizedDescription = normalizeDescription(description);
  if (normalizedDescription) {
    payload.description = normalizedDescription;
  }

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

export const updateActProfile = async ({
  actId,
  name,
  category,
  profileImageRef,
  description,
  links,
  location,
}: {
  actId: string;
  name: string;
  category: ActProfile["category"];
  profileImageRef: string;
  description?: string | null;
  links?: ActSocialLinks;
  location: UserLocationPayload;
}) => {
  // Sanitize the location object to remove undefined fields
  const cleanLocation = Object.fromEntries(
    Object.entries(location).filter(([_, value]) => value !== undefined)
  );

  const payload: Record<string, unknown> = {
    name,
    category,
    profileImageRef,
    location: cleanLocation,
    updatedAt: serverTimestamp(),
  };

  if (description !== undefined) {
    const normalizedDescription = normalizeDescription(description);
    payload.description = normalizedDescription ?? deleteField();
  }

  const sanitizedLinks = sanitizeLinks(links);

  if (sanitizedLinks) {
    Object.keys(sanitizedLinks).forEach((key) => {
      const value = sanitizedLinks[key as keyof ActSocialLinks];
      if (value === "" || value === undefined) {
        sanitizedLinks[key as keyof ActSocialLinks] = deleteField() as any;
      }
    });

    payload.links = sanitizedLinks;
  }

  await setDoc(doc(db, "acts", actId), payload, { merge: true });

  return actId;
};

export const getActEvents = async (actId: string): Promise<ActEvent[]> => {
  const eventsQuery = query(
    collection(doc(db, "acts", actId), "events"),
    orderBy("eventDate", "asc")
  );
  const eventsSnapshot = await getDocs(eventsQuery);

  return eventsSnapshot.docs.map((docSnap) => mapEventSnapshot(actId, docSnap.id, docSnap.data()));
};

export const getActEventById = async (actId: string, eventId: string): Promise<ActEvent> => {
  const eventRef = doc(db, "acts", actId, "events", eventId);
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) {
    throw new Error("Event not found.");
  }
  return mapEventSnapshot(actId, eventSnap.id, eventSnap.data());
};

export const createActEvent = async (actId: string, payload: CreateActEventPayload): Promise<string> => {
  const { title, description, location, ticketLink, eventDate, hasTime } = payload;

  const eventCollectionRef = collection(doc(db, "acts", actId), "events");
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("Event title is required.");
  }

  const eventPayload: Record<string, unknown> = {
    title: trimmedTitle,
    actId,
    ownerUid: actId,
    eventDate: Timestamp.fromDate(eventDate),
    hasTime: Boolean(hasTime),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const trimmedDescription = description?.trim();
  if (trimmedDescription) {
    eventPayload.description = trimmedDescription;
  }

  const trimmedLocation = location?.trim();
  if (trimmedLocation) {
    eventPayload.location = trimmedLocation;
  }

  const trimmedTicketLink = ticketLink?.trim();
  if (trimmedTicketLink) {
    eventPayload.ticketLink = trimmedTicketLink;
  }

  const docRef = await addDoc(eventCollectionRef, eventPayload);
  return docRef.id;
};

export const updateActEvent = async (actId: string, eventId: string, payload: CreateActEventPayload) => {
  const { title, description, location, ticketLink, eventDate, hasTime } = payload;
  const trimmedTitle = title.trim();
  if (!trimmedTitle) {
    throw new Error("Event title is required.");
  }

  const eventRef = doc(db, "acts", actId, "events", eventId);
  const updatePayload: Record<string, unknown> = {
    title: trimmedTitle,
    eventDate: Timestamp.fromDate(eventDate),
    hasTime: Boolean(hasTime),
    updatedAt: serverTimestamp(),
  };

  const trimmedDescription = description?.trim();
  updatePayload.description = trimmedDescription ? trimmedDescription : deleteField();

  const trimmedLocation = location?.trim();
  updatePayload.location = trimmedLocation ? trimmedLocation : deleteField();

  const trimmedTicketLink = ticketLink?.trim();
  updatePayload.ticketLink = trimmedTicketLink ? trimmedTicketLink : deleteField();

  await updateDoc(eventRef, updatePayload);
};

export const deleteActEvent = async (actId: string, eventId: string) => {
  await deleteDoc(doc(db, "acts", actId, "events", eventId));
};

export const deleteActProfile = async (actId: string) => {
  const eventsCollectionRef = collection(doc(db, "acts", actId), "events");
  const eventsSnapshot = await getDocs(eventsCollectionRef);

  await Promise.all(eventsSnapshot.docs.map((eventDoc) => deleteDoc(eventDoc.ref)));

  await deleteDoc(doc(db, "acts", actId));

  // Remove hasActProfile flag from user document
  const userDocRef = doc(db, "users", actId);
  await setDoc(userDocRef, { hasActProfile: false }, { merge: true });
};
