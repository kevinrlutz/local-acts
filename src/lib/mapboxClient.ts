import { createRateLimiter } from "@/src/lib/rateLimiter";

export class MapboxApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "MapboxApiError";
    this.status = status;
  }
}

export const assertMapboxToken = (): string => {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    throw new MapboxApiError(
      "Missing Mapbox token. Provide EXPO_PUBLIC_MAPBOX_TOKEN via app config."
    );
  }
  return token;
};

// Mapbox default rate limits (see searchbox.md / places.md "restrictions and
// limits" sections). Search Box's 10 req/s limit is shared across /suggest,
// /retrieve, /category, and /list/category, so a single limiter instance
// throttles all of them together. Places' limit is separate and higher.
export const SEARCH_BOX_RATE_LIMIT_PER_SECOND = 10;
export const PLACES_RATE_LIMIT_PER_SECOND = 100;

export const searchBoxRateLimiter = createRateLimiter(
  SEARCH_BOX_RATE_LIMIT_PER_SECOND
);
export const placesRateLimiter = createRateLimiter(PLACES_RATE_LIMIT_PER_SECOND);

export const SEARCH_BOX_BASE_URL = "https://api.mapbox.com/search/searchbox/v1";
export const PLACES_BASE_URL = "https://api.mapbox.com/places/v1";
