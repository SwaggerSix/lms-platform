import { create } from "zustand";
import type { User } from "@/types/database";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  clearUser: () => void;
  fetchProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,

  setUser: (user) => set({ user }),

  clearUser: () => set({ user: null }),

  fetchProfile: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        console.error("Failed to fetch user profile:", res.status);
        set({ user: null });
        return;
      }
      const data = await res.json();
      set({ user: data as User });
    } catch (err) {
      console.error("Unexpected error fetching profile:", err);
      set({ user: null });
    } finally {
      set({ isLoading: false });
    }
  },
}));
