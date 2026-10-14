"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import { countLocation, createRack, getLocationContents, moveFromLocation, removeLocation, setFloorSize } from "@/app/actions/rack-map.actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { FloorItem, FloorPlan, LocationContents, PutAwayLine, Rotation } from "@/types/rack-map.type"

import { n0, RackTag } from "../inventory-ui"

// Native selects: the destination list needs <optgroup> per rack.
export const nativeSelect =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"

function ErrorLine({ text }: { text: string }) {
  if (!text) return null
  return <p className="mr-auto text-[13px] font-medium text-destructive">{text}</p>
}

/* ---------- Move stock ---------- */

const round1 = (n: number) => Math.round(n * 10) / 10

export type MoveStart = { fromId: string; levelId?: string; toId?: string; makeDefault?: boolean }

// Leaf locations stock can go to, grouped by rack: bins of placed racks, then docks and staging areas.
function destinations(plan: FloorPlan, exclude: string) {
  const groups: { label: string; options: { id: string; text: string }[] }[] = []
  for (const item of plan.items) {
    if (item.type !== "RACK" || !item.levels) continue
    const options = item.levels
      .flatMap((level) => level.bins)
      .filter((bin) => bin.isActive && bin.id !== exclude)
      .map((bin) => ({ id: bin.id, text: `${bin.code}  ${bin.stock.units ? `(${n0(bin.stock.units)} units)` : "(empty)"}${bin.isPickable ? "" : ", not picked"}` }))
    if (options.length) groups.push({ label: item.code, options })
  }
  const areas = plan.items
    .filter((item) => ["RECEIVING", "STAGING", "PACKING"].includes(item.type) && item.isActive && item.id !== exclude)
    .map((item) => ({ id: item.id, text: `${item.code}  ${item.name ?? ""}` }))
  if (areas.length) groups.push({ label: "Other locations", options: areas })
  return groups
}

export function MoveDialog({
  plan,
  start,
  onClose,
  onDone,
}: {
  plan: FloorPlan
  start: MoveStart
  onClose: () => void
  onDone: (toId: string) => void
}) {
  const [source, setSource] = useState<LocationContents | null>(null)
  const [levelId, setLevelId] = useState(start.levelId ?? "")
  const [toId, setToId] = useState(start.toId ?? "")
  const [qty, setQty] = useState("")
  const [makeDefault, setMakeDefault] = useState(start.makeDefault ?? false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getLocationContents(start.fromId).then((res) => {
      if (!res.success) return setError(res.error)
      setSource(res.data)
      const row = res.data.rows.find((r) => r.inventoryLevelId === start.levelId) ?? res.data.rows[0]
      if (row) {
        setLevelId(row.inventoryLevelId)
        setQty(String(row.quantity))
      }
    })
  }, [start.fromId, start.levelId])

  const row = source?.rows.find((r) => r.inventoryLevelId === levelId)
  const groups = destinations(plan, start.fromId)

  async function save() {
    if (!row) return setError("Choose an item.")
    if (!toId) return setError("Choose where to move it.")
    const quantity = Number(qty)
    if (!/^\d+$/.test(qty.trim()) || quantity < 1 || quantity > row.quantity) return setError(`Move between 1 and ${row.quantity} units.`)
    setSaving(true)
    const res = await moveFromLocation(start.fromId, { inventoryLevelId: row.inventoryLevelId, toLocationId: toId, quantity, ...(makeDefault && { makeDefault }) })
    setSaving(false)
    if (!res.success) return setError(res.error)
    const toCode = groups.flatMap((g) => g.options).find((o) => o.id === toId)?.text.split(" ")[0]
    toast.success(`Moved ${n0(quantity)} ${quantity === 1 ? "unit" : "units"} of ${row.sku} to ${toCode}`)
    onDone(toId)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Move stock</DialogTitle>
          <DialogDescription>
            From {source?.location.code ?? "…"}. On-hand stock doesn’t change; the ledger records a rack move.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="move-item">Item</FieldLabel>
            <select
              id="move-item"
              className={nativeSelect}
              value={levelId}
              disabled={!source}
              onChange={(e) => {
                setLevelId(e.target.value)
                setQty(String(source!.rows.find((r) => r.inventoryLevelId === e.target.value)!.quantity))
                setError("")
              }}
            >
              {!source && <option>Loading...</option>}
              {source?.rows.map((r) => (
                <option key={r.inventoryLevelId} value={r.inventoryLevelId}>
                  {r.sku} ({n0(r.quantity)} here)
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="move-to">To</FieldLabel>
            <select id="move-to" className={nativeSelect} value={toId} onChange={(e) => (setToId(e.target.value), setError(""))}>
              <option value="">Choose a bin</option>
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.text}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <div className="grid items-end gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="move-qty">Quantity</FieldLabel>
              <Input id="move-qty" inputMode="numeric" className="text-right" value={qty} onChange={(e) => (setQty(e.target.value), setError(""))} />
              {row && <FieldDescription>Up to {n0(row.quantity)}.</FieldDescription>}
            </Field>
            <Field orientation="horizontal" className="pb-6">
              <Checkbox id="move-default" checked={makeDefault} onCheckedChange={(v) => setMakeDefault(v)} />
              <FieldLabel htmlFor="move-default" className="font-normal">Make it the default pick location</FieldLabel>
            </Field>
          </div>
        </div>
        <DialogFooter className="items-center">
          <ErrorLine text={error} />
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !source}>{saving ? "Moving..." : "Move"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- Choose waiting stock for a bin ---------- */

// Stock still at receiving or Unassigned, to put into one chosen bin.
export function PutAwayPicker({
  binCode,
  lines,
  onClose,
  onPick,
}: {
  binCode: string
  lines: PutAwayLine[]
  onClose: () => void
  onPick: (line: PutAwayLine) => void
}) {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const shown = lines.filter((l) => !q || `${l.sku} ${l.productName}`.toLowerCase().includes(q))

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add stock to {binCode}</DialogTitle>
          <DialogDescription>Pick an item waiting at receiving or Unassigned. You choose the quantity next.</DialogDescription>
        </DialogHeader>
        <Input autoFocus placeholder="Search by SKU or product..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search waiting stock" />
        <div className="max-h-[50vh] overflow-y-auto rounded-lg border">
          {shown.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              {lines.length === 0 ? "Nothing is waiting to be put away." : "No waiting item matches."}
            </p>
          ) : (
            <ul className="divide-y">
              {shown.map((line) => (
                <li key={line.locationId + line.inventoryLevelId}>
                  <button type="button" className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/50" onClick={() => onPick(line)}>
                    <RackTag code={line.locationCode} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs font-semibold">{line.sku}</span>
                      <span className="block truncate text-xs text-muted-foreground">{line.productName}</span>
                    </span>
                    <b className="tabular-nums">{n0(line.quantity)}</b>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- Count a bin ---------- */

export function CountDialog({ contents, onClose, onDone }: { contents: LocationContents; onClose: () => void; onDone: () => void }) {
  const [counts, setCounts] = useState<Record<string, string>>(() => Object.fromEntries(contents.rows.map((r) => [r.inventoryLevelId, String(r.quantity)])))
  const [applyNow, setApplyNow] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function save() {
    if (Object.values(counts).some((v) => !/^\d+$/.test(v.trim()))) return setError("Counts must be whole numbers.")
    const changed = contents.rows.filter((r) => Number(counts[r.inventoryLevelId]) !== r.quantity)
    if (changed.length === 0) {
      toast.success("Counts match the system. Nothing to adjust.")
      return onClose()
    }
    setSaving(true)
    const res = await countLocation(
      contents.location.id,
      contents.rows.map((r) => ({ inventoryLevelId: r.inventoryLevelId, countedQty: Number(counts[r.inventoryLevelId]) })),
      applyNow
    )
    setSaving(false)
    if (!res.success) return setError(res.error)
    const adj = res.data.adjustment
    if (!adj) toast.success("Counts match the system. Nothing to adjust.")
    else if (adj.status === "APPLIED") toast.success(`${adj.adjustmentNumber} applied`)
    else toast.success(`${adj.adjustmentNumber} sent for approval`, applyNow ? { description: "Applying straight away needs an admin to be signed in." } : undefined)
    onDone()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Count {contents.location.code}</DialogTitle>
          <DialogDescription>Enter what is physically here. Differences become a cycle-count adjustment.</DialogDescription>
        </DialogHeader>
        {contents.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">This location is empty in the system.</p>
        ) : (
          <div className="max-h-[50vh] overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
                  <th>Item</th>
                  <th className="text-right">System</th>
                  <th className="text-right">Counted</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {contents.rows.map((r) => (
                  <tr key={r.inventoryLevelId} className="border-t [&>td]:px-3 [&>td]:py-2">
                    <td>
                      <div className="font-mono text-xs font-semibold">{r.sku}</div>
                      <div className="text-xs text-muted-foreground">{r.productName}</div>
                    </td>
                    <td className="text-right text-muted-foreground">{n0(r.quantity)}</td>
                    <td className="text-right">
                      <Input
                        aria-label={`Counted ${r.sku}`}
                        inputMode="numeric"
                        className="ml-auto h-8 w-20 text-right"
                        value={counts[r.inventoryLevelId]}
                        onChange={(e) => (setCounts({ ...counts, [r.inventoryLevelId]: e.target.value }), setError(""))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Field>
          <FieldLabel htmlFor="count-apply">Approval</FieldLabel>
          <select id="count-apply" className={nativeSelect} value={applyNow ? "now" : "approval"} onChange={(e) => setApplyNow(e.target.value === "now")}>
            <option value="now">Apply now in my name</option>
            <option value="approval">Send for approval</option>
          </select>
        </Field>
        <DialogFooter className="items-center">
          <ErrorLine text={error} />
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || contents.rows.length === 0}>{saving ? "Saving..." : "Record count"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- Add a rack ---------- */

const FACES: { rotation: Rotation; label: string }[] = [
  { rotation: 0, label: "East, rack runs north to south" },
  { rotation: 180, label: "West, rack runs north to south" },
  { rotation: 90, label: "South, rack runs east to west" },
  { rotation: 270, label: "North, rack runs east to west" },
]

export function AddRackDialog({
  warehouseId,
  zones,
  onClose,
  onDone,
}: {
  warehouseId: string
  zones: FloorItem[]
  onClose: () => void
  onDone: (rack: FloorItem) => void
}) {
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "")
  const [rotation, setRotation] = useState<Rotation>(0)
  const [levels, setLevels] = useState("4")
  const [bins, setBins] = useState("3")
  const [length, setLength] = useState("")
  const [depth, setDepth] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!/^[A-Z0-9][A-Z0-9-]{0,9}$/.test(code)) return setError("Use 1 to 10 capital letters, digits or dashes for the code.")
    if (code === "DAMAGE") return setError("DAMAGE is reserved for the damage section.")
    const levelCount = Number(levels)
    const binCount = Number(bins)
    if (!(levelCount >= 1 && levelCount <= 8 && binCount >= 1 && binCount <= 6)) return setError("Choose 1 to 8 levels and 1 to 6 bins per level.")
    if ((length && !(Number(length) > 0)) || (depth && !(Number(depth) > 0))) return setError("Enter the size in metres, or leave it blank.")
    setSaving(true)
    // No placement: the server finds a free spot, inside the zone if one is chosen.
    const res = await createRack(warehouseId, {
      code,
      ...(name.trim() && { name: name.trim() }),
      ...(zoneId && { zoneId }),
      levels: levelCount,
      binsPerLevel: binCount,
      rotation,
      ...(length && { length: Number(length) }),
      ...(depth && { depth: Number(depth) }),
    })
    setSaving(false)
    if (!res.success) return setError(res.error)
    toast.success(`Rack ${res.data.code} added with ${levelCount * binCount} bins`)
    onDone(res.data)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a rack</DialogTitle>
          <DialogDescription>Creates the rack, a shelf for each level and a pickable bin for each slot, and places it on a free spot.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="rack-code">Code</FieldLabel>
            <Input id="rack-code" placeholder="B-05" className="font-mono" value={code} onChange={(e) => (setCode(e.target.value.toUpperCase()), setError(""))} />
          </Field>
          <Field>
            <FieldLabel htmlFor="rack-name">Name</FieldLabel>
            <Input id="rack-name" placeholder="Optional" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="rack-zone">Zone</FieldLabel>
            <select id="rack-zone" className={nativeSelect} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
              <option value="">No zone</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code} {z.name ?? ""}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="rack-face">Pick face</FieldLabel>
            <select id="rack-face" className={nativeSelect} value={rotation} onChange={(e) => setRotation(Number(e.target.value) as Rotation)}>
              {FACES.map((f) => (
                <option key={f.rotation} value={f.rotation}>
                  {f.label}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <FieldLabel htmlFor="rack-levels">Levels</FieldLabel>
            <Input id="rack-levels" inputMode="numeric" value={levels} onChange={(e) => setLevels(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="rack-bins">Bins per level</FieldLabel>
            <Input id="rack-bins" inputMode="numeric" value={bins} onChange={(e) => setBins(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="rack-length">Length, along the bins (m)</FieldLabel>
            <Input id="rack-length" inputMode="decimal" placeholder={String(round1((Number(bins) || 3) * 1.4))} value={length} onChange={(e) => setLength(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="rack-depth">Depth, across (m)</FieldLabel>
            <Input id="rack-depth" inputMode="decimal" placeholder="1.2" value={depth} onChange={(e) => setDepth(e.target.value)} />
          </Field>
        </div>
        <p className="text-[12.5px] text-muted-foreground">
          Leave the size blank for 1.4 m per bin and 1.2 m deep. Bin codes follow rack, level and slot, like <span className="font-mono font-semibold">{code || "B-05"}-1-A</span>.
        </p>
        <DialogFooter className="items-center">
          <ErrorLine text={error} />
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Adding..." : "Add rack"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- Floor size ---------- */

export function FloorSizeDialog({ plan, onClose, onDone }: { plan: FloorPlan; onClose: () => void; onDone: () => void }) {
  const [width, setWidth] = useState(String(plan.warehouse.floorWidth ?? 40))
  const [depth, setDepth] = useState(String(plan.warehouse.floorDepth ?? 25))
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function save() {
    const w = Number(width)
    const d = Number(depth)
    if (!(w > 0 && d > 0)) return setError("Enter the width and depth in metres.")
    setSaving(true)
    const res = await setFloorSize(plan.warehouse.id, w, d)
    setSaving(false)
    if (!res.success) return setError(res.error)
    toast.success(`Floor set to ${w} × ${d} m`)
    onDone()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Floor size</DialogTitle>
          <DialogDescription>The usable floor of {plan.warehouse.name}, in metres. North is at the top of the map.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="floor-w">Width, west to east</FieldLabel>
            <Input id="floor-w" inputMode="decimal" className="text-right" value={width} onChange={(e) => setWidth(e.target.value)} />
          </Field>
          <Field>
            <FieldLabel htmlFor="floor-d">Depth, north to south</FieldLabel>
            <Input id="floor-d" inputMode="decimal" className="text-right" value={depth} onChange={(e) => setDepth(e.target.value)} />
          </Field>
        </div>
        <DialogFooter className="items-center">
          <ErrorLine text={error} />
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save floor size"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------- Remove a rack ---------- */

export function RemoveDialog({ item, onClose, onDone }: { item: FloorItem; onClose: () => void; onDone: () => void }) {
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function remove() {
    setSaving(true)
    const res = await removeLocation(item.id)
    setSaving(false)
    if (!res.success) return setError(res.error)
    if (res.data.result === "deactivated") toast.success(`${item.code} switched off`, { description: "It has history, so it was switched off instead of deleted." })
    else toast.success(`${item.code} removed`)
    onDone()
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {item.code}?</DialogTitle>
          <DialogDescription>
            The rack, its shelves and bins are deleted. If any of them has movement history, it’s switched off instead and drawn hatched.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="items-center">
          <ErrorLine text={error} />
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={remove} disabled={saving}>{saving ? "Removing..." : "Remove rack"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
