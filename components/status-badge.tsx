import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  ClockIcon,
  ArchiveIcon,
  LoaderIcon,
  PackageCheckIcon,
  TriangleAlertIcon,
  TruckIcon,
  Undo2Icon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const icons: Record<string, React.ReactNode> = {
  Pending: <ClockIcon />,
  Requested: <ClockIcon />,
  Processing: <LoaderIcon />,
  Confirmed: <CircleCheckIcon />,
  "Ready to ship": <PackageCheckIcon />,
  Shipped: <TruckIcon />,
  Delivered: <CircleCheckIcon className="fill-green-500 dark:fill-green-400" />,
  Completed: <CircleCheckIcon className="fill-green-500 dark:fill-green-400" />,
  Active: <CircleCheckIcon className="fill-green-500 dark:fill-green-400" />,
  Approved: <CircleCheckIcon className="fill-green-500 dark:fill-green-400" />,
  Cancelled: <CircleXIcon className="text-destructive" />,
  Rejected: <CircleXIcon className="text-destructive" />,
  Failed: <CircleXIcon className="text-destructive" />,
  Refunded: <Undo2Icon />,
  Returned: <Undo2Icon className="text-amber-600 dark:text-amber-400" />,
  "Partly returned": <Undo2Icon className="text-amber-600 dark:text-amber-400" />,
  Draft: <CircleDashedIcon />,
  Archived: <ArchiveIcon />,
  Inactive: <CircleDashedIcon />,
  "In stock": <CircleCheckIcon className="fill-green-500 dark:fill-green-400" />,
  "Low stock": <TriangleAlertIcon className="text-amber-600 dark:text-amber-400" />,
  "Out of stock": <CircleXIcon className="text-destructive" />,
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("px-1.5 text-muted-foreground", status === "Returned" && "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
        status === "Partly returned" && "border-amber-400 text-amber-800 dark:border-amber-700 dark:text-amber-300")}>
      {icons[status]}
      {status}
    </Badge>
  )
}
