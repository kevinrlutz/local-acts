import {
    collection,
    deleteDoc,
    doc,
    DocumentData,
    getDoc,
    getDocs,
    serverTimestamp,
    setDoc,
    Timestamp,
} from "firebase/firestore";

import { db } from "@/src/lib/firebase";
import type {
    CreateVenueProfilePayload,
    DayHours,
    VenuePickerItem,
    VenueProfile,
    WeeklyHours
} from "@/src/types/venues";

const toDateOrNull = (value: unknown) =>
  value instanceof Timestamp ? value.toDate() : null;

const mapDayHours = (raw: unknown): DayHours => {
  if (!raw || typeof raw !== "object") {
    return { closed: false, open: null, close: null };
  }
  const r = raw as Record<string, unknown>;
  return {
    closed: Boolean(r.closed),
    open: typeof r.open === "string" ? r.open : null,
    close: typeof r.close === "string" ? r.close : null,
  };
};

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const mapWeeklyHours = (raw: unknown): WeeklyHours => {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  return {
    monday: mapDayHours(r.monday),
    tuesday: mapDayHours(r.tuesday),
    wednesday: mapDayHours(r.wednesday),
    thursday: mapDayHours(r.thursday),
    friday: mapDayHours(r.friday),
    saturday: mapDayHours(r.saturday),
    sunday: mapDayHours(r.sunday),
  };
};

const mapVenueSnapshot = (id: string, data: DocumentData): VenueProfile => ({
  id,
  ownerUid: (data.ownerUid as string) ?? id,
  name: data.name as string,
  category: data.category as VenueProfile["category"],
  address: data.address as string,
  city: data.city as string,
  state: data.state as string,
  zip: data.zip as string,
  formattedAddress: data.formattedAddress as string,
  coordinates: data.coordinates as VenueProfile["coordinates"],
  hours: mapWeeklyHours(data.hours),
  profileImageRef: (data.profileImageRef as string | undefined) ?? null,
  createdAt: toDateOrNull(data.createdAt),
  updatedAt: toDateOrNull(data.updatedAt),
});

export const getAllVenues = async (): Promise<VenueProfile[]> => {
  const snapshot = await getDocs(collection(db, "venues"));
  return snapshot.docs.map((d) => mapVenueSnapshot(d.id, d.data()));
};

export const getVenueProfileById = async (
  venueId: string
): Promise<VenueProfile> => {
  const docRef = doc(db, "venues", venueId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error("Venue profile not found.");
  }
  return mapVenueSnapshot(docSnap.id, docSnap.data());
};

export const createVenueProfile = async (
  payload: CreateVenueProfilePayload
): Promise<string> => {
  const {
    ownerUid,
    name,
    category,
    address,
    city,
    state,
    zip,
    formattedAddress,
    coordinates,
    hours,
    profileImageRef,
  } = payload;

  const data: Record<string, unknown> = {
    ownerUid,
    name: name.trim(),
    category,
    address: address.trim(),
    city: city.trim(),
    state: state.trim(),
    zip: zip.trim(),
    formattedAddress: formattedAddress.trim(),
    coordinates,
    hours,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (profileImageRef) {
    data.profileImageRef = profileImageRef;
  }

  await setDoc(doc(db, "venues", ownerUid), data);

  const userDocRef = doc(db, "users", ownerUid);
  await setDoc(userDocRef, { hasVenueProfile: true }, { merge: true });

  return ownerUid;
};

export const updateVenueProfile = async ({
  venueId,
  name,
  category,
  address,
  city,
  state,
  zip,
  formattedAddress,
  coordinates,
  hours,
  profileImageRef,
}: {
  venueId: string;
  name: string;
  category: VenueProfile["category"];
  address: string;
  city: string;
  state: string;
  zip: string;
  formattedAddress: string;
  coordinates: VenueProfile["coordinates"];
  hours: WeeklyHours;
  profileImageRef?: string | null;
}): Promise<string> => {
  const data: Record<string, unknown> = {
    name: name.trim(),
    category,
    address: address.trim(),
    city: city.trim(),
    state: state.trim(),
    zip: zip.trim(),
    formattedAddress: formattedAddress.trim(),
    coordinates,
    hours,
    updatedAt: serverTimestamp(),
  };

  if (profileImageRef !== undefined) {
    data.profileImageRef = profileImageRef ?? null;
  }

  await setDoc(doc(db, "venues", venueId), data, { merge: true });
  return venueId;
};

export const deleteVenueProfile = async (venueId: string): Promise<void> => {
  await deleteDoc(doc(db, "venues", venueId));

  const userDocRef = doc(db, "users", venueId);
  await setDoc(userDocRef, { hasVenueProfile: false }, { merge: true });
};

export const getVenuesForEventPicker = async (): Promise<VenuePickerItem[]> => {
  const snapshot = await getDocs(collection(db, "venues"));
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name as string,
      address: data.address as string,
      city: data.city as string,
      state: data.state as string,
    };
  });
};
