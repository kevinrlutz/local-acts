import {
  arrayRemove,
  arrayUnion,
  collection,
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
  writeBatch,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import type { ActEvent, CreateActEventPayload } from "@/src/types/acts";

// Events are a top-level collection (not a sub-collection of `acts`),
// correlated back to an act via `actUid` and to a venue via `venueMapboxId`.
// The venue ID and coordinates are stored; Mapbox display data such as
// name/address/hours is never persisted.
//
// NOTE: querying by `actUid` (+ orderBy eventDate) and by `venueMapboxId`
// (+ eventDate range, + orderBy eventDate) each require a Firestore composite
// index. The map uses the automatic eventDate index, then applies its exact
// latitude/longitude boundary check locally so it remains available before a
// composite map index has been deployed.
const EVENTS_COLLECTION = "events";

const toDateOrNull = (value: unknown) => (value instanceof Timestamp ? value.toDate() : null);

const mapEventSnapshot = (id: string, data: DocumentData): ActEvent => ({
  id,
  actUid: data.actUid as string,
  actCategory: data.actCategory as ActEvent["actCategory"],
  title: data.title as string,
  description: (data.description as string | undefined) ?? null,
  location: (data.location as string | undefined) ?? null,
  ticketLink: (data.ticketLink as string | undefined) ?? null,
  eventDate: toDateOrNull(data.eventDate) ?? new Date(),
  hasTime: Boolean(data.hasTime),
  venueMapboxId: (data.venueMapboxId as string | undefined) ?? null,
  venueCoordinates: (data.venueCoordinates as { latitude: number; longitude: number } | undefined) ?? null,
  createdAt: toDateOrNull(data.createdAt),
  updatedAt: toDateOrNull(data.updatedAt),
});

export const getEventsForAct = async (
  actUid: string,
  eventUids: string[] = []
): Promise<ActEvent[]> => {
  const eventSnapshots = await Promise.all(
    eventUids.map((eventUid) => getDoc(doc(db, EVENTS_COLLECTION, eventUid)))
  );
  const now = new Date();
  return eventSnapshots
    .filter((snapshot) => snapshot.exists())
    .map((snapshot) => mapEventSnapshot(snapshot.id, snapshot.data()))
    .filter((event) => event.actUid === actUid && event.eventDate >= now)
    .sort((first, second) => first.eventDate.getTime() - second.eventDate.getTime());
};

export const getEventById = async (eventId: string): Promise<ActEvent> => {
  const eventSnap = await getDoc(doc(db, EVENTS_COLLECTION, eventId));
  if (!eventSnap.exists()) {
    throw new Error("Event not found.");
  }
  return mapEventSnapshot(eventSnap.id, eventSnap.data());
};

export type EventLocationBounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
};

const isWithinLocationBounds = (event: ActEvent, bounds: EventLocationBounds) => {
  const coordinates = event.venueCoordinates;
  return Boolean(
    coordinates &&
      coordinates.latitude >= bounds.minLatitude &&
      coordinates.latitude <= bounds.maxLatitude &&
      coordinates.longitude >= bounds.minLongitude &&
      coordinates.longitude <= bounds.maxLongitude
  );
};

const getDateRangeEvents = async (startDate: Date, endDate: Date): Promise<ActEvent[]> => {
  const eventsQuery = query(
    collection(db, EVENTS_COLLECTION),
    where("eventDate", ">=", Timestamp.fromDate(startDate)),
    where("eventDate", "<=", Timestamp.fromDate(endDate)),
    orderBy("eventDate", "asc")
  );
  const snapshot = await getDocs(eventsQuery);
  return snapshot.docs.map((eventDoc) => mapEventSnapshot(eventDoc.id, eventDoc.data()));
};

export const getEventsWithinLocationBounds = async (
  bounds: EventLocationBounds,
  startDate: Date,
  endDate: Date
): Promise<ActEvent[]> => {
  const dateRangeEvents = await getDateRangeEvents(startDate, endDate);
  return dateRangeEvents.filter((event) => isWithinLocationBounds(event, bounds));
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
    actCategory: payload.actCategory,
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
  if (payload.venueCoordinates) {
    eventPayload.venueCoordinates = payload.venueCoordinates;
  }

  const eventRef = doc(collection(db, EVENTS_COLLECTION));
  const eventWriteBatch = writeBatch(db);
  eventWriteBatch.set(eventRef, eventPayload);
  eventWriteBatch.update(doc(db, "acts", actUid), { eventUids: arrayUnion(eventRef.id) });
  await eventWriteBatch.commit();
  return eventRef.id;
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
  updatePayload.venueCoordinates = payload.venueCoordinates ?? deleteField();

  await updateDoc(doc(db, EVENTS_COLLECTION, eventId), updatePayload);
};

export const deleteEvent = async (eventId: string): Promise<void> => {
  const event = await getEventById(eventId);
  const eventWriteBatch = writeBatch(db);
  eventWriteBatch.delete(doc(db, EVENTS_COLLECTION, eventId));
  eventWriteBatch.update(doc(db, "acts", event.actUid), { eventUids: arrayRemove(eventId) });
  await eventWriteBatch.commit();
};

export const deleteEventsForAct = async (actUid: string): Promise<void> => {
  const eventsQuery = query(collection(db, EVENTS_COLLECTION), where("actUid", "==", actUid));
  const snapshot = await getDocs(eventsQuery);
  const eventWriteBatch = writeBatch(db);
  snapshot.docs.forEach((eventDoc) => eventWriteBatch.delete(eventDoc.ref));
  eventWriteBatch.update(doc(db, "acts", actUid), { eventUids: [] });
  await eventWriteBatch.commit();
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
