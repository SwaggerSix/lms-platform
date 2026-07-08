import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the transcript layout: header with actions, stat cards, record rows. */
export default function TranscriptLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header + actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div>
              <Skeleton className="h-8 w-56" />
              <Skeleton className="mt-2 h-4 w-72" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28 rounded-md" />
            <Skeleton className="h-10 w-28 rounded-md" />
            <Skeleton className="h-10 w-28 rounded-md" />
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>

        {/* Record groups */}
        <div className="mt-8 space-y-6">
          {Array.from({ length: 2 }).map((_, g) => (
            <div key={g}>
              <Skeleton className="h-6 w-20" />
              <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-6 border-b border-gray-100 px-6 py-4">
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-64" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
