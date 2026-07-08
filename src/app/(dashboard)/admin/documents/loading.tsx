import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the documents layout: white header with stats, folder sidebar, table. */
export default function AdminDocumentsLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-96" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-32 rounded-md" />
            <Skeleton className="h-10 w-40 rounded-md" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>

      <div className="flex">
        {/* Folder sidebar */}
        <div className="min-h-[calc(100vh-200px)] w-72 border-r border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-1 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 p-6">
          <Skeleton className="mb-4 h-10 w-full max-w-md rounded-lg" />
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
              <Skeleton className="h-4 w-full" />
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-gray-100 px-4 py-4">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-6 w-6" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-5 w-12 rounded" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
