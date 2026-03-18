"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/types/database";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  fetchProfile: () => Promise<void>;
  clearUser: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

/**
 * AuthProvider hydrates auth state via /api/auth/me (server-side cookies)
 * and exposes it through React Context — avoiding Zustand module
 * duplication issues with Turbopack.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        console.error("Failed to fetch user profile:", res.status);
        setUser(null);
        return;
      }
      const data = await res.json();
      setUser(data as User);
    } catch (err) {
      console.error("Unexpected error fetching profile:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearUser = useCallback(() => setUser(null), []);

  useEffect(() => {
    fetchProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        await fetchProfile();
      } else if (event === "SIGNED_OUT") {
        clearUser();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile, clearUser]);

  const value = useMemo(
    () => ({ user, isLoading, fetchProfile, clearUser }),
    [user, isLoading, fetchProfile, clearUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
