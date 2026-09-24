@AGENTS.md

# Ecommerce Admin

An admin dashboard for an online store: orders, products, catalog and analytics. It started from the shadcn `dashboard-01`, `login-02` and `signup-02` blocks and was then customized.

**It is a UI demo.** All data is in-memory mock data and nothing is saved. Actions such as Save, Ship, Refund and Delete update React state and show a toast, but a refresh resets them. There is no auth and no backend yet.

## Stack

- **Next.js 16** (App Router, Turbopack). Its APIs differ from older versions, so read `node_modules/next/dist/docs/` before using a Next API (see AGENTS.md).
  - `params` is a Promise: `await params`.
  - Type pages and layouts with the global helpers `PageProps<"/route">` and `LayoutProps<"/route">`.
  - Run `npx next typegen` after adding or moving routes, or `tsc` reports stale route types.
- **React 19**, **TypeScript**, **Tailwind CSS v4**. There is no `tailwind.config`; the theme lives in `app/globals.css`.
- **shadcn/ui on Base UI** (`@base-ui/react`), not Radix:
  - Compose with the `render` prop, e.g. `<DropdownMenuTrigger render={<Button />}>`, not `asChild`.
  - A `Button` rendered as a link needs `nativeButton={false}`: `<Button nativeButton={false} render={<Link href="..." />}>`.
  - A `Select` needs an `items` prop (`{label, value}[]`), or the trigger shows the raw value instead of the label.
  - Collapsible panel state is exposed as the `data-panel-open` attribute.
- **Other libraries:** `@tanstack/react-table` v9 (only in `components/data-table.tsx`), `recharts` through `components/ui/chart.tsx`, `sonner` for toasts, `lucide-react` for icons, `zod`, `@dnd-kit`.
- `cn` comes from the `cn` npm package, re-exported by `lib/utils.ts`.
- Add shadcn components with `npx shadcn@latest add <name> --yes`.

## Structure

```
app/
├── layout.tsx            root: Inter font, TooltipProvider, Toaster
├── page.tsx              redirects to /dashboard
├── (admin)/              route group: sidebar + breadcrumb layout, not in the URL
│   ├── layout.tsx
│   ├── dashboard/        /dashboard
│   ├── orders/           /orders, /orders/{pending,returns,abandoned}, /orders/[id]
│   └── products/         /products, /products/new, /products/[id]/edit,
│                         /products/{categories,brands,attributes}
└── (auth)/               route group: split-screen layout, no sidebar
    ├── login/            /login
    └── signup/           /signup
```

- **New admin section** (e.g. Customers or Analytics): add `app/(admin)/<name>/page.tsx` and it inherits the sidebar and breadcrumb. Then add or update its entry in `navMain` in `components/app-sidebar.tsx`.
- **Sidebar menu:** `components/app-sidebar.tsx` holds the data. `components/nav-main.tsx` renders collapsible groups; an entry with `items` becomes an expandable sub-menu, and a sub-item can have a `badge`.
- **Breadcrumb:** `components/site-header.tsx` builds it from the URL. Add labels for new path segments to its `labels` map. Numeric IDs render as `#3204`, and slugs are title-cased.
- **Demo data:** everything is in `lib/demo-data.ts` (types, products, categories, brands, attributes, returns, abandoned carts, `currency`, `formatDate`). Orders come from `lib/data/orders.json`. Replace this module when a real backend arrives.
- **List pages** use the generic client component `components/list-table.tsx` (search, filter tabs, pagination). Pass it `columns` with `cell` functions. Functions can't cross the server-to-client boundary, so each list lives in its own client component (`components/orders/*`, `components/products/*`), and `page.tsx` stays a server component that passes data in.
- **Brands** (`/products/brands`) is the reference pattern for schema-aligned pages: the `Brand` type in `lib/demo-data.ts` mirrors the Prisma model (ISO date strings, `_count.products`), `lib/validations/brand.ts` holds the zod schema, and `components/brands/` holds the manager, the add/edit form (a side panel), and the delete confirmation. New records get IDs from `uuidv7()` in `lib/uuid.ts`. Follow this pattern when aligning other pages with the backend schema.
- **Shared UI:** `page-header.tsx`, `stat-cards.tsx`, `status-badge.tsx` (maps order, product and return statuses to icons).
- The dashboard's big orders table (`components/data-table.tsx`) is the original shadcn block adapted to orders: drag to reorder, and a detail drawer.

## Design conventions

- **Brand color is blue** (`--primary: #256abf` light, `#3987e5` dark), set in `app/globals.css`. The sidebar and page background are a cool gray.
- **Auth pages use black buttons.** `app/(auth)/layout.tsx` overrides `--primary` to `--foreground` for the form area only. Keep that scoped.
- **Charts** use the validated categorical palette in `--chart-1` … `--chart-5` (blue, orange, aqua, yellow, magenta). Assign them in that order and don't cycle.
  - Two series: `chart-1` and `chart-2`.
  - Lines 2px, area fill about 10% opacity, bars at most 24px thick with 4px rounded ends.
  - Two or more series always get a legend.
  - Text is never colored with the series color.
- Status colors (green or red trend badges) always come with an icon and a label.
- Dark mode works through the `.dark` class. There is no theme toggle yet.

## Commands

```bash
npm run dev          # dev server
npm run build        # production build (also type-checks)
npx tsc --noEmit     # type-check only
npx next typegen     # regenerate route types after adding/moving routes
```

`npm run lint` is currently **broken**: `package.json` pins `eslint@^10`, and the `eslint-plugin-react` bundled with `eslint-config-next` doesn't support it yet (`getFilename is not a function`). Downgrading to `eslint@^9` fixes it.

## Not built yet

- Customers and Analytics pages. The sidebar links to them, but they return 404.
- Real authentication (no provider chosen yet) and middleware to protect the `(admin)` routes.
- Persistence: a database or API.
- A theme toggle.
