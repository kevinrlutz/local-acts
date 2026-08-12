import type { UserLocationPayload } from "@/src/services/userProfile";

export type ActCategory = "Musician" | "Comedian" | "Other";

export type ActSocialLinks = {
  spotify?: string;
  appleMusic?: string;
  instagram?: string;
};

export type ActProfile = {
  id: string;
  ownerUid: string;
  name: string;
  category: ActCategory;
  profileImageRef: string;
  eventUids?: string[];
  description?: string | null;
  links?: ActSocialLinks | null;
  location: UserLocationPayload;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type ActEvent = {
  id: string;
  /** Correlates this event to its act. Events live in their own top-level
   *  Firestore collection, not a sub-collection of `acts`. */
  actUid: string;
  actCategory: ActCategory;
  title: string;
  description?: string | null;
  location?: string | null;
  ticketLink?: string | null;
  eventDate: Date;
  hasTime?: boolean;
  /** Mapbox `mapbox_id` of the linked venue, if any. Only the id is ever
   *  persisted — never the rest of a Mapbox response (see venues brief). */
  venueMapboxId?: string | null;
  venueCoordinates?: { latitude: number; longitude: number } | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type CreateActEventPayload = {
  title: string;
  actCategory: ActCategory;
  description?: string;
  location?: string;
  ticketLink?: string;
  /** Combined date and optional time as a Date object. */
  eventDate: Date;
  hasTime?: boolean;
  venueMapboxId?: string | null;
  venueCoordinates?: { latitude: number; longitude: number } | null;
};

export type CreateActProfilePayload = {
  ownerUid: string;
  name: string;
  category: ActCategory;
  profileImageRef: string;
  description?: string | null;
  links?: ActSocialLinks;
  location: UserLocationPayload;
};
