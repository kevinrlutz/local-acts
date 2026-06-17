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
  description?: string | null;
  links?: ActSocialLinks | null;
  location: UserLocationPayload;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type ActEvent = {
  id: string;
  actId: string;
  title: string;
  description?: string | null;
  location?: string | null;
  ticketLink?: string | null;
  eventDate: Date;
  hasTime?: boolean;
  venueId?: string | null;
  venueName?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type CreateActEventPayload = {
  title: string;
  description?: string;
  location?: string;
  ticketLink?: string;
  /** Combined date and optional time as a Date object. */
  eventDate: Date;
  hasTime?: boolean;
  venueId?: string | null;
  venueName?: string | null;
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
