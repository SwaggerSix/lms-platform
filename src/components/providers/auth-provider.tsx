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
  /** Effective granular permissions for the current user (custom-role overlay). */
  permissions: string[];
  /** True if the current user holds the given permission key. */
  hasPermission: (key: string) => boolean;
  /** Assigned custom role (label only), or null for a plain built-in role. */
  customRole: { id: string; name: string } | null;
  fetchProfile: () => Promise<void>;
  clearUser: () => void;
}

/** Shape of the extra fields /api/auth/me returns beyond the User record. */
type MeResponse = User & {
  permissions?: string[];
  custom_role?: { id: string; name: string } | null;
};

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
  const [permissions, setPermissions] = useState<string[]>([]);
  const [customRole, setCustomRole] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        console.error("Failed to fetch user profile:", res.status);
        setUser(null);
        setPermissions([]);
        setCustomRole(null);
        return;
      }
      const data = (await res.json()) as MeResponse;
      setUser(data as User);
      setPermissions(Array.isArray(data.permissions) ? data.permissions : []);
      setCustomRole(data.custom_role ?? null);
    } catch (err) {
      console.error("Unexpected error fetching profile:", err);
      setUser(null);
      setPermissions([]);
      setCustomRole(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearUser = useCallback(() => {
    setUser(null);
    setPermissions([]);
    setCustomRole(null);
  }, []);

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

  const hasPermission = useCallback(
    (key: string) => permissions.includes(key),
    [permissions]
  );

  const value = useMemo(
    () => ({ user, isLoading, permissions, hasPermission, customRole, fetchProfile, clearUser }),
    [user, isLoading, permissions, hasPermission, customRole, fetchProfile, clearUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
