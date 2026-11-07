// Demo store traffic until the storefront records visits (there's no tracking endpoint yet).
// Seeded, so the numbers stay the same on every load; replace with an API call when one exists.

const DAY = 86_400_000

export const SOURCES = ["Direct", "Facebook", "Google search", "Instagram", "Google Ads", "Email", "Referral"] as const
export const DEVICES = ["Mobile", "Desktop", "Tablet"] as const
export const DISTRICTS = ["Dhaka", "Chattogram", "Gazipur", "Narayanganj", "Sylhet", "Khulna", "Rajshahi", "Rangpur"] as const
export const PAGES = [
  { path: "/", title: "Home" },
  { path: "/products", title: "All products" },
  { path: "/category/watches", title: "Watches" },
  { path: "/category/smartphones", title: "Smartphones" },
  { path: "/cart", title: "Cart" },
  { path: "/checkout", title: "Checkout" },
  { path: "/offers/eid-sale", title: "Eid sale" },
  { path: "/category/fashion", title: "Fashion" },
] as const

export const BROWSERS = ["Chrome", "Facebook app", "Safari", "Samsung Internet", "Opera Mini", "Other"] as const
// What shoppers typed in the store search; `found` false = the search showed no products.
export const SEARCHES = [
  { term: "watch", found: true },
  { term: "iphone", found: true },
  { term: "panjabi", found: false },
  { term: "sunglasses", found: true },
  { term: "saree", found: false },
  { term: "airpods", found: false },
  { term: "shoes", found: true },
  { term: "honey", found: true },
] as const
export const CAMPAIGNS = ["Eid sale · Facebook", "11.11 · Google Ads", "New arrivals · Instagram", "Winter sale · Email"] as const
export const DEPTHS = ["1 page", "2–3 pages", "4–6 pages", "7+ pages"] as const
export const TIMES = ["Under 10s", "10–30s", "30s–2m", "2–5m", "5m+"] as const

export type TrafficDay = {
  at: string
  visitors: number
  newVisitors: number
  sessions: number
  pageViews: number
  bounces: number
  seconds: number // total time on site, for the average
  productViews: number
  carts: number
  checkouts: number
  orders: number
  revenue: number
  sources: number[] // sessions per SOURCES entry
  sourceOrders: number[]
  devices: number[] // sessions per DEVICES entry
  districts: number[] // visitors per DISTRICTS entry
  pages: number[] // views per PAGES entry
  hours: number[] // sessions per hour of day
  newOrders: number // orders from first-time visitors
  deviceOrders: number[] // orders per DEVICES entry
  exits: number[] // sessions that ended on each PAGES entry
  browsers: number[] // sessions per BROWSERS entry
  searches: number[] // searches per SEARCHES entry
  campaignSessions: number[] // per CAMPAIGNS entry
  campaignOrders: number[]
  depth: number[] // sessions per DEPTHS bucket
  time: number[] // sessions per TIMES bucket
}

// Small seeded random generator (mulberry32), so a day always gets the same numbers.
function random(seed: number) {
  let t = seed + 0x6d2b79f5
  return () => {
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Split a total by weights, with a little noise, keeping the sum exact.
function split(total: number, weights: readonly number[], rnd: () => number) {
  const noisy = weights.map((w) => w * (0.8 + rnd() * 0.4))
  const sum = noisy.reduce((s, w) => s + w, 0)
  const parts = noisy.map((w) => Math.floor((w / sum) * total))
  parts[0] += total - parts.reduce((s, p) => s + p, 0)
  return parts
}

// Evenings and lunch are busy, nights quiet: a typical Bangladeshi shopping day.
const HOUR_WEIGHTS = [3, 2, 1, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 6, 7, 8, 9, 11, 12, 12, 9, 5]

export function trafficDays(days = 420): TrafficDay[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const list: TrafficDay[] = []
  for (let i = days - 1; i >= 0; i--) {
    const at = new Date(today.getTime() - i * DAY)
    const rnd = random(Math.floor(at.getTime() / DAY))
    // Slow growth over the year, busier Fridays and weekends, and the odd campaign spike.
    const growth = 1 + (days - i) / days
    const weekday = [1.15, 0.9, 0.95, 0.95, 1, 1.3, 1.2][at.getDay()]
    const spike = rnd() > 0.96 ? 1.8 + rnd() : 1
    const visitors = Math.round(320 * growth * weekday * spike * (0.85 + rnd() * 0.3))
    const sessions = Math.round(visitors * (1.18 + rnd() * 0.12))
    const productViews = Math.round(sessions * (0.55 + rnd() * 0.1))
    const carts = Math.round(productViews * (0.11 + rnd() * 0.04))
    const checkouts = Math.round(carts * (0.45 + rnd() * 0.1))
    const orders = Math.round(checkouts * (0.5 + rnd() * 0.15))
    const sourceSessions = split(sessions, [26, 30, 16, 12, 9, 4, 3], rnd)
    const deviceSessions = split(sessions, [74, 21, 5], rnd)
    const bounces = Math.round(sessions * (0.38 + rnd() * 0.08))
    const campaignSessions = split(Math.round(sessions * 0.22), [40, 25, 22, 13], rnd)
    // Ads and email convert better than social browsing.
    const sourceRates = [1, 0.7, 1.1, 0.6, 1.4, 1.8, 0.9]
    list.push({
      at: at.toISOString(),
      visitors,
      newVisitors: Math.round(visitors * (0.58 + rnd() * 0.1)),
      sessions,
      pageViews: Math.round(sessions * (3.2 + rnd() * 0.8)),
      bounces,
      seconds: Math.round(sessions * (140 + rnd() * 60)),
      productViews,
      carts,
      checkouts,
      orders,
      revenue: Math.round(orders * (2_800 + rnd() * 2_400)),
      sources: sourceSessions,
      sourceOrders: split(orders, sourceSessions.map((s, k) => s * sourceRates[k]), rnd),
      devices: deviceSessions,
      // Desktop shoppers convert better; phones browse more.
      deviceOrders: split(orders, deviceSessions.map((v, k) => v * [0.8, 1.7, 1.1][k]), rnd),
      // Returning visitors are fewer but buy more often.
      newOrders: Math.round(orders * (0.35 + rnd() * 0.1)),
      exits: split(sessions, [22, 14, 8, 8, 18, 9, 11, 10], rnd),
      browsers: split(sessions, [52, 18, 11, 9, 6, 4], rnd),
      searches: split(Math.round(sessions * 0.17), [22, 18, 12, 11, 9, 8, 12, 8], rnd),
      campaignSessions,
      campaignOrders: split(Math.round(orders * 0.27), campaignSessions.map((v, k) => v * [1.2, 1.5, 0.7, 1.9][k]), rnd),
      depth: [bounces, ...split(sessions - bounces, [45, 35, 20], rnd)],
      time: split(sessions, [30, 18, 24, 18, 10], rnd),
      districts: split(visitors, [46, 14, 9, 7, 6, 6, 5, 7], rnd),
      pages: split(Math.round(sessions * 3.4), [30, 18, 9, 9, 7, 4, 8, 6], rnd),
      hours: split(sessions, HOUR_WEIGHTS, rnd),
    })
  }
  return list
}
