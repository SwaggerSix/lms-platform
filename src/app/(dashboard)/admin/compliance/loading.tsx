import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the compliance layout: header, stat row, search, requirements table. */
export default function ComplianceLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-72" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-40 rounded-md" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>

      {/* Search */}
      <Skeleton className="h-11 w-full max-w-md rounded-lg" />

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-gray-100 px-4 py-4">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="ml-auto h-2 w-24 rounded-full" />
            <Skeleton className="h-8 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
