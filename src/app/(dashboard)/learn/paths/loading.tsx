import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the learning paths layout: header and stacked path cards with a media panel. */
export default function PathsLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-8 w-56" />
            <Skeleton className="mt-2 h-4 w-80" />
          </div>
        </div>

        {/* Path cards */}
        <div className="mt-8 space-y-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex flex-col md:flex-row">
                <Skeleton className="h-40 w-full rounded-none md:w-64" />
                <div className="flex-1 space-y-3 p-6">
                  <Skeleton className="h-5 w-64" />
                  <Skeleton className="h-4 w-full max-w-lg" />
                  <div className="flex gap-4">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
