"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { fmtDate, taka } from "@/components/inventory/inventory-ui"
import type { OrderDetail } from "@/types/order.type"

const STORE_NAME = "Acme Store"

// A small plain invoice that's all Print shows. It sits directly in <body> as a .print-sheet,
// hidden on screen; app/globals.css hides everything else in <body> when printing.
export function PrintInvoice({ order }: { order: OrderDetail }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const money = (value: string | number) => taka(Number(value), 2)
  const paid = order.payments.filter((p) => p.status === "PAID").reduce((s, p) => s + Number(p.amount), 0)
  const due = Number(order.totalAmount) - paid
  const ship = order.addresses.find((a) => a.type === "SHIPPING")
  const payment = order.payments.find((p) => p.status === "PAID") ?? order.payments.at(-1)

  return createPortal(
    <div className="print-sheet hidden text-[10.5px] leading-snug text-black print:block">
      <div className="flex justify-between border-b border-black pb-1.5">
        <strong className="text-[13px]">{STORE_NAME}</strong>
        <span className="text-right">
          <strong>{order.orderNumber}</strong> · {fmtDate(order.placedAt ?? order.createdAt)}
        </span>
      </div>

      <p className="py-2">
        <strong>{order.customerName ?? order.customerEmail}</strong>
        {order.customerPhone && ` · ${order.customerPhone}`}
        {ship && <br />}
        {ship && [ship.addressLine1, ship.addressLine2, ship.city, ship.postalCode].filter(Boolean).join(", ")}
      </p>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-black text-left [&>th]:py-0.5 [&>th]:font-semibold">
            <th>Item</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Price</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((i) => (
            <tr key={i.id} className="border-b border-black/15 [&>td]:py-0.5">
              <td>
                {i.productName}
                {i.variantName && i.variantName !== i.sku && `, ${i.variantName}`}
              </td>
              <td className="text-right">{i.quantity}</td>
              <td className="text-right">{money(i.unitPrice)}</td>
              <td className="text-right">{money(i.totalAmount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-1.5 ml-auto grid w-48 grid-cols-[1fr_auto] gap-x-3">
        <dt>Subtotal</dt>
        <dd className="text-right">{money(order.subtotalAmount)}</dd>
        {Number(order.discountAmount) > 0 && (
          <>
            <dt>Discount</dt>
            <dd className="text-right">−{money(order.discountAmount)}</dd>
          </>
        )}
        {Number(order.shippingAmount) > 0 && (
          <>
            <dt>Shipping</dt>
            <dd className="text-right">{money(order.shippingAmount)}</dd>
          </>
        )}
        <dt className="border-t border-black font-bold">Total</dt>
        <dd className="border-t border-black text-right font-bold">{money(order.totalAmount)}</dd>
        {due > 0 && order.status !== "CANCELLED" && (
          <>
            <dt>Due</dt>
            <dd className="text-right">{money(due)}</dd>
          </>
        )}
      </dl>

      {payment && (
        <p className="mt-2 text-[9.5px]">
          {payment.provider} · {payment.status === "PAID" ? "Paid" : "Unpaid"}
        </p>
      )}
    </div>,
    document.body
  )
}
