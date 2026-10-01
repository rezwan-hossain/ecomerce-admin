import { Skeleton } from "@/components/ui/skeleton"

// Shown right away while page.tsx loads campaigns, promotions and the catalog.
export default function Loading() {
  return (
    <div className="flex-1 bg-muted/50">
      <div className="flex items-center gap-2 border-b bg-background px-4 py-2.5 lg:px-7">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="ml-auto h-9 w-36" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="mx-auto max-w-[1360px] px-4 pt-7.5 lg:px-7">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="mt-3 h-5 w-96" />
        <Skeleton className="mt-6 h-96 rounded-xl" />
      </div>
    </div>
  )
}
