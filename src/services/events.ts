import {
    addDoc,
    collection,
    deleteDoc,
    deleteField,
    doc,
    DocumentData,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import type { ActEvent, CreateActEventPayload } from "@/src/types/acts";

// Events are a top-level collection (not a sub-collection of `acts`),
// correlated back to an act via `actUid` and to a venue via `venueMapboxId`.
// Only `venueMapboxId` is ever stored for the venue side — never any of the
// Mapbox response data itself (name/address/hours/etc).
//
// NOTE: querying by `actUid` (+ orderBy eventDate) and by `venueMapboxId`
// (+ eventDate range, + orderBy eventDate) each require a Firestore
// composite index. Firestore will log a console link to create them the
// first time each query runs against a fresh project.
const EVENTS_COLLECTION = "events";

const toDateOrNull = (value: unknown) => (value instanceof Timestamp ? value.toDate() : null);

const mapEventSnapshot = (id: string, data: DocumentData): ActEvent => ({
  id,
  actUid: data.actUid as string,
  title: data.title as string,
  description: (data.description as string | undefined) ?? null,
  location: (data.location as string | undefined) ?? null,
  ticketLink: (data.ticketLink as string | undefined) ?? null,
  eventDate: toDateOrNull(data.eventDate) ?? new Date(),
  hasTime: Boolean(data.hasTime),
  venueMapboxId: (data.venueMapboxId as string | undefined) ?? null,
  createdAt: toDateOrNull(data.createdAt),
  updatedAt: toDateOrNull(data.updatedAt),
});

export const getEventsForAct = async (actUid: string): Promise<ActEvent[]> => {
  const eventsQuery = query(
    collection(db, EVENTS_COLLECTION),
    where("actUid", "==", actUid),
    orderBy("eventDate", "asc")
  );
  const snapshot = await getDocs(eventsQuery);
  return snapshot.docs.map((d) => mapEventSnapshot(d.id, d.data()));
};

export const getEventById = async (eventId: string): Promise<ActEvent> => {
  const eventSnap = await getDoc(doc(db, EVENTS_COLLECTION, eventId));
  if (!eventSnap.exists()) {
    throw new Error("Event not found.");
  }
  return mapEventSnapshot(eventSnap.id, eventSnap.data());
};

export const createEvent = async (
  actUid: string,
  payload: CreateActEventPayload
): Promise<string> => {
  const trimmedTitle = payload.title.trim();
  if (!trimmedTitle) {
    throw new Error("Event title is required.");
  }

  const eventPayload: Record<string, unknown> = {
    actUid,
    title: trimmedTitle,
    eventDate: Timestamp.fromDate(payload.eventDate),
    hasTime: Boolean(payload.hasTime),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const trimmedDescription = payload.description?.trim();
  if (trimmedDescription) {
    eventPayload.description = trimmedDescription;
  }

  const trimmedLocation = payload.location?.trim();
  if (trimmedLocation) {
    eventPayload.location = trimmedLocation;
  }

  const trimmedTicketLink = payload.ticketLink?.trim();
  if (trimmedTicketLink) {
    eventPayload.ticketLink = trimmedTicketLink;
  }

  if (payload.venueMapboxId) {
    eventPayload.venueMapboxId = payload.venueMapboxId;
  }

  const docRef = await addDoc(collection(db, EVENTS_COLLECTION), eventPayload);
  return docRef.id;
};

export const updateEvent = async (
  eventId: string,
  payload: CreateActEventPayload
): Promise<void> => {
  const trimmedTitle = payload.title.trim();
  if (!trimmedTitle) {
    throw new Error("Event title is required.");
  }

  const updatePayload: Record<string, unknown> = {
    title: trimmedTitle,
    eventDate: Timestamp.fromDate(payload.eventDate),
    hasTime: Boolean(payload.hasTime),
    updatedAt: serverTimestamp(),
  };

  const trimmedDescription = payload.description?.trim();
  updatePayload.description = trimmedDescription ? trimmedDescription : deleteField();

  const trimmedLocation = payload.location?.trim();
  updatePayload.location = trimmedLocation ? trimmedLocation : deleteField();

  const trimmedTicketLink = payload.ticketLink?.trim();
  updatePayload.ticketLink = trimmedTicketLink ? trimmedTicketLink : deleteField();

  updatePayload.venueMapboxId = payload.venueMapboxId ?? deleteField();

  await updateDoc(doc(db, EVENTS_COLLECTION, eventId), updatePayload);
};

export const deleteEvent = async (eventId: string): Promise<void> => {
  await deleteDoc(doc(db, EVENTS_COLLECTION, eventId));
};

export const deleteEventsForAct = async (actUid: string): Promise<void> => {
  const eventsQuery = query(collection(db, EVENTS_COLLECTION), where("actUid", "==", actUid));
  const snapshot = await getDocs(eventsQuery);
  await Promise.all(snapshot.docs.map((d) => deleteDoc(d.ref)));
};

/** Upcoming (future) events at a given Mapbox venue. Entirely internal data
 *  — no Mapbox call involved. Used by the venue profile page. */
export const getUpcomingEventsForVenue = async (
  venueMapboxId: string
): Promise<ActEvent[]> => {
  const now = Timestamp.fromDate(new Date());
  const eventsQuery = query(
    collection(db, EVENTS_COLLECTION),
    where("venueMapboxId", "==", venueMapboxId),
    where("eventDate", ">=", now),
    orderBy("eventDate", "asc")
  );
  const snapshot = await getDocs(eventsQuery);
  return snapshot.docs.map((d) => mapEventSnapshot(d.id, d.data()));
};
