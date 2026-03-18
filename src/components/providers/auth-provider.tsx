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
    const hydrate = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await fetchProfile();
      } else {
        clearUser();
      }
    };

    hydrate();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchProfile();
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
