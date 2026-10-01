// <input type="datetime-local"> works in local time without a zone ("2026-10-01T09:30");
// the API wants ISO datetimes.

export function toLocalInput(iso: string | null) {
  if (!iso) return ""
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null
}

