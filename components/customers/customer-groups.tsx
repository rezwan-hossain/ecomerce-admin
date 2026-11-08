"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CopyIcon, CopyPlusIcon, DownloadIcon, EllipsisIcon, InfoIcon, PencilIcon, PlusIcon, Trash2Icon, UsersIcon } from "lucide-react"

import { buildCustomers, type Customer } from "@/components/customers/customers-table"
import { DOT, GroupSheet, matches, ruleText, type Group } from "@/components/customers/group-sheet"
import { n0, rel, taka } from "@/components/inventory/inventory-ui"
import { ListTable, type ListColumn } from "@/components/list-table"
import { localPhone } from "@/components/orders/orders-table"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { uuidv7 } from "@/lib/uuid"
import type { Order, OrderAddress } from "@/types/order.type"

const STORAGE_KEY = "customer-groups"

// A starting set, shown until the first change is saved.
const DEFAULT_GROUPS: Group[] = [
  {
    id: "default-big-spenders",
    name: "Big spenders",
    note: "Early access to new arrivals",
    tone: "blue",
    match: "all",
    rules: [{ id: "r1", field: "spent", op: "gte", value: "100000" }],
  },
  {
    id: "default-loyal",
    name: "Loyal",
    note: "Order often and accept their parcels",
    tone: "green",
    match: "all",
    rules: [
      { id: "r1", field: "orders", op: "gte", value: "3" },
      { id: "r2", field: "delivery", op: "gte", value: "80" },
    ],
  },
  {
    id: "default-win-back",
    name: "Win back",
    note: "Came back before, quiet for two months",
    tone: "amber",
    match: "all",
    rules: [
      { id: "r1", field: "orders", op: "gte", value: "2" },
      { id: "r2", field: "sinceLast", op: "gte", value: "60" },
    ],
  },
  {
    id: "default-first-timers",
    name: "First-timers",
    note: "One order so far: nudge a second",
    tone: "grey",
    match: "all",
    rules: [{ id: "r1", field: "orders", op: "lte", value: "1" }],
  },
  {
    id: "default-cod-risk",
    name: "Cash on delivery risk",
    note: "Confirm by phone before booking a courier",
    tone: "red",
    match: "all",
    rules: [
      { id: "r1", field: "orders", op: "gte", value: "2" },
      { id: "r2", field: "delivery", op: "lte", value: "50" },
    ],
  },
  {
    id: "default-dhaka",
    name: "Inside Dhaka",
    note: "Same-day delivery offers",
    tone: "ink",
    match: "all",
    rules: [{ id: "r1", field: "city", op: "is", value: "Dhaka" }],
  },
]

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)

export function CustomerGroups({ orders, addresses }: { orders: Order[]; addresses: Record<string, OrderAddress> }) {
  const customers = buildCustomers(orders, addresses)
  const [groups, setGroups] = useState<Group[]>(DEFAULT_GROUPS)
  const [openId, setOpenId] = useState(DEFAULT_GROUPS[0].id)
  const [editing, setEditing] = useState<Group | "new" | null>(null)
  const [deleting, setDeleting] = useState<Group | null>(null)

  // Saved groups live in this browser until there's an API; read after mount so the server render matches.
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    const list: Group[] = JSON.parse(saved)
    setGroups(list)
    if (list[0]) setOpenId(list[0].id)
  }, [])

  function save(next: Group[]) {
    setGroups(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const now = Date.now()
  const membersOf = (g: Group) => customers.filter((c) => matches(c, g, now))
  const open = groups.find((g) => g.id === openId) ?? groups[0]
  const members = open ? membersOf(open).sort((a, b) => b.spent - a.spent) : []
  const grouped = customers.filter((c) => groups.some((g) => matches(c, g, now))).length

  function saveGroup(g: Group) {
    const exists = groups.some((x) => x.id === g.id)
    save(exists ? groups.map((x) => (x.id === g.id ? g : x)) : [...groups, g])
    setOpenId(g.id)
    setEditing(null)
    toast.success(exists ? `${g.name} saved` : `${g.name} created`)
  }

  function duplicate(g: Group) {
    const copy = { ...g, id: uuidv7(), name: `${g.name} copy`.slice(0, 40) }
    save([...groups, copy])
    setEditing(copy)
  }

  function remove(g: Group) {
    save(groups.filter((x) => x.id !== g.id))
    setDeleting(null)
    toast.success(`${g.name} deleted`)
  }

  function copyPhones() {
    const phones = [...new Set(members.flatMap((c) => (c.phone ? [localPhone(c.phone)] : [])))]
    navigator.clipboard.writeText(phones.join("\n")).then(() => toast.success(`${n0(phones.length)} phone numbers copied`))
  }

  function exportCsv() {
    const cell = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`
    const rows = [
      ["Name", "Phone", "Email", "District", "Orders", "Paid", "Last order"],
      ...members.map((c) => [c.name, c.phone ? localPhone(c.phone) : "", c.email, c.address?.city ?? "", c.orders, Math.round(c.spent), c.last.slice(0, 10)]),
    ]
    const blob = new Blob([rows.map((r) => r.map(cell).join(",")).join("\n")], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${open!.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const columns: ListColumn<Customer>[] = [
    {
      key: "customer",
      header: "Customer",
      cell: (c) => (
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary uppercase">{initials(c.name)}</span>
          <div className="min-w-0">
            <div className="truncate font-medium">{c.name}</div>
            {c.name !== c.email && <div className="truncate text-xs text-muted-foreground">{c.email}</div>}
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      className: "hidden md:table-cell",
      cell: (c) => (c.phone ? <span className="font-mono text-xs">{localPhone(c.phone)}</span> : <span className="text-xs text-muted-foreground">No phone</span>),
    },
    {
      key: "city",
      header: "District",
      className: "hidden lg:table-cell",
      cell: (c) => <span className="capitalize">{c.address?.city ?? "—"}</span>,
    },
    {
      key: "orders",
      header: "Orders",
      cell: (c) => (
        <div>
          <div className="font-medium tabular-nums">{n0(c.orders)}</div>
          <Link href={`/orders/${c.lastOrder.id}`} className="text-xs whitespace-nowrap text-muted-foreground hover:text-primary hover:underline">
            last {rel(c.last)}
          </Link>
        </div>
      ),
    },
    {
      key: "delivered",
      header: "Delivered",
      className: "hidden sm:table-cell",
      cell: (c) =>
        c.finished ? (
          <span className={cn("tabular-nums", c.delivered / c.finished < 0.5 && "font-medium text-destructive")}>
            {c.delivered} of {c.finished}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: "paid",
      header: "Paid",
      className: "text-right",
      cell: (c) => <div className="text-right font-semibold tabular-nums">{taka(c.spent)}</div>,
    },
  ]

  return (
    <>
      <p className="mx-4 flex items-start gap-2 rounded-lg border border-dashed border-amber-400 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900 lg:mx-6 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        <InfoIcon className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong>Saved in this browser.</strong> There's no customer groups API yet, so groups are kept on this computer only. Members are worked out
          live from your real orders.
        </span>
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 lg:px-6">
        <p className="text-sm text-muted-foreground">
          {n0(groups.length)} {groups.length === 1 ? "group" : "groups"} · {n0(grouped)} of {n0(customers.length)} customers are in at least one
        </p>
        <Button size="sm" onClick={() => setEditing("new")}>
          <PlusIcon data-icon="inline-start" />
          New group
        </Button>
      </div>

      <div className="grid gap-4 px-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-3">
        {groups.map((g) => {
          const list = membersOf(g)
          const paid = list.reduce((s, c) => s + c.spent, 0)
          const share = customers.length ? (list.length / customers.length) * 100 : 0
          return (
            <div
              key={g.id}
              role="button"
              tabIndex={0}
              onClick={() => setOpenId(g.id)}
              onKeyDown={(e) => e.key === "Enter" && setOpenId(g.id)}
              className={cn(
                "flex cursor-pointer flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs transition-colors hover:border-foreground/20",
                open?.id === g.id && "border-primary ring-1 ring-primary"
              )}
            >
              <div className="flex items-start gap-2">
                <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", DOT[g.tone])} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{g.name}</div>
                  {g.note && <div className="truncate text-xs text-muted-foreground">{g.note}</div>}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-xs" className="-mr-1 text-muted-foreground" onClick={(e) => e.stopPropagation()} aria-label={`${g.name} actions`} />}
                  >
                    <EllipsisIcon />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={() => setEditing(g)}>
                      <PencilIcon />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicate(g)}>
                      <CopyPlusIcon />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(g)}>
                      <Trash2Icon />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-wrap items-center gap-1 text-[11.5px]">
                {g.rules.map((r, i) => (
                  <span key={r.id} className="contents">
                    {i > 0 && <span className="text-muted-foreground">{g.match === "all" ? "and" : "or"}</span>}
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium">{ruleText(r)}</span>
                  </span>
                ))}
              </div>

              <div className="mt-auto flex items-end justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold tracking-tight tabular-nums">{n0(list.length)}</div>
                  <div className="text-xs text-muted-foreground">
                    {list.length === 1 ? "customer" : "customers"} · {Math.round(share)}%
                  </div>
                </div>
                <div className="flex -space-x-1.5">
                  {list.slice(0, 4).map((c) => (
                    <span key={c.key} title={c.name} className="grid size-8 place-items-center rounded-full bg-blue-50 text-[10px] font-semibold text-primary uppercase ring-2 ring-card dark:bg-blue-950">
                      {initials(c.name)}
                    </span>
                  ))}
                  {list.length > 4 && (
                    <span className="grid size-8 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card">
                      +{list.length - 4}
                    </span>
                  )}
                </div>
              </div>

              <div className="h-1 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", DOT[g.tone])} style={{ width: `${share}%` }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  Paid <span className="font-medium text-foreground tabular-nums">{taka(paid)}</span>
                </span>
                <span>
                  Avg <span className="font-medium text-foreground tabular-nums">{taka(list.length ? paid / list.length : 0)}</span>
                </span>
              </div>
            </div>
          )
        })}

        <button
          type="button"
          onClick={() => setEditing("new")}
          className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <PlusIcon className="size-5" />
          New group
        </button>
      </div>

      {open && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 px-4 lg:px-6">
            <span className={cn("size-2.5 rounded-full", DOT[open.tone])} />
            <h2 className="font-semibold">{open.name}</h2>
            <span className="text-sm text-muted-foreground">
              {n0(members.length)} {members.length === 1 ? "member" : "members"}, biggest spenders first
            </span>
          </div>
          <ListTable
            key={open.id}
            rows={members}
            columns={columns}
            getRowId={(c) => c.key}
            searchText={(c) => `${c.name} ${c.email} ${c.phone ? localPhone(c.phone) : ""} ${c.address?.city ?? ""}`}
            searchPlaceholder="Search members..."
            emptyText="Nobody matches these rules yet."
            toolbar={
              <>
                <Button size="sm" variant="outline" onClick={copyPhones} disabled={!members.some((c) => c.phone)} title="One number per line, ready for an SMS tool">
                  <CopyIcon data-icon="inline-start" />
                  Copy phones
                </Button>
                <Button size="sm" variant="outline" onClick={exportCsv} disabled={members.length === 0}>
                  <DownloadIcon data-icon="inline-start" />
                  Export
                </Button>
              </>
            }
          />
        </section>
      )}

      {groups.length === 0 && (
        <div className="mx-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed py-10 text-center text-sm text-muted-foreground lg:mx-6">
          <UsersIcon className="size-6" />
          No groups yet. Make one to sort customers by what they buy and how they pay.
        </div>
      )}

      {editing && <GroupSheet group={editing} customers={customers} onSave={saveGroup} onClose={() => setEditing(null)} />}

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>The group and its rules go away. Customers and their orders aren't touched.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <Button variant="destructive" onClick={() => deleting && remove(deleting)}>
              Delete group
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
