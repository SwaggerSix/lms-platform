import { create } from "zustand";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@/types/database";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  clearUser: () => void;
  fetchProfile: (supabase: SupabaseClient, authUserId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,

  setUser: (user) => set({ user }),

  clearUser: () => set({ user: null }),

  fetchProfile: async (supabase, authUserId) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*, organization:organizations(*)")
        .eq("auth_id", authUserId)
        .single();

      if (error) {
        console.error("Failed to fetch user profile:", error.message);
        set({ user: null });
        return;
      }

      set({ user: data as User });
    } catch (err) {
      console.error("Unexpected error fetching profile:", err);
      set({ user: null });
    } finally {
      set({ isLoading: false });
    }
  },
}));
