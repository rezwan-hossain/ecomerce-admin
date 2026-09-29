"use client"

import { useState } from "react"
import { PencilIcon, PlusIcon, SearchIcon, TagIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { createTag, deleteTag, getTags, updateTag } from "@/app/actions/tag.actions"
import { PageHeader } from "@/components/page-header"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { CreateTagDto, Tag } from "@/types/tag.type"

import { TagForm } from "./tag-form"

export function TagsManager({ initialTags }: { initialTags: Tag[] }) {
  const [tags, setTags] = useState(initialTags)
  const [search, setSearch] = useState("")
  // The tag open in the form. null = the "New Tag" form.
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null)

  const selected = tags.find((t) => t.id === selectedId) ?? null

  const searchText = search.trim().toLowerCase()
  const visibleTags = tags
    .filter((t) => t.name.toLowerCase().includes(searchText) || t.slug.includes(searchText))
    .sort((a, b) => a.name.localeCompare(b.name))

  async function refresh() {
    const res = await getTags()
    if (res.success) setTags(res.data)
  }

  async function handleSave(values: CreateTagDto) {
    const res = selected ? await updateTag(selected.id, values) : await createTag(values)

    if (!res.success) {
      toast.error(res.error)
      return res
    }

    toast.success(`${values.name} saved`)
    await refresh()
    setSelectedId(res.data.id)
    return res
  }

  async function handleDelete() {
    const tag = deletingTag!
    const res = await deleteTag(tag.id)

    if (!res.success) {
      toast.error(res.error)
      return
    }

    toast.success(`${tag.name} deleted`)
    setDeletingTag(null)
    if (selectedId === tag.id) setSelectedId(null)
    await refresh()
  }

  return (
    <>
      <PageHeader title="Tags" description="Label products so shoppers can filter and find them.">
        <Button onClick={() => setSelectedId(null)}>
          <PlusIcon data-icon="inline-start" />
          New Tag
        </Button>
      </PageHeader>

      <div className="grid items-start gap-4 px-4 md:grid-cols-2 lg:px-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>All Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-3">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name or slug"
                className="pl-9"
              />
            </div>

            {visibleTags.length > 0 ? (
              <ul className="flex flex-col gap-0.5">
                {visibleTags.map((tag) => (
                  <li
                    key={tag.id}
                    onClick={() => setSelectedId(tag.id)}
                    className={cn(
                      "group flex h-10 cursor-pointer items-center gap-3 rounded-md px-2 text-sm hover:bg-muted/70",
                      selectedId === tag.id && "bg-primary/10 text-primary hover:bg-primary/15"
                    )}
                  >
                    <TagIcon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-medium">{tag.name}</span>
                    <span className="truncate font-mono text-xs text-muted-foreground">
                      {tag.slug}
                    </span>
                    <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100">
                      <Button variant="ghost" size="icon" className="size-7" aria-label={`Edit ${tag.name}`}>
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive"
                        aria-label={`Delete ${tag.name}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          setDeletingTag(tag)
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {searchText ? `No tags match "${search}"` : "No tags yet. Create your first one!"}
              </p>
            )}

            <p className="mt-3 text-xs text-muted-foreground">
              {tags.length === 1 ? "1 tag" : `${tags.length} tags`} total
            </p>
          </CardContent>
        </Card>

        <div className="md:sticky md:top-4">
          <TagForm
            key={selectedId ?? "new"}
            tag={selected}
            onSave={handleSave}
            onCancel={() => setSelectedId(null)}
          />
        </div>
      </div>

      <AlertDialog open={deletingTag !== null} onOpenChange={(open) => !open && setDeletingTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{deletingTag?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              The tag is removed from every product that uses it. The products themselves stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
