import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the learner documents layout: folder sidebar (md+) and document rows. */
export default function DocumentsLoading() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Folder sidebar (hidden below md, like the real page) */}
      <div className="hidden w-72 border-r border-gray-200 bg-white md:block">
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
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-8 w-56" />
        {/* Folder dropdown placeholder (mobile) */}
        <Skeleton className="mt-4 h-10 w-full rounded-lg md:hidden" />
        <div className="mt-4 flex items-center gap-3">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-3 w-full max-w-md" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-9 w-24 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
