// UUID v7 (time-ordered), matching Prisma's `@default(uuid(7))`. Used for
// optimistic client-side records until a real API assigns IDs.
export function uuidv7() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const time = BigInt(Date.now())
  for (let i = 0; i < 6; i++) {
    bytes[i] = Number((time >> BigInt(8 * (5 - i))) & BigInt(0xff))
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
