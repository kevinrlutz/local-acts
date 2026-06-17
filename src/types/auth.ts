export type UserRole = "fan" | "artist"

export type AuthStatus =
  | "idle"
  | "checking"
  | "unauthenticated"
  | "missing-role"
  | "authenticated"

export type UserLocation = {
  mode: "zip" | "city-state"
  rawInput: string
  formattedAddress: string
  coordinates: {
    latitude: number
    longitude: number
  }
  city?: string | null
  state?: string | null
  postalCode?: string | null
  placeType?: string | null
}

export type AppUser = {
  uid: string
  email?: string | null
  displayName?: string | null
  role?: UserRole | null
  photoUrl?: string | null
  hasActProfile?: boolean | null
  hasVenueProfile?: boolean | null
  createdAt?: Date | null
  location?: UserLocation | null
  stageLightsEnabled?: boolean | null
}
