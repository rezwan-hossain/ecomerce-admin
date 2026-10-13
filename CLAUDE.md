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
│   ├── shipping/         /shipping
│   └── products/         /products, /products/new, /products/[id]/edit,
│                         /products/{categories,brands,tags,options,variant-templates}
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
- **Categories** (`/products/categories`) is **connected to the real NestJS backend** (the other pages still use demo data).
  - `page.tsx` (server, `await connection()`) loads `GET /categories/tree` through `getCategoryTree()`.
  - `app/actions/category.actions.ts`: server actions return `{ success, data }` or `{ success: false, error, fieldErrors }`, and call `revalidatePath("/products/categories")`.
  - `lib/api.ts`: the fetch helper. It throws `ApiError` with `fieldErrors`.
  - `types/category.type.ts`: the API shapes. Tree nodes have `children?` and `_count.products`.
  - `components/categories/`:
    - `categories-manager.tsx` holds state (`useState`) and calls the actions, then `refresh()`es the tree.
    - `category-form.tsx` owns its own `useForm` + zod schema.
    - `category-tree.tsx` and `category-tree-row.tsx`: drop on a row = make it the last child; the drop zone = top level.
    - `category-dialogs.tsx`.
  - `lib/categories/tree-utils.ts`: `flattenTree`, `validateMove` (cycles, depth `MAX_DEPTH = 4`, inactive parent), `buildPath`, `slugify`.
  - Backend rules: `DELETE /:id` only works on an empty category (no children, no products). `/cascade` deletes the whole subtree. `/move` takes `{ newParentId, position }`.
- **Tags** (`/products/tags`) is also connected to the backend (`/tags` API). Files: `app/actions/tag.actions.ts`, `types/tag.type.ts`, `components/tags/tags-manager.tsx` (styled like Brands: stat cards, `ListTable` with tabs, search, sort and a row menu, and a delete dialog), and `components/tags/tag-form-sheet.tsx` (a side-panel add/edit form). Both action files share `handleRequest` / `ActionResponse` from `lib/action-response.ts`.
- **Options** (`/products/options`, replaces the old demo Attributes page) is connected to the backend (`/options` API). Files: `app/actions/option.actions.ts` (options and their values), `types/option.type.ts`, `components/options/options-manager.tsx` (Tags-style list), and `components/options/option-form-sheet.tsx`. A new option's name and values are created together. On an existing option, value changes save right away and the name saves with "Save name".
- **Variant Templates** (`/products/variant-templates`) is connected to the backend (`/variant-templates` API). Files: `app/actions/variant-template.actions.ts`, `types/variant-template.type.ts`, `components/variant-templates/variant-templates-manager.tsx` (list, shows how many variants each template makes), and `components/variant-templates/template-form-sheet.tsx` (pick options, then toggle their values). `page.tsx` also loads `getOptions()` for the form. A PATCH with `options` replaces all of them.
- **All Products** (`/products`) is connected to the backend. `getProducts()` in `app/actions/product.actions.ts` walks `GET /products` 100 at a time. `components/products/products-table.tsx` shows the stat cards and the list. Row actions are Publish, Archive and Unarchive (`PATCH /products/:id/{publish,archive,unarchive}`; unarchive goes back to Draft) and Delete (a soft delete). Clicking the name (or "View details" in the row menu) opens the product page; Edit opens `/products/[id]/edit`. `types/product.type.ts` has the list row, detail and update shapes.
- **Orders** (`/orders` and `/orders/pending`) are connected to the backend. `getOrders()` in `app/actions/order.actions.ts` walks `GET /orders` 100 at a time; rows include `items`, `payments` and `shipments` (`types/order.type.ts`). `components/orders/orders-table.tsx` maps the 10 order statuses to labels and shows the stat cards in the "all" mode. Pending = PENDING, CONFIRMED, PROCESSING or READY_TO_SHIP. The order number links to the order page.
- **Order page** (`/orders/[id]`, `components/orders/order-detail.tsx`) loads `GET /orders/:id` (wrapped in `{ data }`; `OrderDetail` in `types/order.type.ts`), each item's product image (order items are snapshots without images), each variant's stock (`getVariantStock`), the order's ledger rows (`getReferenceMovements`, `/inventory/movements?referenceId=`) and the customer's other orders (all orders matched by email; the API can't filter by customer). It shows a progress stepper (or a cancelled banner with the reason), KPIs (total, paid, discount, cost of goods and margin from unit cost, customer orders, shipments), items with promotions plus available stock and the default pick rack per warehouse, totals with paid and balance due, shipments, stock movements, the status timeline (`statusLogs`), the customer with history, addresses (billing is hidden when it matches shipping), payments, refund requests and details. Actions in `order.actions.ts`: the next status on the happy path (`PATCH /orders/:id/status`, following the backend's `ORDER_STATUS_TRANSITIONS`; shipping commits reserved stock and cancelling releases it), Cancel with a required reason (`PATCH /:id/cancel`), Mark as paid or failed (`PATCH /:id/payments/:paymentId/{paid,failed}`), Add shipment (`POST /:id/shipments`: `carrier` is required and one of PATHAO, REDX, STEADFAST, CARRYBEE; blanks left out; COD amount defaults to the balance due), a per-shipment status select (`PATCH /:id/shipments/:shipmentId`; DELIVERED, CANCELLED and RETURNED are final), and refunds (`POST /:id/refund-requests` up to the paid amount not yet requested, then `PATCH /orders/refund-requests/:id/{approve,reject,process}`; processing marks the payment refunded and a full refund moves the order to REFUNDED). Items also show stock held for this order (the variant's `activeReservations` matched by order number), and Print uses `window.print()`. No `actedBy` is sent yet. Returns, Abandoned carts and the dashboard still use demo data; demo return rows no longer link to an order.
- **Shipping** (`/shipping`, the sidebar's Store › Shipping) is built from the orders API; the backend has no shipping zones or rates, only shipments on orders. `page.tsx` loads every order (`getOrders()`, whose rows include full shipments) and fetches the detail of orders waiting to ship for their destination city (the list has no addresses). `components/shipping/shipping-board.tsx` shows KPIs (to pack, ready to hand over, on the road, delivered in 30 days with average days, cash to collect on delivery, failed or returned), a parcel pipeline (booked → picked up → in transit → out for delivery → delivered, plus failed or returned), "Needs attention" (ready orders with no parcel, orders waiting over 2 days to pack, parcels not picked up after a day, parcels on the road over 3 days, failed or returned parcels; each links to its order), cash on delivery (to collect, held by couriers = delivered but the order's payment isn't marked paid, settled), 30-day shipping costs (order `shippingAmount` charged to customers against shipment `shippingAmount` paid to couriers), one card per courier (Pathao, RedX, Steadfast, CarryBee: parcels, delivery rate, on the road, delivered, cash to collect, average delivery time), the fulfilment queue (CONFIRMED, PROCESSING and READY_TO_SHIP orders, oldest first, with destination, COD or paid, parcel and wait time) and every shipment with an inline status select (`updateShipmentStatus`). Parcels are booked from the order page's Add shipment. `Shipment` in `types/order.type.ts` is shared by the list and detail types; the courier labels and shipment status helpers are exported from `order-detail.tsx`.
- **Inventory** follows the user's "Haat operations" HTML mockup. The sidebar's Store section links to it, and `app/(admin)/inventory/layout.tsx` adds a grouped section nav (`components/inventory/inventory-nav.tsx`: Stock, Operations, Planning).
  - **Live (the backend's `/inventory` API):**
    - Overview `/inventory` (`inventory-overview.tsx`, a server component): summary KPIs, recent movements, low/out-of-stock list, ledger balance checks, and per-warehouse totals.
    - Products `/inventory/products` (`product-shelf.tsx` + `product-stock-sheet.tsx`), from the user's "Stockroom Light" example: a card per product (from `getProducts()` joined with `getStock()` by product id) showing each variant's sellable stock; a toggle switches between a list (`ProductList`, one table row per product, the default) and the cards; both page 12 products at a time. A card opens a drawer with brand, category and tag chips, three actions (Edit product, Add stock, Order from supplier, which links to Purchase orders), stats, a variant × warehouse grid and recent movements (`getProductMovements` fetches per variant and merges, since the ledger only filters by variant). A grid cell opens `stock-history-sheet.tsx` for that variant. "Add stock" posts many variants × warehouses at once to `POST /inventory/adjustments/bulk` (`bulkAdjustStock`, all or nothing). "New product" and "Edit product" link to the existing product pages.
    - Stock levels `/inventory/stock` (`stock-manager.tsx`): all warehouses (Available sums every level; Storefront is `v.stock`, what shoppers see), or one warehouse with default rack, unit cost and status. The detail panel (`stock-history-sheet.tsx`) shows per-warehouse rows, the rack split with a default-rack picker (`PATCH .../default-location`), holds and recent movements. Actions open `stock-sheet.tsx` (adjust, count, move between racks, low-stock threshold).
    - Movements `/inventory/movements` (`movements-table.tsx`, latest 500) and Racks `/inventory/setup/racks` (`locations-manager.tsx` + `location-form-sheet.tsx`).
    - `app/actions/inventory.actions.ts`, `types/inventory.type.ts`.
    - Adjustments, counts and moves write permanent ledger rows. Rack create rejects `null`; update accepts it.
  - **Suppliers** `/inventory/setup/suppliers` is live (`/suppliers` API): `app/actions/supplier.actions.ts`, `types/supplier.type.ts`, and `Suppliers` + `SupplierSheet` in `setup.tsx`. There's no delete; a supplier is retired with `isActive: false`. Blank optional fields are sent as undefined (the API rejects `""` for contactEmail and website), so a saved email or website can't be cleared from the form. The demo pages (rules, batches) still use the demo suppliers.
  - **Warehouses** `/inventory/setup/warehouses` is live (`/inventory/warehouses` API): `app/actions/warehouse.actions.ts`, `types/warehouse.type.ts`, and `Warehouses` + `WarehouseSheet` + `StockCard` in `setup.tsx`. Responses are `{ data }` (lists `{ data, meta }`); `counts.stockValue`, `unitCost` and `totalCost` are decimal strings. The list shows KPIs and live counts; racks are matched by `warehouse.id`. The drawer edits everything but `code` (fixed after create), validates like the API (name 2–100, code `A-Z0-9-` 2–20, priority 0–1000), and asks before a change that adds or removes the warehouse's stock from the storefront (active PHYSICAL/STORE only). There's always one default and it must stay active: the default switch is locked on the default warehouse, so ticking it on another moves it. Delete is for unused warehouses only; a 409 "Deactivate it instead" toast offers a Deactivate action. `StockCard` pages `GET /:id/stock` 20 at a time with search. API errors show as toasts with the API's message.
  - **Purchase orders** `/inventory/purchase-orders` is live (`/purchase-orders` API): `app/actions/purchase-order.actions.ts`, `types/purchase-order.type.ts`, and `purchase-orders.tsx` (list with KPIs, `PoSheet`, its own `VariantSelect` and PO `ReceiveDialog`). `page.tsx` loads every PO (100 a page; tabs and search filter in the browser), suppliers, active warehouses, every variant (from `getStock()`, for the line picker) and racks (for put-away). Responses are `{ data }` / `{ data, meta }`; money arrives as decimal strings and is sent as numbers. Opening a PO fetches it with its lines; every write answers with the whole PO, which the sheet then shows. The sheet shows a status stepper (Drafted → Sent → Confirmed → Receiving → Received → Closed; a draft or cancelled order gets a banner instead), the supplier with contact and terms, the expected date with "due in" or "late", a received strip (ordered, received, damaged, still due, value received) and a progress bar per line.
    - Drafts are edited in a form (`toForm`/`toDto`): lines send `variantId` and `warehouseId` (each variant once per warehouse), and PATCH with `items` replaces every line. The form shows an estimated total; saved totals come from the server. "Submit to supplier" saves the draft first, then submits.
    - Buttons by status: DRAFT Save, Submit, Delete (with a confirm), Cancel; SUBMITTED Mark confirmed, Receive, Cancel; CONFIRMED Receive, Cancel; PARTIAL Receive, Close short; RECEIVED Close; CANCELLED/CLOSED read-only. A "can't be …" error refetches the PO.
    - Receive sends only lines with units: good and damaged (≤ the line's `outstandingQty`), an optional rack (default rack otherwise), batch number and expiry, plus an invoice reference and note. It's all or nothing; good units go into stock at the line's unit cost (updating the average cost) and incoming drops.
  - **Demo data (no API yet):** transfers, adjustment approvals, batches, reservations, alerts and reorder rules. Their warehouse pickers (`WarehouseSelect` in `doc-bits.tsx`) still use `DEMO_WAREHOUSES`. The data is in `lib/inventory-demo.ts` (real warehouse codes and SKUs). Each page shows a `DemoNote`, and state lives in `useState`, so changes reset on refresh.
    - Files: `transfers.tsx`, `adjustments.tsx` (list + `DocSheet` with a draft editor and status workflow), `batches-reservations.tsx`, `planning.tsx` (alerts, reorder rules), and `setup.tsx` (warehouses, suppliers).
    - Shared pieces: `doc-bits.tsx` (`DocSheet`, demo item and warehouse selects, the demo `ReceiveDialog`, `Progress`, `statusFilters`) and `inventory-ui.tsx` (`StockMeter`, `RackTag` yellow shelf labels, `WarehouseTag`, `Pill`/`StatusPill`, `Kpis`, `DemoNote`, formatters).
    - Replace each demo list with an API call once its endpoint exists.
  - **Setup** (a folder inside the sidebar's Inventory group, not in the section nav; `nav-documents.tsx` lets a sub-item have its own `items`, one level deep): Warehouses `/inventory/setup/warehouses`, Racks `/inventory/setup/racks` and Suppliers `/inventory/setup/suppliers`. The pages live in `app/(admin)/inventory/setup/` (so they share the inventory layout and tab bar), the components are in `components/inventory/`, and `/inventory/setup` redirects to Warehouses. A warehouse's panel lists its racks in tree order; "Add location" and the pencil open `LocationFormSheet` and save through the racks API.
  - **Warehouse page** `/inventory/setup/warehouses/[warehouseId]` (`components/inventory/warehouse-detail.tsx`): clicking a warehouse name in the list opens it. `page.tsx` loads the warehouse (`getWarehouseById`), its floor-plan totals, racks, every variant's level there (from `getStock()`), the latest 100 movements (`getWarehouseMovements`, `/inventory/movements?warehouseId=`) and the put-away queue (`getPutAway`). It shows a header with a type icon and status pills, KPIs (units, value, SKUs, racks and bins in use, units to put away, needs attention), stock health (unit split meter, healthy vs low SKUs, share of units on racks), the last 30 days (units in and out, movement types; summed from those 100 rows), low and out-of-stock SKUs (only for warehouses that sell), the paged `StockCard`, recent movements, details, top SKUs by value, the put-away queue with suggested racks, and the fullest racks with bins in use. Edit opens `WarehouseSheet` (exported from `setup.tsx`; its `onChanged(deleted)` lets this page leave after a delete), and "Rack map" opens the map.
  - **Rack map** `/inventory/setup/warehouses/[warehouseId]/map` (the user's "Rack map" HTML mockup; backend contract in the backend repo's `docs/api/rack-map.md`). Opened from the warehouse page, the list's "Rack map" button or the drawer; its back link returns to the warehouse page. Its warehouse tabs come from `getWarehouse()`.
    - `app/actions/rack-map.actions.ts` (floor plan, put-away, pick route, contents, floor size, placement, rotate, create/remove rack, location flags, moves, counts; these endpoints answer without a `{ data }` wrapper), `types/rack-map.type.ts`, and `lib/rack-map/geometry.ts` (a port of the backend's geometry: boxes, slot order per rotation, pick face, 0.5 m clearance, free-spot search).
    - `components/inventory/rack-map/`: `rack-map.tsx` (state, URL sync of mode/rack/bin/q/edit, the SVG floor plan in metres, layout dragging with pointer capture, R / arrow keys, SKU drops), `rack-panels.tsx` (overview with put-away and busiest slots, rack front view, bin detail, pick route, edit panel, colour scales) and `rack-dialogs.tsx` (move, count, add rack, floor size, remove).
    - Layout writes never touch stock. Moves and counts write ledger rows. There's no auth yet, so stock writes send no `actedBy`: a count with "Apply now" stays PENDING, and Edit layout is shown to everyone. Pick route has no Ship button (no endpoint commits reservations).
  - `ListTable` applies a column's `className` to its header too, so put colour and size on the cell's content.
- Toasts sit bottom-center (`app/layout.tsx`) so they don't cover side-panel footer buttons.
- Side panels (`components/ui/sheet.tsx`) dim the page with a solid `bg-black/40` backdrop and no blur, so stacked panels don't show through. The inventory drawers (product, variant, `DocSheet`) share one look: a solid `bg-sidebar` panel, a white header with the close button on the left and a small label above a bold title, cards with `rounded-2xl`, and a white footer. Their scrolling body uses `*:shrink-0` so cards keep their height.
- **Create product** (`/products/new`) follows the user's HTML mockup. Publish calls `createProduct()` (`POST /products`): it creates a typed brand, matches options to saved ones by name (creating missing options and values), and sends each variant's stock and cost per item, which the backend writes to the ledger as opening stock in the default warehouse (so the product shows up in Inventory). An optional Supplier panel (create mode only; active suppliers from `getSuppliers()` in `app/actions/supplier.actions.ts`) sends `supplierId`, and the backend then books that opening stock as Purchase received from the supplier. The supplier isn't stored on the product. Only image URLs can be saved, not uploads. `page.tsx` loads brands, tags, the category tree and variant templates from the API. Options also come from the API: the Options panel's "Add from your options" adds a saved option with its values, and options match saved ones by name to suggest their values. The Tags panel picks existing tags by ID, and "Create tag" saves a new one through `createTag`. It uses plain `useState` (no React Hook Form); all state lives in `components/products/create/create-product-page.tsx`. Its panels are `basic-info-panel`, `media-panel`, `side-panels`, `options-panel` and `variants-panel`, and pure helpers are in `product-utils.ts`. Drafts are saved in `localStorage`. With no options the product has one "Default" variant (key `"default"`), which can't be removed.
- **Product page** (`/products/[id]`): everything about one product on one read-only page (`components/products/product-detail.tsx`, a client component so it can reuse the inventory and orders helpers). `page.tsx` loads the product (`GET /products/:id`, whose variants carry `pricing` with the running promotion), its stock (`getProductStock`, `GET /inventory?productId=`), recent movements, all orders filtered to the ones containing it (the orders API can't filter by product), and its reviews of every status (`getProductReviews` in `app/actions/review.actions.ts`, `types/review.type.ts`). It shows KPIs (price, sellable, held, stock value, sold, rating), variants, stock by warehouse with racks, orders, movements, reviews, media, description, organisation, promotions and details. Order items snapshot the SKU as the variant name for single-variant products, so those show as "Default".
- **Edit product** (`/products/[id]/edit`) reuses `CreateProductPage` with a `product` prop (from `GET /products/:id`), which `fromProduct()` in `product-utils.ts` turns into form state. Saved variants carry `id` in `VariantState`.
  - "Save changes" calls `updateProduct()`. It patches the core fields, creates a brand typed into the form, syncs images by URL (delete, add, reorder, primary, alt), deletes variants that are gone, patches changed ones, and creates new ones (creating a typed option value if needed).
  - The API can't change a saved product's options or a saved variant's image, so in edit mode options are locked to adding and removing values, saved variants show their image read-only, and the template panel, drafts and payload view are hidden. Uploaded (data URL) images can't be saved; only URLs.
- **Marketing** (a sidebar group after Analytics) follows the user's "Season planner" HTML mockup and is connected to the backend. `/marketing/planner`, `/marketing/campaigns` and `/marketing/promotions` all render `components/marketing/marketing-workspace.tsx` with a different `view`.
  - `app/actions/marketing.actions.ts`:
    - `loadMarketing()` loads campaigns (with banners, sections, rules and section products), promotions (with targets and campaign links) and the catalog (brands, tags, the category tree, and ACTIVE products).
    - `saveCampaign` and `savePromotion` save a whole drawer: the record, then its nested rows through their own endpoints.
  - `components/marketing/`:
    - `marketing-utils.ts`: types and pure helpers, ported from the mockup (status hints, offer text, rule and target matching, cart math, "Needs attention").
    - `planner-view.tsx` (timeline), `campaign-list.tsx` (table), `promotion-cards.tsx` (ticket cards).
    - `campaign-drawer.tsx` and `promotion-drawer.tsx`.
    - `form-bits.tsx` and `status.tsx` (shared pieces).
  - Ids starting with `new-` aren't saved yet. Dates are ISO strings; `lib/datetime.ts` converts them for `datetime-local` inputs.
  - Backend rules the save flow works around:
    - Nested changes (banners, sections, targets, links) return 403 while the record is inactive or archived. Saving orders the steps so changes land while the record is editable, and links run last.
    - Banner and section PATCH reject `null`, so null fields are left out.
    - Banner `linkUrl` must be a full URL.
    - Section titles need at least 2 characters.
  - Promotions have `scope`: `ALL` (every product, no targets) or `SPECIFIC` (only what the targets match; zero targets means no products). There is no `ALL_PRODUCTS` target type. Switching to ALL asks before dropping saved targets; Save then leaves the targets for the backend to remove, and only edits targets while the scope is SPECIFIC.
- **Code style (the user's explicit preference):**
  - Clean, minimal, production-ready code.
  - No custom hooks, abstraction layers or design patterns unless asked.
  - No defensive boilerplate or speculative features.
  - Few files, and props over context.
  - `if/else` over nested ternaries, and short *why*-only comments.
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
- Persistence for pages other than Categories (they still use `lib/demo-data.ts`).
- A theme toggle.
