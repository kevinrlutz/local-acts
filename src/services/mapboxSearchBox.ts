import { SearchBoxCore, type SearchBoxSuggestion } from "@mapbox/search-js-core";

import { MapboxApiError, assertMapboxToken } from "@/src/lib/mapboxClient";
import type { VenueSearchResult, VenueSuggestion } from "@/src/types/venues";

const MIN_SUGGEST_QUERY_LENGTH = 5;

// Wraps the Search Box core client for the Event form's venue picker. The
// caller is responsible for minting a fresh UUIDv4 per search session (see
// src/lib/uuid.ts) and reusing it across a suggest -> retrieve pair.

const createSearchBox = () => new SearchBoxCore({ accessToken: assertMapboxToken() });

export const suggestVenues = async (
  query: string,
  sessionToken: string
): Promise<VenueSuggestion[]> => {
  const trimmed = query.trim();
  if (trimmed.length < MIN_SUGGEST_QUERY_LENGTH) {
    return [];
  }
  try {
    const { suggestions } = await createSearchBox().suggest(trimmed, {
      sessionToken,
      limit: 5,
      types: "poi",
    });
    return suggestions.map((s) => ({
      mapboxId: s.mapbox_id,
      name: s.name,
      fullAddress: s.full_address ?? null,
      placeFormatted: s.place_formatted ?? null,
    }));
  } catch (err) {
    throw new MapboxApiError(err instanceof Error ? err.message : "Venue suggest failed.");
  }
};

export const retrieveVenue = async (
  mapboxId: string,
  sessionToken: string
): Promise<VenueSearchResult> => {
  try {
    const suggestion = { mapbox_id: mapboxId } as SearchBoxSuggestion;
    const { features } = await createSearchBox().retrieve(suggestion, { sessionToken });
    const feature = features[0];
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
  } catch (err) {
    if (err instanceof MapboxApiError) throw err;
    throw new MapboxApiError(err instanceof Error ? err.message : "Venue retrieve failed.");
  }
};
