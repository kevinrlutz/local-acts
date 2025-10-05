import { create } from "zustand";

type AuthState = {
  user: { uid: string; name?: string } | null;
  setUser: (u: AuthState["user"]) => void;
  signOut: () => void;
};

export const useAuthStore = create<AuthState>((set: (arg0: { user: any; }) => any) => ({
  user: null,
  setUser: (u: any) => set({ user: u }),
  signOut: () => set({ user: null }),
}));
