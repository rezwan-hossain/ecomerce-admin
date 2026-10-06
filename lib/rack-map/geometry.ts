// Floor-plan geometry, ported from the backend (src/modules/inventory/floor-plan/geometry.ts) so
// previews match what the server will accept. Metres; origin north-west, x east, y south, rotation clockwise.
//
//   rotation | box width × height | pick face | slot A at
//        0   | depth × length     | east      | north end
//       90   | length × depth     | south     | east end
//      180   | depth × length     | west      | south end
//      270   | length × depth     | north     | west end

import type { Box, Face, MapLocationType, Placement, Rotation } from "@/types/rack-map.type"

export const CLEARANCE = 0.5 // between racks, docks and staging areas
export const SLOT_INSET = 0.2
export const SNAP = 0.5
const EPS = 1e-9

export const round2 = (n: number) => Math.round(n * 100) / 100
export const snap = (n: number, step = SNAP) => round2(Math.round(n / step) * step)

// Zones and aisles are drawn as plain areas: no rotation, no pick face, and they may overlap anything.
export const isArea = (type: MapLocationType) => type === "ZONE" || type === "AISLE"

export function boundingBox(p: Placement, area = false): Box {
  let width = p.length
  let height = p.depth
  if (!area && (p.rotation === 0 || p.rotation === 180)) {
    width = p.depth
    height = p.length
  }
  return { x: round2(p.centerX - width / 2), y: round2(p.centerY - height / 2), width, height }
}

export function pickFace(rotation: Rotation): Face {
  const faces: Record<Rotation, Face> = { 0: "east", 90: "south", 180: "west", 270: "north" }
  return faces[rotation]
}

const A_END: Record<Rotation, Face> = { 0: "north", 90: "east", 180: "south", 270: "west" }
export const facingText = (rotation: Rotation) => `Pick face ${pickFace(rotation)}, slot A at the ${A_END[rotation]} end`

// The slot column for `slotIndex` (0 = A), inset from the rack outline, in the rotation's slot order.
export function slotRect(p: Placement, slotIndex: number, slotCount: number): Box {
  const box = boundingBox(p)
  const inner = {
    x: box.x + SLOT_INSET,
    y: box.y + SLOT_INSET,
    width: Math.max(0, box.width - 2 * SLOT_INSET),
    height: Math.max(0, box.height - 2 * SLOT_INSET),
  }
  const alongY = p.rotation === 0 || p.rotation === 180
  const size = (alongY ? inner.height : inner.width) / slotCount
  const fromStart = p.rotation === 0 || p.rotation === 270 ? slotIndex : slotCount - 1 - slotIndex
  const rect = alongY
    ? { x: inner.x, y: inner.y + fromStart * size, width: inner.width, height: size }
    : { x: inner.x + fromStart * size, y: inner.y, width: size, height: inner.height }
  return { x: round2(rect.x), y: round2(rect.y), width: round2(rect.width), height: round2(rect.height) }
}

// A segment just outside the pick face, where the picker stands.
export function faceLine(box: Box, rotation: Rotation, offset = 0.14) {
  const { x, y, width: w, height: h } = box
  if (rotation === 0) return { x1: x + w + offset, y1: y + 0.3, x2: x + w + offset, y2: y + h - 0.3 }
  if (rotation === 180) return { x1: x - offset, y1: y + 0.3, x2: x - offset, y2: y + h - 0.3 }
  if (rotation === 90) return { x1: x + 0.3, y1: y + h + offset, x2: x + w - 0.3, y2: y + h + offset }
  return { x1: x + 0.3, y1: y - offset, x2: x + w - 0.3, y2: y - offset }
}

// True when closer than `clearance`; exactly `clearance` apart is fine.
export function overlaps(a: Box, b: Box, clearance = CLEARANCE) {
  return (
    a.x < b.x + b.width + clearance - EPS &&
    b.x < a.x + a.width + clearance - EPS &&
    a.y < b.y + b.height + clearance - EPS &&
    b.y < a.y + a.height + clearance - EPS
  )
}

export function fitsFloor(box: Box, floor: { width: number; depth: number }) {
  return box.x >= -EPS && box.y >= -EPS && box.x + box.width <= floor.width + EPS && box.y + box.height <= floor.depth + EPS
}

// First free spot, scanning north → south and west → east in 0.5 m steps, `margin` metres in from the walls.
export function findFreeSpot(
  size: { length: number; depth: number; rotation: Rotation },
  floor: { width: number; depth: number },
  obstacles: Box[],
  area = false,
  margin = 1
): Placement | null {
  const probe = boundingBox({ ...size, centerX: 0, centerY: 0 }, area)
  for (let y = margin; y + probe.height <= floor.depth - margin + EPS; y += SNAP) {
    for (let x = margin; x + probe.width <= floor.width - margin + EPS; x += SNAP) {
      const candidate = { ...size, centerX: round2(x + probe.width / 2), centerY: round2(y + probe.height / 2) }
      const box = boundingBox(candidate, area)
      if (area || !obstacles.some((o) => overlaps(box, o))) return candidate
    }
  }
  return null
}
