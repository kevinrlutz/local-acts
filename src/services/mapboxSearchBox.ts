import {
    MapboxApiError,
    SEARCH_BOX_BASE_URL,
    assertMapboxToken,
    searchBoxRateLimiter,
} from "@/src/lib/mapboxClient";
import type { VenueSearchResult, VenueSuggestion } from "@/src/types/venues";

// Wraps Search Box `/suggest` + `/retrieve` for the Event form's venue
// picker. Both endpoints require a `session_token`; the caller is
// responsible for minting a fresh UUIDv4 per search session (see
// src/lib/uuid.ts) and reusing it across a /suggest...->/retrieve pair.

export const suggestVenues = async (
  query: string,
  sessionToken: string
): Promise<VenueSuggestion[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const token = assertMapboxToken();
  const params = new URLSearchParams({
    q: trimmed,
    session_token: sessionToken,
    access_token: token,
    limit: "8",
    types: "poi",
  });
  const url = `${SEARCH_BOX_BASE_URL}/suggest?${params.toString()}`;
  const response = await searchBoxRateLimiter.schedule(() => fetch(url));
  if (!response.ok) {
    throw new MapboxApiError(`Venue suggest failed (${response.status}).`, response.status);
  }
  const data = await response.json();
  const suggestions = (data.suggestions ?? []) as Array<Record<string, any>>;
  return suggestions.map((s) => ({
    mapboxId: s.mapbox_id,
    name: s.name,
    fullAddress: s.full_address ?? null,
    placeFormatted: s.place_formatted ?? null,
  }));
};

export const retrieveVenue = async (
  mapboxId: string,
  sessionToken: string
): Promise<VenueSearchResult> => {
  const token = assertMapboxToken();
  const params = new URLSearchParams({ session_token: sessionToken, access_token: token });
  const url = `${SEARCH_BOX_BASE_URL}/retrieve/${encodeURIComponent(mapboxId)}?${params.toString()}`;
  const response = await searchBoxRateLimiter.schedule(() => fetch(url));
  if (!response.ok) {
    throw new MapboxApiError(`Venue retrieve failed (${response.status}).`, response.status);
  }
  const data = await response.json();
  const feature = data.features?.[0];
  if (!feature) {
    throw new MapboxApiError("Venue could not be resolved.");
  }
  const [longitude, latitude] = feature.geometry?.coordinates ?? [];
  return {
    mapboxId: feature.properties.mapbox_id,
    name: feature.properties.name,
    fullAddress: feature.properties.full_address ?? null,
    coordinates:
      typeof latitude === "number" && typeof longitude === "number"
        ? { latitude, longitude }
        : null,
  };
};
