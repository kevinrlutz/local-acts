import {
    MapboxApiError,
    SEARCH_BOX_BASE_URL,
    assertMapboxToken,
    searchBoxRateLimiter,
} from "@/src/lib/mapboxClient";
import type { VenuePin } from "@/src/types/venues";

// -----------------------------------------------------------------------
// Category-search service: powers map pins via Search Box `/category/{id}`.
//
// Flow: bbox resolution -> canonical category id resolution (cached, from a
// live `/list/category` call) -> one `/category/{id}` call per category ->
// subdivide-on-truncation (since `/category` caps results at 25 with no
// pagination) -> dedupe by mapbox_id. All Mapbox calls go through the shared
// `searchBoxRateLimiter`, which keeps total throughput under the 10 req/s
// default limit even during subdivision fan-out.
//
// Pin lists are transient by design — nothing here is ever written to the
// primary database. The small in-memory `resultCache` below just avoids
// refetching identical bbox+category queries on rapid map pans/reloads.
// -----------------------------------------------------------------------

export type BoundingBox = {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
};

/** The venue types this feature covers. Keys are stable identifiers used
 *  throughout this module; values are patterns matched against the live
 *  `/list/category` response so we never hardcode/guess canonical IDs. */
export type VenueTypeKey = "bar" | "nightclub" | "concertHall";

const VENUE_TYPE_MATCHERS: Record<VenueTypeKey, RegExp> = {
  bar: /^bar$/i,
  nightclub: /night.?club/i,
  concertHall: /concert.?hall|music.?venue/i,
};

// --- bbox helpers --------------------------------------------------------

const MILES_PER_DEGREE_LAT = 69.0;

export const bboxFromCenter = (
  latitude: number,
  longitude: number,
  radiusMiles: number
): BoundingBox => {
  const latDelta = radiusMiles / MILES_PER_DEGREE_LAT;
  const milesPerDegreeLon = MILES_PER_DEGREE_LAT * Math.cos((latitude * Math.PI) / 180);
  const lonDelta = radiusMiles / Math.max(milesPerDegreeLon, 1e-6);
  return {
    minLon: longitude - lonDelta,
    minLat: latitude - latDelta,
    maxLon: longitude + lonDelta,
    maxLat: latitude + latDelta,
  };
};

const bboxToParam = (bbox: BoundingBox) =>
  `${bbox.minLon},${bbox.minLat},${bbox.maxLon},${bbox.maxLat}`;

const subdivideBbox = (bbox: BoundingBox): BoundingBox[] => {
  const midLon = (bbox.minLon + bbox.maxLon) / 2;
  const midLat = (bbox.minLat + bbox.maxLat) / 2;
  return [
    { minLon: bbox.minLon, minLat: bbox.minLat, maxLon: midLon, maxLat: midLat },
    { minLon: midLon, minLat: bbox.minLat, maxLon: bbox.maxLon, maxLat: midLat },
    { minLon: bbox.minLon, minLat: midLat, maxLon: midLon, maxLat: bbox.maxLat },
    { minLon: midLon, minLat: midLat, maxLon: bbox.maxLon, maxLat: bbox.maxLat },
  ];
};

// --- canonical category id resolution (via /list/category) --------------

type CanonicalCategory = { canonicalId: string; name: string };

// The category list rarely changes, so it's safe (and recommended by the
// docs) to cache it for a long time rather than calling /list/category on
// every map load.
const CATEGORY_LIST_TTL_MS = 24 * 60 * 60 * 1000;
let categoryListCache: { items: CanonicalCategory[]; expiresAt: number } | null = null;
let resolvedCategoryIdsCache: Partial<Record<VenueTypeKey, string>> | null = null;

const fetchCategoryList = async (): Promise<CanonicalCategory[]> => {
  if (categoryListCache && categoryListCache.expiresAt > Date.now()) {
    return categoryListCache.items;
  }
  const token = assertMapboxToken();
  const url = `${SEARCH_BOX_BASE_URL}/list/category?language=en&access_token=${token}`;
  const response = await searchBoxRateLimiter.schedule(() => fetch(url));
  if (!response.ok) {
    throw new MapboxApiError(
      `Failed to load Mapbox category list (${response.status}).`,
      response.status
    );
  }
  const data = await response.json();
  const items: CanonicalCategory[] = (data.listItems ?? []).map(
    (item: { canonical_id: string; name: string }) => ({
      canonicalId: item.canonical_id,
      name: item.name,
    })
  );
  categoryListCache = { items, expiresAt: Date.now() + CATEGORY_LIST_TTL_MS };
  return items;
};

/** Resolves the canonical category ids for the venue types this feature
 *  covers, confirmed against a live `/list/category` call and cached. */
export const resolveVenueCategoryIds = async (): Promise<
  Partial<Record<VenueTypeKey, string>>
> => {
  if (resolvedCategoryIdsCache) {
    return resolvedCategoryIdsCache;
  }
  const list = await fetchCategoryList();
  const resolved: Partial<Record<VenueTypeKey, string>> = {};
  for (const key of Object.keys(VENUE_TYPE_MATCHERS) as VenueTypeKey[]) {
    const pattern = VENUE_TYPE_MATCHERS[key];
    const match = list.find(
      (item) => pattern.test(item.canonicalId) || pattern.test(item.name)
    );
    if (match) {
      resolved[key] = match.canonicalId;
    }
  }
  resolvedCategoryIdsCache = resolved;
  return resolved;
};

// --- /category/{id} search, with subdivide-on-truncation -----------------

/** Search Box `/category` hard cap — there is no pagination past this. */
const RESULT_LIMIT = 25;
/** Treat result counts at/near the cap as likely truncated. */
const TRUNCATION_THRESHOLD = 20;
/** Tunable cap on subdivision recursion so a dense downtown area can't
 *  trigger unbounded request fan-out. */
const MAX_SUBDIVISION_DEPTH = 2;

const RESULT_CACHE_TTL_MS = 60 * 1000;
const resultCache = new Map<string, { pins: VenuePin[]; expiresAt: number }>();

type CategoryFeature = {
  properties: { mapbox_id: string; name: string; poi_category?: string[] };
  geometry: { coordinates: [number, number] };
};

const mapFeatureToPin = (feature: CategoryFeature): VenuePin => ({
  mapboxId: feature.properties.mapbox_id,
  name: feature.properties.name,
  category: feature.properties.poi_category?.[0] ?? "Venue",
  coordinates: {
    longitude: feature.geometry.coordinates[0],
    latitude: feature.geometry.coordinates[1],
  },
});

const fetchCategoryPageRaw = async (
  categoryId: string,
  bbox: BoundingBox
): Promise<CategoryFeature[]> => {
  const token = assertMapboxToken();
  const params = new URLSearchParams({
    access_token: token,
    bbox: bboxToParam(bbox),
    limit: String(RESULT_LIMIT),
    exclude_fields: "photos,reviews",
  });
  const url = `${SEARCH_BOX_BASE_URL}/category/${encodeURIComponent(categoryId)}?${params.toString()}`;
  // No session_token here — /category is a stand-alone, per-request billed
  // endpoint, unlike /suggest + /retrieve.
  const response = await searchBoxRateLimiter.schedule(() => fetch(url));
  if (!response.ok) {
    throw new MapboxApiError(`Category search failed (${response.status}).`, response.status);
  }
  const data = await response.json();
  return (data.features ?? []) as CategoryFeature[];
};

const searchCategoryRecursive = async (
  categoryId: string,
  bbox: BoundingBox,
  depth: number
): Promise<VenuePin[]> => {
  const features = await fetchCategoryPageRaw(categoryId, bbox);

  if (features.length >= TRUNCATION_THRESHOLD && depth < MAX_SUBDIVISION_DEPTH) {
    const subBoxes = subdivideBbox(bbox);
    const nested = await Promise.all(
      subBoxes.map((box) => searchCategoryRecursive(categoryId, box, depth + 1))
    );
    return nested.flat();
  }

  return features.map(mapFeatureToPin);
};

const fetchCategoryPinsCached = async (
  categoryId: string,
  bbox: BoundingBox
): Promise<VenuePin[]> => {
  const cacheKey = `${categoryId}:${bboxToParam(bbox)}`;
  const cached = resultCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.pins;
  }
  const pins = await searchCategoryRecursive(categoryId, bbox, 0);
  resultCache.set(cacheKey, { pins, expiresAt: Date.now() + RESULT_CACHE_TTL_MS });
  return pins;
};

/** Given a center point + radius, returns a deduplicated list of venue pins
 *  across the requested venue types (defaults to all covered types). */
export const getVenuePinsForArea = async (params: {
  latitude: number;
  longitude: number;
  radiusMiles: number;
  venueTypes?: VenueTypeKey[];
}): Promise<VenuePin[]> => {
  const bbox = bboxFromCenter(params.latitude, params.longitude, params.radiusMiles);
  const categoryIds = await resolveVenueCategoryIds();
  const selectedKeys = params.venueTypes ?? (Object.keys(categoryIds) as VenueTypeKey[]);
  const ids = selectedKeys
    .map((key) => categoryIds[key])
    .filter((id): id is string => Boolean(id));

  const perCategoryResults = await Promise.all(
    ids.map((id) => fetchCategoryPinsCached(id, bbox))
  );

  const deduped = new Map<string, VenuePin>();
  for (const pins of perCategoryResults) {
    for (const pin of pins) {
      if (!deduped.has(pin.mapboxId)) {
        deduped.set(pin.mapboxId, pin);
      }
    }
  }
  return Array.from(deduped.values());
};
