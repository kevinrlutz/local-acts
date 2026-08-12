/**
 * Venues are Mapbox Places/Search Box data, not app-owned profiles.
 *
 * Hard constraint (see venues feature brief): only `mapbox_id` may ever be
 * persisted to the primary database (e.g. as `Event.venueMapboxId`). Every
 * other field below (name, category, hours, popularity, coordinates, etc.)
 * comes from a live Mapbox API response or a short-TTL cache in front of one
 * — never write these display fields to Firestore; event documents may store
 * the resolved venue coordinates alongside the Mapbox ID.
 */

/** A pin on the map, from a Search Box `/category/{id}` result. */
export type VenuePin = {
  mapboxId: string;
  name: string;
  /** First/primary POI category label returned for this result. */
  category: string;
  coordinates: { latitude: number; longitude: number };
};

/** Venue profile-page data, from a Places `/details/retrieve/{mapbox_id}` result. */
export type VenueDetails = {
  mapboxId: string;
  name: string;
  primaryCategory: string | null;
  categories: string[];
  /** Free-form opening hours string (opening_hours). May be absent. */
  openingHours: string | null;
  /** 0-1 popularity score (score.popularity). Null when unavailable. */
  popularityScore: number | null;
  permanentlyClosed: boolean | null;
  coordinates: { latitude: number; longitude: number } | null;
};

/** A single `/suggest` result, shown while the user is typing. */
export type VenueSuggestion = {
  mapboxId: string;
  name: string;
  fullAddress: string | null;
  placeFormatted: string | null;
};

/** A resolved `/retrieve` result, used to confirm a selection to the user. */
export type VenueSearchResult = {
  mapboxId: string;
  name: string;
  fullAddress: string | null;
  coordinates: { latitude: number; longitude: number } | null;
};
