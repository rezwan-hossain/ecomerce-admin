"use client"

import { Line, LineChart, YAxis } from "recharts"
import {
  DollarSignIcon,
  PercentIcon,
  ReceiptIcon,
  ShoppingBagIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react"

import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChartContainer, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"

type Stat = {
  label: string
  value: string
  delta: number
  icon: React.ReactNode
  // Last 12 weeks, oldest first.
  trend: number[]
}

const stats: Stat[] = [
  {
    label: "Total revenue",
    value: "$84,254",
    delta: 12.5,
    icon: <DollarSignIcon />,
    trend: [52, 58, 55, 61, 64, 60, 68, 71, 69, 75, 79, 84],
  },
  {
    label: "Orders",
    value: "2,847",
    delta: -4.2,
    icon: <ShoppingBagIcon />,
    trend: [31, 33, 30, 32, 34, 31, 29, 30, 28, 29, 27, 28],
  },
  {
    label: "Avg. order value",
    value: "$29.59",
    delta: 8.1,
    icon: <ReceiptIcon />,
    trend: [24, 24, 25, 25, 26, 25, 27, 27, 28, 28, 29, 30],
  },
  {
    label: "Conversion rate",
    value: "3.2%",
    delta: 0.4,
    icon: <PercentIcon />,
    trend: [2.6, 2.7, 2.7, 2.8, 2.8, 2.9, 2.9, 3.0, 3.0, 3.1, 3.1, 3.2],
  },
]

const sparkConfig = {
  value: { label: "Value", color: "var(--muted-foreground)" },
} satisfies ChartConfig

function Sparkline({ data }: { data: number[] }) {
  const points = data.map((value, index) => ({ index, value }))
  const last = points.length - 1

  return (
    <ChartContainer config={sparkConfig} className="aspect-auto h-10 w-24">
      <LineChart data={points} margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Line
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeOpacity={0.5}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          isAnimationActive={false}
          dot={(props: { cx?: number; cy?: number; index?: number }) =>
            props.index === last ? (
              <circle
                key="end"
                cx={props.cx}
                cy={props.cy}
                r={4}
                fill="var(--primary)"
                stroke="var(--card)"
                strokeWidth={2}
              />
            ) : (
              <g key={props.index} />
            )
          }
        />
      </LineChart>
    </ChartContainer>
  )
}

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {stats.map((stat) => {
        const up = stat.delta >= 0
        return (
          <Card key={stat.label} className="@container/card shadow-xs">
            <CardHeader>
              <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary [&>svg]:size-4.5">
                {stat.icon}
              </div>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl font-semibold @[250px]/card:text-3xl">
                {stat.value}
              </CardTitle>
              <CardAction>
                <Sparkline data={stat.trend} />
              </CardAction>
            </CardHeader>
            <div className="flex items-center gap-2 px-(--card-spacing) text-sm">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium [&>svg]:size-3.5",
                  up
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "bg-red-500/10 text-red-700 dark:text-red-400"
                )}
              >
                {up ? <TrendingUpIcon /> : <TrendingDownIcon />}
                {up ? "+" : ""}
                {stat.delta}%
              </span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
