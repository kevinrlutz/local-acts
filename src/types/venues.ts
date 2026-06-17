export type VenueCategory =
  | "Bar / Club"
  | "Concert Hall"
  | "Theater"
  | "Restaurant"
  | "Other";

export type DayHours = {
  closed: boolean;
  /** Opening time in HH:MM 24-hour format. Null when closed. */
  open: string | null;
  /** Closing time in HH:MM 24-hour format. Null when closed.
   *  A close time numerically less than open time implies crossing midnight
   *  (e.g. open "20:00", close "02:00" = 8 PM – 2 AM). */
  close: string | null;
};

export type WeeklyHours = {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
};

export const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export const DEFAULT_WEEKLY_HOURS: WeeklyHours = {
  monday: { closed: false, open: null, close: null },
  tuesday: { closed: false, open: null, close: null },
  wednesday: { closed: false, open: null, close: null },
  thursday: { closed: false, open: null, close: null },
  friday: { closed: false, open: null, close: null },
  saturday: { closed: false, open: null, close: null },
  sunday: { closed: false, open: null, close: null },
};

export type VenueProfile = {
  id: string;
  ownerUid: string;
  name: string;
  categories: VenueCategory[];
  address: string;
  city: string;
  state: string;
  zip: string;
  formattedAddress: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  hours: WeeklyHours;
  profileImageRef?: string | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type CreateVenueProfilePayload = {
  ownerUid: string;
  name: string;
  categories: VenueCategory[];
  address: string;
  city: string;
  state: string;
  zip: string;
  formattedAddress: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  hours: WeeklyHours;
  profileImageRef?: string | null;
};

export type VenuePickerItem = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
};
