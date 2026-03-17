"use client";

import { useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

/**
 * AuthProvider listens for Supabase auth state changes and hydrates
 * the auth store with the current user's profile from the `users` table.
 * Place inside the dashboard layout so the user is available everywhere.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const clearUser = useAuthStore((s) => s.clearUser);

  useEffect(() => {
    // Fetch the profile for the currently authenticated user
    const hydrate = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await fetchProfile(supabase, user.id);
      } else {
        clearUser();
      }
    };

    hydrate();

    // Listen for auth state changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchProfile(supabase, session.user.id);
      } else {
        clearUser();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile, clearUser]);

  return <>{children}</>;
}
