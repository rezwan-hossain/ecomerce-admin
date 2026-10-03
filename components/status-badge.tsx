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
  Draft: <CircleDashedIcon />,
  Archived: <ArchiveIcon />,
  Inactive: <CircleDashedIcon />,
  "In stock": <CircleCheckIcon className="fill-green-500 dark:fill-green-400" />,
  "Low stock": <TriangleAlertIcon className="text-amber-600 dark:text-amber-400" />,
  "Out of stock": <CircleXIcon className="text-destructive" />,
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className="px-1.5 text-muted-foreground">
      {icons[status]}
      {status}
    </Badge>
  )
}
