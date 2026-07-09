"use client";

import { Eye, X } from "lucide-react";
import { roleLabel } from "@/lib/auth/roles";
import { useViewAs } from "@/hooks/use-view-as";

/**
 * Persistent banner shown while an admin is previewing another role (§2.12).
 * Makes the read-only lens unmistakable and offers a one-click exit. Uses the
 * gold "secondary" accent so it reads as a distinct system-state bar rather
 * than a page element.
 */
export default function ViewAsBanner() {
  const { isPreviewing, viewingAs, pending, exitPreview } = useViewAs();

  if (!isPreviewing) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-3 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900"
    >
      <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="text-center">
        Read-only preview — you&apos;re viewing the app as a{" "}
        <span className="font-semibold">{roleLabel(viewingAs)}</span>. Changes are
        disabled.
      </span>
      <button
        type="button"
        onClick={() => exitPreview()}
        disabled={pending}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-400 bg-white/70 px-2.5 py-1 text-xs font-semibold text-amber-900 transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-1 focus:ring-offset-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
        Exit preview
      </button>
    </div>
  );
}
