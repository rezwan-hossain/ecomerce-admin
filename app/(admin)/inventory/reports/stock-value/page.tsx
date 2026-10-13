import Link from "next/link"
import { connection } from "next/server"

import { getStockValueReport } from "@/app/actions/inventory-report.actions"
import { Card, Kpis, n0, Pill, taka } from "@/components/inventory/inventory-ui"
import { money, param } from "@/components/inventory/reports/format"
import { ParamSwitch } from "@/components/inventory/reports/report-bits"
import { cn } from "@/lib/utils"

const SELLABLE = ["PHYSICAL", "STORE"]
// setup.tsx has the same labels, but it's a client module, so server pages can't read its values.
const TYPE_LABEL: Record<string, string> = {
  PHYSICAL: "Warehouse",
  STORE: "Retail store",
  VIRTUAL_DAMAGE: "Damage hold",
  VIRTUAL_QC: "Quality check hold",
  VIRTUAL_RETURN: "Returns processing",
}
const th = "px-3 py-2.5 font-medium first:pl-4 last:pr-4"
const td = "px-3 py-3 first:pl-4 last:pr-4"

export default async function StockValuePage({ searchParams }: PageProps<"/inventory/reports/stock-value">) {
  await connection()
  const search = await searchParams
  const includeInactive = param(search, "includeInactive") === "true"

  const res = await getStockValueReport(includeInactive)
  if (!res.success) return <p className="px-4 text-muted-foreground lg:px-6">Couldn’t load the report: {res.error}</p>
  const { warehouses, totals } = res.data

  return (
    <>
      <Kpis
        items={[
          { label: "Stock value", value: taka(Number(totals.stockValue)), hint: "on hand at average cost" },
          { label: "Units on hand", value: n0(totals.units.onHand), hint: `${n0(totals.variantsStocked)} SKUs stocked` },
          { label: "Available", value: n0(totals.units.available), hint: "on hand minus reserved" },
          { label: "Reserved", value: n0(totals.units.reserved), hint: "held for orders" },
          { label: "Incoming", value: n0(totals.units.incoming), hint: "on open purchase orders" },
          { label: "Damaged", value: n0(totals.units.damaged), hint: "not for sale", warn: totals.units.damaged > 0 },
        ]}
      />

      <Card
        title="By warehouse"
        className="mx-4 lg:mx-6"
        action={<ParamSwitch name="includeInactive" checked={includeInactive} label="Include inactive warehouses" />}
      >
        {warehouses.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">No stock in any warehouse yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className={th}>Warehouse</th>
                  <th className={cn(th, "text-right")}>SKUs</th>
                  <th className={cn(th, "text-right")}>On hand</th>
                  <th className={cn(th, "hidden text-right md:table-cell")}>Reserved</th>
                  <th className={cn(th, "text-right")}>Available</th>
                  <th className={cn(th, "hidden text-right lg:table-cell")}>Incoming</th>
                  <th className={cn(th, "hidden text-right lg:table-cell")}>Damaged</th>
                  <th className={cn(th, "text-right")}>Value</th>
                  <th className={cn(th, "w-48")}>Share of value</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {warehouses.map((w) => (
                  <tr key={w.warehouse.id} className="border-t border-border/60">
                    <td className={td}>
                      <Link href={`/inventory/setup/warehouses/${w.warehouse.id}`} className="font-medium hover:text-primary hover:underline">
                        {w.warehouse.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-mono">{w.warehouse.code}</span>· {TYPE_LABEL[w.warehouse.type]}
                        {!SELLABLE.includes(w.warehouse.type) && <Pill tone="grey">Not sellable</Pill>}
                        {!w.warehouse.isActive && <Pill tone="amber">Inactive</Pill>}
                      </div>
                    </td>
                    <td className={cn(td, "text-right text-muted-foreground")}>{n0(w.variantsStocked)}</td>
                    <td className={cn(td, "text-right font-semibold")}>{n0(w.units.onHand)}</td>
                    <td className={cn(td, "hidden text-right text-muted-foreground md:table-cell")}>{n0(w.units.reserved)}</td>
                    <td className={cn(td, "text-right")}>{n0(w.units.available)}</td>
                    <td className={cn(td, "hidden text-right text-muted-foreground lg:table-cell")}>{n0(w.units.incoming)}</td>
                    <td className={cn(td, "hidden text-right lg:table-cell", w.units.damaged > 0 ? "text-destructive" : "text-muted-foreground")}>{n0(w.units.damaged)}</td>
                    <td className={cn(td, "text-right font-semibold whitespace-nowrap")}>{money(w.stockValue)}</td>
                    <td className={td}>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, w.shareOfValue)}%` }} />
                        </div>
                        <span className="w-12 text-right text-xs text-muted-foreground">{w.shareOfValue.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-muted/30 font-semibold tabular-nums">
                <tr>
                  <td className={td}>Total</td>
                  <td className={cn(td, "text-right")}>{n0(totals.variantsStocked)}</td>
                  <td className={cn(td, "text-right")}>{n0(totals.units.onHand)}</td>
                  <td className={cn(td, "hidden text-right md:table-cell")}>{n0(totals.units.reserved)}</td>
                  <td className={cn(td, "text-right")}>{n0(totals.units.available)}</td>
                  <td className={cn(td, "hidden text-right lg:table-cell")}>{n0(totals.units.incoming)}</td>
                  <td className={cn(td, "hidden text-right lg:table-cell")}>{n0(totals.units.damaged)}</td>
                  <td className={cn(td, "text-right whitespace-nowrap")}>{taka(Number(totals.stockValue), 2)}</td>
                  <td className={td} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
