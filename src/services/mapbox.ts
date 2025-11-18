export type LocationMode = "zip" | "city-state";

export type GeocodeLocationInput =
  | { mode: "zip"; zip: string }
  | { mode: "city-state"; city: string; state: string };

export type GeocodeLocationResult = {
  coordinates: { latitude: number; longitude: number };
  formattedAddress: string;
  city?: string;
  state?: string;
  postalCode?: string;
  placeType?: string;
};

class MapboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MapboxError";
  }
}

export class MissingMapboxTokenError extends MapboxError {}

const assertToken = (): string => {
  if (!process.env.EXPO_PUBLIC_MAPBOX_TOKEN) {
    throw new MissingMapboxTokenError(
      "Missing Mapbox token. Provide EXPO_PUBLIC_MAPBOX_TOKEN via app config before submitting locations."
    );
  }
  return process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
};

const buildQuery = (input: GeocodeLocationInput): string => {
  if (input.mode === "zip") {
    return input.zip.trim();
  }
  const city = input.city.trim();
  const state = input.state.trim();
  if (!city || !state) {
    throw new MapboxError("City and state are required.");
  }
  return `${city}, ${state}`;
};

export const geocodeLocation = async (
  input: GeocodeLocationInput
): Promise<GeocodeLocationResult> => {
  const query = buildQuery(input);
  const token = assertToken();
  const encodedQuery = encodeURIComponent(query);
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?autocomplete=true&limit=1&access_token=${token}&country=us`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new MapboxError("Mapbox request failed. Double-check the provided location.");
  }

  const data = await response.json();
  if (!data?.features?.length) {
    throw new MapboxError("No results found for the provided location.");
  }

  const feature = data.features[0];
  const [longitude, latitude] = feature.center ?? [];
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    throw new MapboxError("Mapbox response did not include coordinates.");
  }

  const findContext = (prefix: string) =>
    feature.context?.find((ctx: { id: string; text?: string }) => ctx.id.startsWith(prefix))?.text;

  return {
    coordinates: { latitude, longitude },
    formattedAddress: feature.place_name,
    city: findContext("place") ?? feature.text,
    state: findContext("region"),
    postalCode: findContext("postcode") ?? (input.mode === "zip" ? query : ""),
    placeType: feature.place_type?.[0],
  };
};
