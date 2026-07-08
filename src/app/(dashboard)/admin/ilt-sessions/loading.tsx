import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the sessions hub layout: tabs, header, stat row, toolbar, table. */
export default function AdminSessionsLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Sessions hub tabs */}
        <div className="mb-6 flex gap-4 border-b border-gray-200 pb-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-28" />
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-80" />
            <Skeleton className="mt-2 h-4 w-96" />
          </div>
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>

        {/* Toolbar */}
        <div className="mt-6 flex items-center gap-3">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
        </div>

        {/* Table */}
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <Skeleton className="h-4 w-full" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 border-b border-gray-100 px-4 py-5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-5 w-20 rounded-full" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
