import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar skeleton */}
      <div className="hidden lg:flex">
        <div className="flex h-full w-64 flex-col bg-gray-900">
          {/* Logo area */}
          <div className="flex h-16 items-center gap-3 border-b border-gray-800 px-4">
            <Skeleton className="h-9 w-9 rounded-lg bg-gray-700" />
            <Skeleton className="h-5 w-28 bg-gray-700" />
          </div>
          {/* Nav items */}
          <div className="flex-1 space-y-2 px-4 py-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="h-5 w-5 rounded bg-gray-700" />
                <Skeleton className="h-4 w-32 bg-gray-700" />
              </div>
            ))}
            <div className="pt-6">
              <Skeleton className="mb-3 h-3 w-20 bg-gray-700" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2">
                  <Skeleton className="h-5 w-5 rounded bg-gray-700" />
                  <Skeleton className="h-4 w-28 bg-gray-700" />
                </div>
              ))}
            </div>
          </div>
          {/* User area */}
          <div className="border-t border-gray-800 p-3">
            <div className="flex items-center gap-3 px-2">
              <Skeleton className="h-8 w-8 rounded-full bg-gray-700" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-24 bg-gray-700" />
                <Skeleton className="h-3 w-16 bg-gray-700" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header skeleton */}
        <div className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-8 rounded lg:hidden" />
            <Skeleton className="h-9 w-64 rounded-lg" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>

        {/* Page content skeleton */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Skeleton className="mb-2 h-8 w-48" />
          <Skeleton className="mb-6 h-4 w-72" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
