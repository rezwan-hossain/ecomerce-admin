"use client"

import * as React from "react"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export type ListColumn<T> = {
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  className?: string
}

export type ListFilter<T> = {
  label: string
  value: string
  match: (row: T) => boolean
}

// A lightweight searchable, filterable, paginated table for list pages.
export function ListTable<T>({
  rows,
  columns,
  getRowId,
  searchText,
  searchPlaceholder = "Search...",
  filters,
  toolbar,
  pageSize = 10,
  emptyText = "No results.",
  className = "px-4 lg:px-6",
}: {
  rows: T[]
  columns: ListColumn<T>[]
  getRowId: (row: T) => string
  searchText?: (row: T) => string
  searchPlaceholder?: string
  filters?: ListFilter<T>[]
  toolbar?: React.ReactNode
  pageSize?: number
  emptyText?: string
  className?: string
}) {
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState(filters?.[0]?.value ?? "")
  const [page, setPage] = React.useState(0)

  const activeFilter = filters?.find((f) => f.value === filter)
  const filtered = rows.filter(
    (row) =>
      (!activeFilter || activeFilter.match(row)) &&
      (!query ||
        !searchText ||
        searchText(row).toLowerCase().includes(query.toLowerCase()))
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const visible = filtered.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  )

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        {filters ? (
          <Tabs
            value={filter}
            onValueChange={(value) => {
              setFilter(value as string)
              setPage(0)
            }}
          >
            <TabsList className="max-w-full overflow-x-auto **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1">
              {filters.map((f, index) => {
                const count = rows.filter(f.match).length
                return (
                  <TabsTrigger key={f.value} value={f.value}>
                    {f.label}
                    {index > 0 && count > 0 && (
                      <Badge variant="secondary">{count}</Badge>
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        ) : (
          <div />
        )}
        <div className="flex items-center gap-2">
          {searchText && (
            <div className="relative w-full md:w-64">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(0)
                }}
                placeholder={searchPlaceholder}
                className="h-8 pl-8"
                aria-label="Search"
              />
            </div>
          )}
          {toolbar}
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length ? (
              visible.map((row) => (
                <TableRow key={getRowId(row)}>
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyText}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filtered.length} result{filtered.length === 1 ? "" : "s"}
        </span>
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">
            Page {currentPage + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 0}
          >
            <ChevronLeftIcon />
            <span className="sr-only">Previous page</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage >= pageCount - 1}
          >
            <ChevronRightIcon />
            <span className="sr-only">Next page</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
