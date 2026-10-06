"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeftIcon, PencilRulerIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"

import { getFloorPlan, getPickOrders, getPickRoute, getPutAway, rotateLocation, setPlacement } from "@/app/actions/rack-map.actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { boundingBox, faceLine, findFreeSpot, fitsFloor, isArea, overlaps, slotRect, snap } from "@/lib/rack-map/geometry"
import { cn } from "@/lib/utils"
import type { Box, FloorItem, FloorPlan, LocationContents, PickRoute, Placement, PutAwayLine } from "@/types/rack-map.type"

import { n0 } from "../inventory-ui"
import { AddRackDialog, CountDialog, FloorSizeDialog, MoveDialog, type MoveStart, PutAwayPicker, RemoveDialog } from "./rack-dialogs"
import {
  BinDetail,
  box,
  EditPanel,
  formatMetric,
  maxMetric,
  metric,
  type Mode,
  OverviewPanel,
  RackPanel,
  RoutePanel,
  scaleGradient,
  shade,
  slotStats,
} from "./rack-panels"

const MODES: { value: Mode; label: string }[] = [
  { value: "units", label: "Units" },
  { value: "value", label: "Value" },
  { value: "activity", label: "Activity" },
  { value: "route", label: "Pick route" },
]
const MODE_NOTE: Record<Mode, string> = {
  units: "Each rack is split into its slot columns, summed across levels.",
  value: "Value uses each item’s weighted average cost.",
  activity: "Activity counts movements in or out of each slot.",
  route: "Numbers show the order a picker visits each bin.",
}
const DOCKS = ["RECEIVING", "STAGING", "PACKING"]

type Drag = { item: FloorItem; offsetX: number; offsetY: number; centerX: number; centerY: number; moved: boolean; blocked: boolean }

export type RackMapState = { mode: Mode; rack: string | null; bin: string | null; q: string; edit: boolean }

export function RackMap({
  initialPlan,
  initialPutAway,
  warehouses,
  initial,
}: {
  initialPlan: FloorPlan
  initialPutAway: PutAwayLine[]
  warehouses: { id: string; code: string; name: string }[]
  initial: RackMapState
}) {
  const [plan, setPlan] = useState(initialPlan)
  const [putAway, setPutAway] = useState(initialPutAway)
  const [mode, setMode] = useState<Mode>(initial.mode)
  const [rackId, setRackId] = useState(initial.rack)
  const [binId, setBinId] = useState(initial.bin)
  const [query, setQuery] = useState(initial.q)
  const [edit, setEdit] = useState(initial.edit)
  const [version, setVersion] = useState(0)
  const [orders, setOrders] = useState<{ orderId: string; lines: number }[] | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [route, setRoute] = useState<PickRoute | null>(null)
  const [moveStart, setMoveStart] = useState<MoveStart | null>(null)
  const [counting, setCounting] = useState<LocationContents | null>(null)
  const [addingRack, setAddingRack] = useState(false)
  const [sizing, setSizing] = useState(false)
  const [removing, setRemoving] = useState<FloorItem | null>(null)
  const [fillingBin, setFillingBin] = useState<{ id: string; code: string } | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const wid = plan.warehouse.id
  const floor = plan.warehouse.floorWidth && plan.warehouse.floorDepth ? { width: plan.warehouse.floorWidth, depth: plan.warehouse.floorDepth } : null
  const zones = plan.items.filter((i) => isArea(i.type))
  const docks = plan.items.filter((i) => DOCKS.includes(i.type))
  const racks = plan.items.filter((i) => i.type === "RACK")
  const rack = racks.find((r) => r.id === rackId) ?? null
  const selected = plan.items.find((i) => i.id === rackId) ?? null
  const colourMode = mode === "route" ? "units" : mode
  const max = Math.max(1, maxMetric(plan, colourMode))
  const q = query.trim().toLowerCase()

  async function refresh() {
    const [p, a] = await Promise.all([getFloorPlan(wid, plan.activityDays), getPutAway(wid)])
    if (p.success) setPlan(p.data)
    else toast.error(p.error)
    if (a.success) setPutAway(a.data)
    setVersion((v) => v + 1)
  }

  // Keep the view in the URL so it can be shared and survives a reload.
  useEffect(() => {
    const params = new URLSearchParams()
    if (mode !== "units") params.set("mode", mode)
    if (rackId) params.set("rack", rackId)
    if (binId) params.set("bin", binId)
    if (query) params.set("q", query)
    if (edit) params.set("edit", "1")
    const search = params.toString()
    window.history.replaceState(null, "", search ? `?${search}` : window.location.pathname)
  }, [mode, rackId, binId, query, edit])

  useEffect(() => {
    if (mode !== "route" || orders) return
    getPickOrders(wid).then((res) => {
      const list = res.success ? res.data : []
      setOrders(list)
      // The order with the most lines first, since it's the longest walk.
      setOrderId([...list].sort((a, b) => b.lines - a.lines)[0]?.orderId ?? null)
    })
  }, [mode, orders, wid])

  useEffect(() => {
    if (mode !== "route" || !orderId) return
    getPickRoute(wid, orderId).then((res) => {
      if (res.success) setRoute(res.data)
      else toast.error(res.error)
    })
  }, [mode, orderId, wid, version])

  function selectItem(item: FloorItem) {
    if (edit || item.type === "RACK" || isArea(item.type)) {
      setRackId(item.id)
      setBinId(null)
    } else {
      // Docks and staging areas hold stock themselves, so they open as a location.
      setRackId(null)
      setBinId(item.id)
    }
    if (mode === "route" && !edit) setMode("units")
  }

  function selectBin(id: string, inRack: string | null) {
    setRackId(inRack)
    setBinId(id)
    if (mode === "route") setMode("units")
  }

  async function rotate(item: FloorItem, direction: "cw" | "ccw" | "180") {
    const res = await rotateLocation(item.id, direction)
    if (!res.success) return toast.error(res.error)
    let message = `${item.code} turned to ${res.data.placement.rotation}°`
    if (res.data.pickFace) message += `, pick face ${res.data.pickFace}`
    toast.success(message, res.data.shifted ? { description: "Shifted slightly to clear its neighbours." } : undefined)
    await refresh()
  }

  async function place(item: FloorItem, placement: Placement) {
    const res = await setPlacement(item.id, placement)
    if (!res.success) toast.error(res.error)
    await refresh()
  }

  // Everything a rack, dock or staging area has to keep clear of.
  const obstacles = (exceptId: string): Box[] => plan.items.filter((i) => i.id !== exceptId && !isArea(i.type)).map((i) => i.box)

  async function placeUnplaced(id: string) {
    const u = plan.unplaced.find((x) => x.id === id)!
    let size = { length: 2.8, depth: 1.2, rotation: 0 as const }
    if (DOCKS.includes(u.type)) size = { length: 3, depth: 5, rotation: 0 }
    if (u.type === "ZONE") size = { length: 10, depth: 8, rotation: 0 }
    if (u.type === "AISLE") size = { length: 2, depth: 10, rotation: 0 }
    const spot = findFreeSpot(size, floor!, obstacles(id), isArea(u.type))
    if (!spot) return toast.error("There’s no free space for it. Make room or enlarge the floor.")
    const res = await setPlacement(id, spot)
    if (!res.success) return toast.error(res.error)
    toast.success(`${u.code} placed`)
    setRackId(id)
    await refresh()
  }

  // Dropping a SKU on a rack picks a bin: one holding it, else the first empty pickable bin, else the first bin.
  function dropOnItem(item: FloorItem, data: string) {
    const [levelId, fromId] = data.split("|")
    if (!levelId || !fromId) return
    let toId = item.id
    if (item.type === "RACK" && item.levels) {
      const bins = item.levels.flatMap((l) => l.bins).filter((b) => b.isActive)
      const target =
        bins.find((b) => b.topSkus.some((s) => s.inventoryLevelId === levelId)) ??
        bins.find((b) => b.isPickable && b.stock.units === 0) ??
        bins[0]
      if (!target) return
      toId = target.id
    }
    if (toId !== fromId) setMoveStart({ fromId, levelId, toId })
  }

  /* ---------- Dragging the layout ---------- */

  function toSvg(e: React.PointerEvent) {
    const svg = svgRef.current!
    const p = svg.createSVGPoint()
    p.x = e.clientX
    p.y = e.clientY
    return p.matrixTransform(svg.getScreenCTM()!.inverse())
  }

  function pointerDown(e: React.PointerEvent, item: FloorItem) {
    if (!edit || e.button !== 0) return
    const p = toSvg(e)
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({
      item,
      offsetX: p.x - item.placement.centerX,
      offsetY: p.y - item.placement.centerY,
      centerX: item.placement.centerX,
      centerY: item.placement.centerY,
      moved: false,
      blocked: false,
    })
  }

  function pointerMove(e: React.PointerEvent) {
    if (!drag || !floor) return
    const p = toSvg(e)
    const centerX = snap(p.x - drag.offsetX)
    const centerY = snap(p.y - drag.offsetY)
    if (centerX === drag.centerX && centerY === drag.centerY) return
    // A preview only: the server has the final say on collisions.
    const area = isArea(drag.item.type)
    const next = boundingBox({ ...drag.item.placement, centerX, centerY }, area)
    const blocked = !fitsFloor(next, floor) || (!area && obstacles(drag.item.id).some((o) => overlaps(next, o)))
    setDrag({ ...drag, centerX, centerY, moved: true, blocked })
  }

  async function pointerUp() {
    if (!drag) return
    const d = drag
    setDrag(null)
    if (!d.moved) return selectItem(d.item)
    setRackId(d.item.id)
    await place(d.item, { ...d.item.placement, centerX: d.centerX, centerY: d.centerY })
  }

  function itemKey(e: React.KeyboardEvent, item: FloorItem) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      return selectItem(item)
    }
    if (!edit) return
    if ((e.key === "r" || e.key === "R") && !isArea(item.type) && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      return rotate(item, e.shiftKey ? "ccw" : "cw")
    }
    const nudge: Record<string, [number, number]> = { ArrowUp: [0, -0.5], ArrowDown: [0, 0.5], ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0] }
    if (nudge[e.key]) {
      e.preventDefault()
      const [dx, dy] = nudge[e.key]
      setRackId(item.id)
      place(item, { ...item.placement, centerX: item.placement.centerX + dx, centerY: item.placement.centerY + dy })
    }
  }

  // Shared props for anything on the floor: select, drag in edit mode, keyboard, and SKU drops.
  const itemProps = (item: FloorItem, text: string) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": text,
    onClick: () => !edit && selectItem(item),
    onKeyDown: (e: React.KeyboardEvent) => itemKey(e, item),
    onPointerDown: (e: React.PointerEvent) => pointerDown(e, item),
    onDragOver: (e: React.DragEvent) => {
      if (isArea(item.type)) return
      e.preventDefault()
      setDropTarget(item.id)
    },
    onDragLeave: () => setDropTarget(null),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      setDropTarget(null)
      dropOnItem(item, e.dataTransfer.getData("text/plain"))
    },
    transform: drag?.item.id === item.id ? `translate(${drag.centerX - item.placement.centerX} ${drag.centerY - item.placement.centerY})` : undefined,
    className: cn("outline-none", edit ? "cursor-grab touch-none" : "cursor-pointer", drag?.item.id === item.id && "cursor-grabbing opacity-85"),
  })

  const outline = (item: FloorItem, normal: string) => {
    if (drag?.item.id === item.id && drag.blocked) return "#C9372C"
    if (dropTarget === item.id) return "#EE8524"
    if (rackId === item.id || binId === item.id) return "#EE8524"
    return normal
  }

  /* ---------- Drawing ---------- */

  function drawZone(item: FloorItem) {
    const b = item.box
    return (
      <g key={item.id} {...itemProps(item, `Zone ${item.code}${item.name ? `, ${item.name}` : ""}`)} onClick={() => edit && selectItem(item)}>
        <rect x={b.x} y={b.y} width={b.width} height={b.height} rx={0.4} fill="rgba(28,90,164,.035)" stroke={outline(item, "#AFBDCB")} strokeWidth={rackId === item.id ? 0.14 : 0.07} strokeDasharray=".35 .22" />
        <text x={b.x + 0.5} y={b.y + 1.1} fontSize={0.95} fontWeight={700} fill="#7C8B9A">{item.code}</text>
        {item.name && <text x={b.x + 0.5 + item.code.length * 0.62 + 0.3} y={b.y + 1.05} fontSize={0.5} fill="#8D9AA8">{item.name}</text>}
      </g>
    )
  }

  function drawDock(item: FloorItem) {
    const b = item.box
    const hazard = item.type === "RECEIVING" || item.type === "PACKING"
    let sub = item.code
    if (item.stock.units) sub = `${n0(item.stock.units)} units${item.type === "PACKING" ? "" : " to put away"}`
    return (
      <g key={item.id} {...itemProps(item, `${item.name ?? item.code}: ${item.stock.units} units`)}>
        <rect
          x={b.x} y={b.y} width={b.width} height={b.height} rx={0.25}
          fill={item.type === "STAGING" ? "#FBFBFC" : "#fff"}
          stroke={outline(item, "#3A4754")} strokeWidth={rackId === item.id || binId === item.id ? 0.2 : 0.07}
          strokeDasharray={item.type === "STAGING" ? ".35 .22" : undefined}
        />
        {hazard && <rect x={b.x + 0.15} y={b.y + 0.15} width={Math.max(0, b.width - 0.3)} height={Math.max(0, b.height - 0.3)} rx={0.15} fill="none" stroke="url(#hazard)" strokeWidth={0.3} />}
        <text x={b.x + b.width / 2} y={b.y + b.height / 2 - 0.35} fontSize={0.48} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#14202B">
          {item.name ?? item.code}
        </text>
        <text x={b.x + b.width / 2} y={b.y + b.height / 2 + 0.45} fontSize={0.38} textAnchor="middle" dominantBaseline="central" fill="#667482">
          {sub}
        </text>
      </g>
    )
  }

  function drawRack(item: FloorItem) {
    const b = item.box
    const slots = item.slotCount ?? 1
    const rotation = item.placement.rotation
    const face = faceLine(b, rotation)
    const levelCount = item.levels?.length ?? 1
    // The plan is top-down, so the tag says how many levels the rack has.
    const tag = levelCount > 1 ? `${item.code} · ${levelCount}L` : item.code
    const tagW = Math.max(1.6, tag.length * 0.33 + 0.5)
    const tagY = rotation === 270 ? b.y + b.height + 0.23 : b.y - 0.95
    const cells = Array.from({ length: slots }, (_, i) => {
      const stats = slotStats(item, i)
      const hit = q !== "" && (item.levels ?? []).some((l) => l.bins.some((bin) => bin.slotIndex === i && bin.topSkus.some((s) => s.sku.toLowerCase().includes(q))))
      return { i, rect: slotRect(item.placement, i, slots), stats, hit }
    })
    return (
      <g key={item.id} {...itemProps(item, `Rack ${item.code}${item.name ? `, ${item.name}` : ""}, ${item.stock.units} units`)} className={cn(itemProps(item, "").className, "group/rack")}>
        {(rackId === item.id || dropTarget === item.id) && (
          <rect x={b.x - 0.35} y={b.y - 0.35} width={b.width + 0.7} height={b.height + 0.7} rx={0.4} fill="#EE8524" opacity={0.16} pointerEvents="none" />
        )}
        <rect
          x={b.x} y={b.y} width={b.width} height={b.height} rx={0.15}
          fill={item.isActive ? "#F7FAFD" : "url(#hatch)"}
          stroke={outline(item, "#1C5AA4")}
          strokeWidth={rackId === item.id || dropTarget === item.id ? 0.18 : 0.1}
          className="transition-[stroke-width] group-hover/rack:stroke-[0.16]"
        />
        {item.isActive &&
          cells.map(({ i, rect, stats, hit }) => {
            const value = metric(stats, colourMode)
            const t = value / max
            const big = Math.min(rect.width, rect.height) >= 0.95 && stats.units > 0
            return (
              <g key={i} opacity={q && !hit ? 0.18 : 1}>
                <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={value ? shade(colourMode, 0.12 + t * 0.88) : "#fff"} stroke={hit ? "#14202B" : value ? "#fff" : "#C8D3DE"} strokeWidth={hit ? 0.16 : 0.07} />
                {big && (
                  <text x={rect.x + rect.width / 2} y={rect.y + rect.height / 2} fontSize={0.6} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill={t > 0.55 ? "#fff" : "#14202B"} pointerEvents="none">
                    {stats.units}
                  </text>
                )}
                {slots > 1 && Math.min(rect.width, rect.height) >= 0.5 && (
                  <text x={rect.x + 0.1} y={rect.y + 0.12} fontSize={0.32} fontWeight={700} fill="#3A4754" opacity={0.75} dominantBaseline="hanging" pointerEvents="none">
                    {"ABCDEFGH"[i]}
                  </text>
                )}
              </g>
            )
          })}
        <line {...face} stroke="#EE8524" strokeWidth={0.14} strokeLinecap="round" strokeDasharray=".45 .25" />
        <g pointerEvents="none">
          <rect x={b.x + b.width / 2 - tagW / 2} y={tagY} width={tagW} height={0.72} rx={0.1} fill="#F5C518" stroke="#14202B" strokeWidth={0.06} />
          <text x={b.x + b.width / 2} y={tagY + 0.36} fontSize={0.5} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="#14202B">
            {tag}
          </text>
        </g>
        {edit && rackId === item.id && !drag && (
          <g
            role="button"
            tabIndex={0}
            aria-label="Rotate 90 degrees clockwise"
            className="cursor-pointer"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => (e.stopPropagation(), rotate(item, "cw"))}
          >
            <title>Rotate 90° clockwise (R)</title>
            <circle cx={b.x + b.width + 0.65} cy={b.y - 0.65} r={0.62} fill="#14202B" stroke="#fff" strokeWidth={0.08} />
            <path
              d={`M ${b.x + b.width + 0.35} ${b.y - 0.5} A 0.32 0.32 0 1 1 ${b.x + b.width + 0.9} ${b.y - 0.44} M ${b.x + b.width + 0.99} ${b.y - 0.68} L ${b.x + b.width + 0.92} ${b.y - 0.38} L ${b.x + b.width + 0.67} ${b.y - 0.5}`}
              fill="none" stroke="#fff" strokeWidth={0.09} strokeLinecap="round" strokeLinejoin="round"
            />
          </g>
        )}
      </g>
    )
  }

  function drawRoute() {
    if (mode !== "route" || !route?.start || !floor) return null
    const start = route.start
    const end = route.end ?? start
    const points = route.stops.map((s) => s.point).filter((p) => p !== null)
    // Walk along a corridor just north of the docks, or along the bottom of the floor without any.
    const lowestRack = Math.max(0, ...racks.map((r) => r.box.y + r.box.height))
    const dockTops = docks.map((d) => d.box.y).filter((y) => y > lowestRack)
    const corridor = dockTops.length ? Math.min(...dockTops) - 0.55 : floor.depth - 0.4
    const way = [start, { x: start.x, y: corridor }]
    for (const p of points) way.push({ x: p.x, y: corridor }, p, { x: p.x, y: corridor })
    way.push({ x: end.x, y: corridor }, end)
    return (
      <g aria-hidden pointerEvents="none">
        <path d={`M ${way.map((p) => `${p.x} ${p.y}`).join(" L ")}`} fill="none" stroke="#14202B" strokeWidth={0.13} strokeDasharray=".4 .22" strokeLinejoin="round" />
        <circle cx={start.x} cy={start.y} r={0.55} fill="#14202B" stroke="#fff" strokeWidth={0.09} />
        <text x={start.x} y={start.y} fontSize={0.52} fontWeight={700} fill="#fff" textAnchor="middle" dominantBaseline="central">S</text>
        {route.stops.map((s) =>
          s.point ? (
            <g key={s.sequence + s.inventoryLevelId}>
              <circle cx={s.point.x} cy={s.point.y} r={0.5} fill="#EE8524" stroke="#fff" strokeWidth={0.09} />
              <text x={s.point.x} y={s.point.y} fontSize={0.52} fontWeight={700} fill="#fff" textAnchor="middle" dominantBaseline="central">
                {s.sequence}
              </text>
            </g>
          ) : null
        )}
      </g>
    )
  }

  /* ---------- Panel ---------- */

  let panel: React.ReactNode
  if (edit) {
    panel = (
      <EditPanel
        plan={plan}
        selected={selected}
        onDone={() => setEdit(false)}
        onAddRack={() => setAddingRack(true)}
        onFloorSize={() => setSizing(true)}
        onRotate={(direction) => selected && rotate(selected, direction)}
        onRemove={setRemoving}
        onPlace={placeUnplaced}
        onResize={async (item, length, depth) => {
          const res = await setPlacement(item.id, { ...item.placement, length, depth })
          if (res.success) toast.success(`${item.code} is now ${length} × ${depth} m`)
          else toast.error(res.error)
          await refresh()
        }}
        onChanged={refresh}
      />
    )
  } else if (mode === "route") {
    panel = <RoutePanel orders={orders} orderId={orderId} route={route} onOrder={setOrderId} onStop={(id, inRack) => selectBin(id, inRack)} />
  } else if (rack) {
    const inRack = binId && (rack.levels ?? []).some((l) => l.bins.some((b) => b.id === binId))
    panel = (
      <RackPanel
        rack={rack}
        plan={plan}
        mode={mode}
        binId={binId}
        query={query}
        onBack={() => (setRackId(null), setBinId(null))}
        onSelectBin={setBinId}
        onRotate={(direction) => rotate(rack, direction)}
        onDropSku={(data, toBinId) => {
          const [levelId, fromId] = data.split("|")
          if (levelId && fromId && fromId !== toBinId) setMoveStart({ fromId, levelId, toId: toBinId })
        }}
      >
        {inRack ? (
          <BinDetail binId={binId} warehouseId={wid} version={version} onMove={setMoveStart} onCount={setCounting} onAddStock={(id, code) => setFillingBin({ id, code })} onChanged={refresh} />
        ) : (
          <p className="px-1 text-[13px] text-muted-foreground">Select a bin to see what’s in it.</p>
        )}
      </RackPanel>
    )
  } else if (binId) {
    panel = (
      <>
        <section className={box}>
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setBinId(null)}>
            <ChevronLeftIcon data-icon="inline-start" />
            Warehouse
          </Button>
        </section>
        <BinDetail binId={binId} warehouseId={wid} version={version} onMove={setMoveStart} onCount={setCounting} onAddStock={(id, code) => setFillingBin({ id, code })} onChanged={refresh} />
      </>
    )
  } else {
    panel = <OverviewPanel plan={plan} putAway={putAway} query={query} onSelectBin={selectBin} onMove={setMoveStart} />
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4 md:py-6 lg:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link href="/inventory/setup/warehouses" className="mb-1 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <ChevronLeftIcon className="size-3.5" />
            Warehouses
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Rack map</h1>
          <p className="text-sm text-muted-foreground">
            {plan.warehouse.name}
            {floor && ` · ${floor.width} × ${floor.depth} m floor`} · {racks.length} {racks.length === 1 ? "rack" : "racks"} · {plan.totals.binsTotal} bins
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a SKU on the map" className="h-9 bg-card pl-8" aria-label="Find a SKU on the map" />
        </div>
      </div>

      <nav aria-label="Warehouses" className="flex max-w-full gap-0.5 self-start overflow-x-auto rounded-xl bg-muted p-1">
        {warehouses.map((w) => (
          <Link
            key={w.id}
            href={`/inventory/setup/warehouses/${w.id}`}
            aria-current={w.id === wid ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
              w.id === wid && "bg-card text-foreground shadow-xs ring-1 ring-foreground/5"
            )}
          >
            <span className="font-mono text-xs font-bold">{w.code}</span>
            <span>{w.name}</span>
          </Link>
        ))}
      </nav>

      <div className="grid items-start gap-4 min-[1180px]:grid-cols-[minmax(0,1fr)_430px]">
        <section className="overflow-hidden rounded-2xl border bg-card" aria-label="Floor plan">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-3.5 py-3">
            <Tabs value={mode} onValueChange={(v) => (setMode(v as Mode), setEdit(false))}>
              <TabsList className="h-8 rounded-lg p-0.5">
                {MODES.map((m) => (
                  <TabsTrigger key={m.value} value={m.value} className="h-7 px-2.5 text-[13px] data-active:shadow-xs">
                    {m.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs whitespace-nowrap text-muted-foreground">
              {mode === "route" ? (
                <>
                  <span className="inline-flex items-center gap-1.5"><i className="inline-block w-5 border-t-2 border-dashed border-slate-800" />Walking route</span>
                  <span className="inline-flex items-center gap-1.5"><i className="grid size-4 place-items-center rounded-full bg-[#EE8524] text-[10px] font-bold text-white not-italic">1</i>Pick stop</span>
                  <span className="inline-flex items-center gap-1.5"><i className="grid size-4 place-items-center rounded-full bg-slate-800 text-[10px] font-bold text-white not-italic">S</i>Start and finish</span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    0
                    <i className="inline-block h-2 w-16 rounded-xs border" style={{ background: scaleGradient(mode) }} />
                    {formatMetric(maxMetric(plan, mode), mode)}
                  </span>
                  <span className="inline-flex items-center gap-1.5"><i className="inline-block w-5 border-t-[3px] border-dashed border-[#EE8524]" />Pick face</span>
                  <span className="inline-flex items-center gap-1.5"><i className="inline-block h-3 w-3.5 rounded-xs bg-[repeating-linear-gradient(45deg,#F5C518_0_3px,#14202B_3px_6px)]" />Dock</span>
                  <span className="inline-flex items-center gap-1.5"><i className="inline-block h-3 w-3.5 rounded-xs border bg-[repeating-linear-gradient(45deg,#EEF1F4_0_3px,#C8D1DA_3px_5px)]" />Inactive</span>
                </>
              )}
            </div>
            {floor && (
              <Button size="sm" variant={edit ? "default" : "outline"} aria-pressed={edit} onClick={() => (setEdit(!edit), mode === "route" && setMode("units"))}>
                <PencilRulerIcon data-icon="inline-start" />
                {edit ? "Editing layout" : "Edit layout"}
              </Button>
            )}
          </div>

          <div className="relative bg-slate-50/70 px-3 pt-2.5 pb-1.5">
            {floor && (
              <>
                <span aria-hidden className="pointer-events-none absolute top-3 right-4 flex flex-col items-center text-[10px] font-bold text-slate-500">
                  <span className="text-[13px] leading-none">↑</span>N
                </span>
                {/* 5 m at the plan's scale: the viewBox is the floor plus 1.2 m of margin. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-0.5 text-[10px] font-semibold text-slate-500"
                  style={{ width: `calc((100% - 1.5rem) * ${5 / (floor.width + 1.2)})` }}
                >
                  <span className="h-1.5 w-full border-x-2 border-b-2 border-slate-400" />5 m
                </span>
              </>
            )}
            {floor ? (
              <svg
                ref={svgRef}
                viewBox={`-0.6 -1.4 ${floor.width + 1.2} ${floor.depth + 2}`}
                className="block h-auto w-full select-none"
                style={{ fontFamily: "var(--font-sans)" }}
                role="group"
                aria-label={`Floor plan of ${plan.warehouse.name}`}
                onPointerMove={pointerMove}
                onPointerUp={pointerUp}
                onPointerCancel={() => setDrag(null)}
              >
                <defs>
                  <pattern id="grid" width="1" height="1" patternUnits="userSpaceOnUse">
                    <path d="M1 0H0V1" fill="none" stroke="#DDE3E9" strokeWidth="0.03" />
                  </pattern>
                  <pattern id="hazard" width="0.7" height="0.7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="0.35" height="0.7" fill="#F5C518" />
                    <rect x="0.35" width="0.35" height="0.7" fill="#14202B" />
                  </pattern>
                  <pattern id="hatch" width="0.5" height="0.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="0.5" height="0.5" fill="#EEF1F4" />
                    <rect width="0.2" height="0.5" fill="#D5DCE3" />
                  </pattern>
                </defs>
                <rect x={0} y={0} width={floor.width} height={floor.depth} rx={0.3} fill={edit ? "#FFFDF6" : "#fff"} stroke="#B8C3CE" strokeWidth={0.08} />
                <rect x={0} y={0} width={floor.width} height={floor.depth} fill="url(#grid)" pointerEvents="none" />
                {zones.map(drawZone)}
                {docks.map(drawDock)}
                {racks.map(drawRack)}
                {drawRoute()}
              </svg>
            ) : (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <strong>No floor plan yet</strong>
                <p className="max-w-sm text-[13px] text-muted-foreground">
                  Set the size of {plan.warehouse.name}’s floor first, then place its racks, docks and zones on it.
                </p>
                <Button size="sm" onClick={() => setSizing(true)}>Set floor size</Button>
              </div>
            )}
          </div>
          {floor && (
            <div className="flex flex-wrap justify-between gap-2 px-3.5 pt-2 pb-3 text-[12.5px] text-muted-foreground">
              <span>
                {plan.warehouse.name}, {floor.width} × {floor.depth} m floor
                {plan.items.length === 0 && ". Nothing is placed yet: use Edit layout."}
              </span>
              <span>
                {MODE_NOTE[mode]}
                {mode === "activity" && ` Last ${plan.activityDays} days.`}
              </span>
            </div>
          )}
        </section>

        <aside aria-label="Details" className="flex flex-col gap-3.5 min-[1180px]:sticky min-[1180px]:top-4 min-[1180px]:max-h-[calc(100dvh-2rem)] min-[1180px]:overflow-y-auto min-[1180px]:overscroll-contain">
          {panel}
        </aside>
      </div>

      {moveStart && (
        <MoveDialog
          key={`${moveStart.fromId}-${moveStart.levelId}-${moveStart.toId}`}
          plan={plan}
          start={moveStart}
          onClose={() => setMoveStart(null)}
          onDone={async (toId) => {
            setMoveStart(null)
            if (rack && (rack.levels ?? []).some((l) => l.bins.some((b) => b.id === toId))) setBinId(toId)
            await refresh()
          }}
        />
      )}
      {fillingBin && (
        <PutAwayPicker
          binCode={fillingBin.code}
          lines={putAway}
          onClose={() => setFillingBin(null)}
          onPick={(line) => {
            setFillingBin(null)
            setMoveStart({ fromId: line.locationId, levelId: line.inventoryLevelId, toId: fillingBin.id, makeDefault: true })
          }}
        />
      )}
      {counting && (
        <CountDialog
          contents={counting}
          onClose={() => setCounting(null)}
          onDone={async () => {
            setCounting(null)
            await refresh()
          }}
        />
      )}
      {addingRack && (
        <AddRackDialog
          warehouseId={wid}
          zones={zones.filter((z) => z.type === "ZONE")}
          onClose={() => setAddingRack(false)}
          onDone={async (newRack) => {
            setAddingRack(false)
            setRackId(newRack.id)
            await refresh()
          }}
        />
      )}
      {sizing && (
        <FloorSizeDialog
          plan={plan}
          onClose={() => setSizing(false)}
          onDone={async () => {
            setSizing(false)
            await refresh()
          }}
        />
      )}
      {removing && (
        <RemoveDialog
          item={removing}
          onClose={() => setRemoving(null)}
          onDone={async () => {
            setRemoving(null)
            setRackId(null)
            await refresh()
          }}
        />
      )}
    </div>
  )
}
