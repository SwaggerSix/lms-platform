import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the knowledge base layout: search hero, category grid, article list. */
export default function KnowledgeBaseLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search hero */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <Skeleton className="mx-auto h-9 w-96 max-w-full" />
          <Skeleton className="mx-auto mt-3 h-4 w-72 max-w-full" />
          <Skeleton className="mx-auto mt-6 h-12 w-full max-w-xl rounded-xl" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* Category cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>

        {/* Article list */}
        <Skeleton className="mt-10 h-6 w-48" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
              <Skeleton className="h-4 w-72" />
              <Skeleton className="mt-2 h-3 w-full max-w-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
