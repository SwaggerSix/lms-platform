import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the skills layout: header, filter pills + search, table, category cards. */
export default function SkillsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-2 h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>

      {/* Filter pills + search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-11 w-80 rounded-lg" />
        <Skeleton className="h-10 w-64 rounded-lg" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 border-b border-gray-100 px-4 py-4">
            <Skeleton className="h-4 w-4" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-72" />
            </div>
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-2 w-32 rounded-full" />
            <Skeleton className="h-8 w-16 rounded" />
          </div>
        ))}
      </div>

      {/* Category summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
