import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the learner sessions layout: header, toolbar, session cards grid. */
export default function SessionsLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div>
          <Skeleton className="h-8 w-72" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>

        {/* Toolbar */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>

        {/* Session cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="mt-3 h-5 w-48" />
              <Skeleton className="mt-2 h-4 w-40" />
              <div className="mt-4 space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="mt-4 h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
