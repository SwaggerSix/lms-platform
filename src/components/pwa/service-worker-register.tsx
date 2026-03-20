"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCw, X } from "lucide-react";

export default function ServiceWorkerRegister() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  const handleUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  }, [registration]);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    async function register() {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        setRegistration(reg);

        // Check for updates periodically (every 60 minutes)
        const interval = setInterval(() => {
          reg.update();
        }, 60 * 60 * 1000);

        // Detect waiting service worker (update available)
        if (reg.waiting) {
          setShowUpdate(true);
        }

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setShowUpdate(true);
            }
          });
        });

        // Handle controller change (new SW activated)
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });

        return () => clearInterval(interval);
      } catch (err) {
        console.error("Service worker registration failed:", err);
      }
    }

    register();
  }, []);

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[90] flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 shadow-lg">
      <RefreshCw className="h-5 w-5 shrink-0 text-indigo-600" />
      <div className="flex-1">
        <p className="text-sm font-medium text-indigo-900">New version available</p>
        <p className="text-xs text-indigo-600">Refresh to get the latest features.</p>
      </div>
      <button
        onClick={handleUpdate}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
      >
        Refresh
      </button>
      <button
        onClick={() => setShowUpdate(false)}
        className="rounded p-0.5 text-indigo-400 hover:text-indigo-600"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
