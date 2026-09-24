import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, PrinterIcon } from "lucide-react"

import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  currency,
  formatDate,
  getOrder,
  getProductByName,
  orders,
} from "@/lib/demo-data"

export function generateStaticParams() {
  return orders.map((o) => ({ id: o.order.slice(1) }))
}

export default async function OrderDetailPage({
  params,
}: PageProps<"/orders/[id]">) {
  const { id } = await params
  const order = getOrder(id)
  if (!order) notFound()

  const product = getProductByName(order.product)
  const quantity = Number(order.quantity)
  const subtotal = Number(order.total)
  const shipping = subtotal >= 100 ? 0 : 5.99
  const tax = subtotal * 0.08
  const email = `${order.customer.toLowerCase().replace(" ", ".")}@example.com`

  const timeline = [
    { label: "Order placed", done: true },
    { label: "Payment confirmed", done: order.payment !== "Unpaid" },
    {
      label: "Shipped",
      done: ["Shipped", "Delivered"].includes(order.status),
    },
    { label: "Delivered", done: order.status === "Delivered" },
  ]

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            nativeButton={false}
            render={<Link href="/orders" />}
          >
            <ArrowLeftIcon />
            <span className="sr-only">Back to orders</span>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Order {order.order}
              </h1>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              Placed on {formatDate(order.date)}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm">
          <PrinterIcon data-icon="inline-start" />
          Print invoice
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className="flex size-14 items-center justify-center rounded-md bg-muted text-lg font-semibold text-muted-foreground">
                  {order.product.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{order.product}</div>
                  <div className="text-sm text-muted-foreground">
                    {product?.sku} · {order.category}
                  </div>
                </div>
                <div className="text-right text-sm tabular-nums">
                  <div>
                    {currency.format(subtotal / quantity)} × {quantity}
                  </div>
                  <div className="font-medium">{currency.format(subtotal)}</div>
                </div>
              </div>
              <Separator />
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Subtotal</dt>
                  <dd className="tabular-nums">{currency.format(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Shipping</dt>
                  <dd className="tabular-nums">
                    {shipping ? currency.format(shipping) : "Free"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Tax (8%)</dt>
                  <dd className="tabular-nums">{currency.format(tax)}</dd>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-medium">
                  <dt>Total</dt>
                  <dd className="tabular-nums">
                    {currency.format(subtotal + shipping + tax)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3">
                {timeline.map((step) => (
                  <li key={step.label} className="flex items-center gap-3 text-sm">
                    <span
                      className={
                        step.done
                          ? "size-2.5 rounded-full bg-primary"
                          : "size-2.5 rounded-full border border-muted-foreground/40"
                      }
                    />
                    <span className={step.done ? "" : "text-muted-foreground"}>
                      {step.label}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
              <CardDescription>{email}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="font-medium">{order.customer}</div>
              <div className="text-muted-foreground">
                221B Market Street
                <br />
                San Francisco, CA 94103
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Visa •••• 4242</span>
              <Badge variant={order.payment === "Paid" ? "secondary" : "outline"}>
                {order.payment}
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
