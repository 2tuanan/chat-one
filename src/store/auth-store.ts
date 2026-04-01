import { create } from "zustand";
import type { AuthState, AuthUser, Profile } from "@/types/auth";

export interface AuthStore extends AuthState {
  hydrate: (payload: { user: AuthUser | null; profile: Profile | null }) => void;
  clear: () => void;
}

export const initialAuthState: AuthState = {
  user: null,
  profile: null,
  isLoading: false,
};

export const useAuthStore = create<AuthStore>((set) => ({
  ...initialAuthState,
  hydrate: ({ user, profile }) => set({ user, profile, isLoading: false }),
  clear: () => set({ ...initialAuthState }),
}));
