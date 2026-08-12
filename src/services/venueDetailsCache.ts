import {
  MapboxApiError,
  PLACES_BASE_URL,
  assertMapboxToken,
  placesRateLimiter,
} from "@/src/lib/mapboxClient";
import type { VenueDetails } from "@/src/types/venues";

// -----------------------------------------------------------------------
// Venue-details cache: the SINGLE entry point for every Places
// `/details/retrieve` call in the app. That's deliberate — it's the
// natural place to bolt on quota tracking/instrumentation later without
// touching call sites (see venues brief, section 5).
//
// Cache key convention: `venue_details:{mapbox_id}` (matches the brief even
// though this is an in-memory Map today, not Redis — see note below).
//
// Stampede protection:
//  - Process-level: concurrent callers for the same mapbox_id share one
//    in-flight fetch via `inFlight`, rather than each hitting Mapbox.
//  - Cross-instance: this app is a client-only Expo bundle with no
//    backend/server, so there is no real "cross-instance" to protect
//    against — each device is its own isolated process with no shared
//    memory or shared cache across users. A distributed lock (Redis
//    `SET NX EX`) only makes sense once a backend/proxy exists. If one is
//    introduced later, add `acquireDistributedLock`/`releaseDistributedLock`
//    calls around `fetchFromPlaces` below (poll the cache with a timeout
//    while waiting on the lock, fall back to fetching directly if the poll
//    times out) — the rest of this module's shape doesn't need to change.
//
// Cache successful lookups for VENUE_DETAILS_TTL_MS (default 24h — a
// testing-phase value, expected to be revisited before go-live). 404s are
// cached separately under VENUE_NOT_FOUND_TTL_MS so a delisted venue
// doesn't repeatedly burn quota. Transient errors (429/5xx) are never
// cached — the next request simply retries.
// -----------------------------------------------------------------------

const VENUE_DETAILS_TTL_MS = 24 * 60 * 60 * 1000;
const VENUE_NOT_FOUND_TTL_MS = 60 * 60 * 1000;

export class VenueNotFoundError extends Error {
  constructor(mapboxId: string) {
    super(`Venue ${mapboxId} was not found.`);
    this.name = "VenueNotFoundError";
  }
}

export class VenueDetailsFetchError extends MapboxApiError {}

type CacheEntry =
  | { kind: "found"; data: VenueDetails; expiresAt: number }
  | { kind: "not-found"; expiresAt: number };

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<VenueDetails>>();

const cacheKey = (mapboxId: string) => `venue_details:${mapboxId}`;

const isCacheValid = (entry: CacheEntry | undefined): entry is CacheEntry =>
  !!entry && entry.expiresAt > Date.now();

const mapPlacesResponseToVenueDetails = (
  mapboxId: string,
  raw: Record<string, any>
): VenueDetails => {
  const [longitude, latitude] = raw.geometry?.coordinates ?? [];
  return {
    mapboxId,
    name: raw.name,
    primaryCategory: formatCategoryName(raw.primary_category) ?? null,
    categories: Array.isArray(raw.categories) ? raw.categories.map(formatCategoryName) : [],
    openingHours: raw.opening_hours ?? null,
    popularityScore:
      typeof raw.score?.popularity === "number" ? raw.score.popularity : null,
    permanentlyClosed:
      typeof raw.permanently_closed === "boolean" ? raw.permanently_closed : null,
    coordinates:
      typeof latitude === "number" && typeof longitude === "number"
        ? { latitude, longitude }
        : null,
  };
};

const fetchFromPlaces = async (mapboxId: string): Promise<VenueDetails> => {
  const token = assertMapboxToken();
  const url = `${PLACES_BASE_URL}/details/retrieve/${encodeURIComponent(mapboxId)}?access_token=${token}`;
  const response = await placesRateLimiter.schedule(() => fetch(url));

  if (response.status === 404) {
    cache.set(cacheKey(mapboxId), {
      kind: "not-found",
      expiresAt: Date.now() + VENUE_NOT_FOUND_TTL_MS,
    });
    throw new VenueNotFoundError(mapboxId);
  }

  if (!response.ok) {
    // Transient (429/5xx) — do NOT cache; let the next request retry.
    throw new VenueDetailsFetchError(
      `Places details request failed (${response.status}).`,
      response.status
    );
  }

  const raw = await response.json();
  const details = mapPlacesResponseToVenueDetails(mapboxId, raw);
  cache.set(cacheKey(mapboxId), {
    kind: "found",
    data: details,
    expiresAt: Date.now() + VENUE_DETAILS_TTL_MS,
  });
  return details;
};

export const formatCategoryName = (name: string): string => {
    // Mapbox returns some category names in all caps (e.g. "RESTAURANT") and
    // some in title case (e.g. "Coffee Shop"). Normalize to title case for
    // display in the app.
    if (!name) {
        return "Venue"; // Fallback for empty/undefined names
    }

    return name
        .toLowerCase()
        .split(/[\s_]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/** Cache-aside + stampede-protected fetch of venue details for a single
 *  mapbox_id. Throws `VenueNotFoundError` for cached/live 404s, or
 *  `VenueDetailsFetchError` for transient failures (safe to retry). */
export const getVenueDetails = async (mapboxId: string): Promise<VenueDetails> => {
  const key = cacheKey(mapboxId);
  const cached = cache.get(key);
  if (isCacheValid(cached)) {
    if (cached.kind === "not-found") {
      throw new VenueNotFoundError(mapboxId);
    }
    return cached.data;
  }

  const existing = inFlight.get(mapboxId);
  if (existing) {
    return existing;
  }

  const promise = fetchFromPlaces(mapboxId).finally(() => {
    inFlight.delete(mapboxId);
  });
  inFlight.set(mapboxId, promise);
  return promise;
};
