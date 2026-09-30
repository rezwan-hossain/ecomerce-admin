import { Skeleton } from "@/components/ui/skeleton"

// Shown right away while page.tsx waits for the /options API.
// It copies the page layout, so nothing jumps when the real data arrives.
export default function OptionsLoading() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 lg:px-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>

      {/* Tabs and search */}
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-64" />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg border">
          <Skeleton className="h-10 rounded-none" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 border-t px-3 py-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((j) => (
                  <Skeleton key={j} className="h-5 w-12" />
                ))}
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
