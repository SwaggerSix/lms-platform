import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback loading state for any dashboard page without its own loading.tsx.
 * Renders inside the app shell (sidebar/header stay interactive), so this is
 * a content-only skeleton: page header, stat row, and content cards.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-7xl p-4 lg:p-6">
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
  );
}
