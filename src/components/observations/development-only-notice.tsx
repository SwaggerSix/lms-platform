import { Info } from "lucide-react";

/**
 * Prominent reminder that observations are a development/coaching tool only,
 * not an input to performance reviews. Shown at the top of observation pages.
 */
export function ObservationDevelopmentNotice() {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3"
    >
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
      <p className="text-sm text-amber-900">
        <span className="font-semibold">For development purposes only.</span>{" "}
        Observations are a coaching and growth tool. They are{" "}
        <span className="font-semibold">not</span> used for performance reviews,
        ratings, or any evaluation decisions.
      </p>
    </div>
  );
}
