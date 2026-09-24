"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Category } from "@/lib/demo-data"
import { cn } from "@/lib/utils"

import type { CategoryDraft } from "./category-editor"

type Method = "GET" | "POST" | "PATCH" | "DELETE"

type Example = {
  value: string
  label: string
  method: Method
  path: string
  note: string
  request?: unknown
  status: string
  response?: unknown
  errors?: { status: string; body: unknown }[]
}

const methodStyles: Record<Method, string> = {
  GET: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  POST: "bg-primary/10 text-primary",
  PATCH: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  DELETE: "bg-destructive/10 text-destructive",
}

function serialize(
  category: Category,
  counts: { products: number; children: number }
) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    isActive: category.isActive,
    position: category.position,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
    _count: counts,
  }
}

function CodeBlock({ label, value }: { label: string; value: unknown }) {
  const [copied, setCopied] = React.useState(false)
  const text = JSON.stringify(value, null, 2)

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            } catch {}
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span className="sr-only">Copy {label}</span>
        </Button>
      </div>
      <pre className="max-h-80 overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
        {text}
      </pre>
    </div>
  )
}

export function CategoryApiPayloads({
  categories,
  original,
  draft,
  counts,
}: {
  categories: Category[]
  /** The saved category being edited, or null when creating. */
  original: Category | null
  draft: CategoryDraft
  counts: (id: string) => { products: number; children: number }
}) {
  const fields = {
    name: draft.name.trim(),
    slug: draft.slug.trim(),
    parentId: draft.parentId,
    isActive: draft.isActive,
    position: Number(draft.position) || 0,
  }
  const sample = original ?? categories[0]
  const id = sample?.id ?? ":id"
  const now = "2024-06-30T12:00:00.000Z"

  const changed = original
    ? Object.fromEntries(
        Object.entries(fields).filter(
          ([key, value]) => original[key as keyof typeof fields] !== value
        )
      )
    : fields

  const examples: Example[] = [
    {
      value: "list",
      label: "List",
      method: "GET",
      path: "/api/categories",
      note: "Flat list ordered by position; the client builds the tree from parentId.",
      status: "200 OK",
      response: {
        data: categories
          .slice(0, 2)
          .map((c) => serialize(c, counts(c.id))),
      },
    },
    {
      value: "create",
      label: "Create",
      method: "POST",
      path: "/api/categories",
      note: "Sent by “Create category”. The server assigns the UUID v7 id and timestamps.",
      request: fields,
      status: "201 Created",
      response: {
        id: "0190f1b0-…",
        ...fields,
        createdAt: now,
        updatedAt: now,
        _count: { products: 0, children: 0 },
      },
      errors: [
        { status: "409 Conflict", body: { error: "slug_taken", field: "slug" } },
        {
          status: "409 Conflict",
          body: { error: "name_taken_in_parent", field: "name" },
        },
      ],
    },
    {
      value: "update",
      label: "Update",
      method: "PATCH",
      path: `/api/categories/${id}`,
      note: "Sent by “Save changes”. Only fields that changed are included.",
      request: changed,
      status: "200 OK",
      response: sample
        ? serialize({ ...sample, ...(original ? fields : {}), updatedAt: now }, counts(sample.id))
        : {},
    },
    {
      value: "move",
      label: "Move",
      method: "PATCH",
      path: `/api/categories/${id}`,
      note: "Sent after dragging a category onto another (or onto the top-level zone). It's placed last among its new siblings.",
      request: { parentId: fields.parentId, position: fields.position },
      status: "200 OK",
      response: sample
        ? serialize(
            { ...sample, parentId: fields.parentId, position: fields.position, updatedAt: now },
            counts(sample.id)
          )
        : {},
      errors: [
        {
          status: "422 Unprocessable Entity",
          body: {
            error: "invalid_parent",
            message: "A category can't be moved inside its own subcategories",
          },
        },
      ],
    },
    {
      value: "delete",
      label: "Delete",
      method: "DELETE",
      path: `/api/categories/${id}`,
      note: "Children get parentId = null (onDelete: SetNull). product_categories rows for this category are removed (onDelete: Cascade); the products themselves stay.",
      status: "204 No Content",
    },
  ]

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>API payloads</CardTitle>
        <CardDescription>
          What each action sends and gets back. Suggested REST contract based on
          your Prisma <code className="font-mono">Category</code> model; values
          follow the category you&apos;re editing.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="update" className="gap-4">
          <TabsList className="max-w-full overflow-x-auto">
            {examples.map((e) => (
              <TabsTrigger key={e.value} value={e.value}>
                {e.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {examples.map((e) => (
            <TabsContent key={e.value} value={e.value} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex min-w-0 items-center gap-2 font-mono text-sm">
                  <Badge className={cn("font-mono", methodStyles[e.method])}>
                    {e.method}
                  </Badge>
                  <span className="truncate">{e.path}</span>
                </div>
                <p className="text-sm text-muted-foreground">{e.note}</p>
              </div>
              <div
                className={cn(
                  "grid gap-4",
                  e.request !== undefined && "@3xl/main:grid-cols-2"
                )}
              >
                {e.request !== undefined &&
                  (e.value === "update" && !Object.keys(e.request as object).length ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Request body
                      </span>
                      <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                        No changes yet. Edit a field to see what would be sent.
                      </div>
                    </div>
                  ) : (
                    <CodeBlock label="Request body" value={e.request} />
                  ))}
                {e.response !== undefined ? (
                  <CodeBlock label={`Response · ${e.status}`} value={e.response} />
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      Response · {e.status}
                    </span>
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      No body
                    </div>
                  </div>
                )}
              </div>
              {e.errors && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Possible errors
                  </span>
                  <ul className="flex flex-col gap-1.5">
                    {e.errors.map((err, i) => (
                      <li
                        key={i}
                        className="flex flex-wrap items-center gap-2 font-mono text-xs"
                      >
                        <Badge variant="outline" className="font-mono">
                          {err.status}
                        </Badge>
                        <span className="text-muted-foreground">
                          {JSON.stringify(err.body)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
