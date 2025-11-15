export type UserRole = "fan" | "artist";

export type AuthStatus = "idle" | "checking" | "unauthenticated" | "missing-role" | "authenticated";

export type AppUser = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  role?: UserRole | null;
  photoUrl?: string | null;
  createdAt?: Date | null;
};
