"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserRole } from "@/types/database";

interface ViewAsState {
  realRole: UserRole | null;
  viewingAs: UserRole | null;
  canUseViewAs: boolean;
  previewableRoles: UserRole[];
}

const EMPTY: ViewAsState = {
  realRole: null,
  viewingAs: null,
  canUseViewAs: false,
  previewableRoles: [],
};

/**
 * Client hook for the read-only role preview (§2.12). Reads the caller's real
 * role and current preview from `/api/auth/view-as`, and exposes actions to
 * start/stop a preview. Starting or stopping does a full navigation to
 * `/dashboard` so server components and `/api/auth/me` re-resolve against the
 * new cookie.
 */
export function useViewAs() {
  const [state, setState] = useState<ViewAsState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/view-as");
      if (!res.ok) {
        setState(EMPTY);
        return;
      }
      const data = await res.json();
      setState({
        realRole: data.realRole ?? null,
        viewingAs: data.viewingAs ?? null,
        canUseViewAs: !!data.canUseViewAs,
        previewableRoles: data.previewableRoles ?? [],
      });
    } catch {
      setState(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startPreview = useCallback(async (role: UserRole) => {
    setPending(true);
    try {
      const res = await fetch("/api/auth/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (res.ok) {
        // Full reload so server-rendered pages and /api/auth/me pick up the
        // new role.
        window.location.assign("/dashboard");
      } else {
        setPending(false);
      }
    } catch {
      setPending(false);
    }
  }, []);

  const exitPreview = useCallback(async () => {
    setPending(true);
    try {
      await fetch("/api/auth/view-as", { method: "DELETE" });
    } catch {
      // Fall through — reload anyway so the UI leaves preview mode.
    }
    window.location.assign("/dashboard");
  }, []);

  return {
    ...state,
    isPreviewing: !!state.viewingAs,
    loading,
    pending,
    refresh,
    startPreview,
    exitPreview,
  };
}
