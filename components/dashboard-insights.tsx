"use client"

import Link from "next/link"
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

const compactFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
})
const wholeFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

// $720 below a thousand, $1.7K above.
const compact = {
  format: (value: number) =>
    value >= 1000 ? compactFormat.format(value) : wholeFormat.format(value),
}

const categoryConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig

export function SalesByCategory({
  data,
}: {
  data: { category: string; revenue: number }[]
}) {
  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>Sales by category</CardTitle>
        <CardDescription>Revenue from paid orders, last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={categoryConfig}
          className="aspect-auto w-full"
          style={{ height: data.length * 44 }}
        >
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 0, right: 56 }}
            barCategoryGap={10}
          >
            <XAxis type="number" dataKey="revenue" hide />
            <YAxis
              type="category"
              dataKey="category"
              tickLine={false}
              axisLine={false}
              width={110}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <ChartTooltip
              cursor={{ fill: "var(--muted)" }}
              content={
                <ChartTooltipContent
                  hideIndicator
                  formatter={(value) => compact.format(Number(value))}
                />
              }
            />
            <Bar
              dataKey="revenue"
              fill="var(--color-revenue)"
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
            >
              <LabelList
                dataKey="revenue"
                position="right"
                offset={8}
                className="fill-foreground"
                fontSize={12}
                formatter={(value) => compact.format(Number(value))}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export function TopProducts({
  data,
}: {
  data: { id: string; name: string; category: string; units: number; revenue: number }[]
}) {
  const max = Math.max(...data.map((d) => d.revenue))

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>Top products</CardTitle>
        <CardDescription>Best sellers by revenue</CardDescription>
        <CardAction>
          <Link
            href="/dashboard/products"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-4">
          {data.map((product) => (
            <li key={product.id} className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">
                {product.name.charAt(0)}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    href={`/dashboard/products/${product.id}/edit`}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {product.name}
                  </Link>
                  <span className="text-sm font-medium tabular-nums">
                    {compact.format(product.revenue)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/15">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(product.revenue / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs text-muted-foreground tabular-nums">
                    {product.units} sold
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
