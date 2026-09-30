"use client"

import { useRef, useState } from "react"
import { ImageUpIcon, LinkIcon } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { cn } from "@/lib/utils"

import { plural, uid, type ProductImage } from "./product-utils"

export function MediaPanel({
  images,
  hasError,
  onChange,
  onRemove,
}: {
  images: ProductImage[]
  hasError: boolean
  onChange: (images: ProductImage[]) => void
  onRemove: (index: number) => void // the page also clears variants that used it
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropId, setDropId] = useState<string | null>(null)
  const [editingAlt, setEditingAlt] = useState<string | null>(null)
  const [urlOpen, setUrlOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [urlError, setUrlError] = useState("")

  function addUrl() {
    const trimmed = url.trim()
    if (!z.url().safeParse(trimmed).success) {
      setUrlError("Enter a full URL, like https://example.com/shoe.jpg")
      return
    }
    if (images.some((image) => image.src === trimmed)) {
      setUrlError("This image is already added")
      return
    }
    // The file name makes a starting alt text: ".../red-shoe.jpg" → "red shoe".
    const fileName = decodeURIComponent(trimmed.split(/[?#]/)[0].split("/").pop() ?? "")
    const alt = fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")
    onChange([...images, { id: uid(), src: trimmed, alt }])
    setUrl("")
    setUrlError("")
    setUrlOpen(false)
    toast.success("Image added")
  }

  function addFiles(fileList: FileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"))
    if (files.length === 0) {
      toast.error("Only image files can be added to the gallery.")
      return
    }
    // Upload isn't wired to the API yet, so images are kept in the page as data URLs.
    Promise.all(
      files.map(
        (file) =>
          new Promise<ProductImage>((resolve) => {
            const reader = new FileReader()
            reader.onload = () =>
              resolve({
                id: uid(),
                src: String(reader.result),
                alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
              })
            reader.readAsDataURL(file)
          })
      )
    ).then((added) => {
      onChange([...images, ...added])
      toast.success(`${added.length} ${plural(added.length, "image", "images")} added`)
    })
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= images.length || from === to) return
    const next = [...images]
    const [image] = next.splice(from, 1)
    next.splice(to, 0, image)
    onChange(next)
  }

  function setAlt(id: string, alt: string) {
    onChange(images.map((image) => (image.id === id ? { ...image, alt } : image)))
  }

  const iconBtn =
    "h-7 min-w-7 rounded-md px-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-35 disabled:hover:bg-transparent"

  return (
    <section
      id="fMedia"
      className={cn("mb-5 rounded-[10px] border bg-card p-5", hasError && "border-destructive")}
    >
      <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Media</h2>
        <p className="text-[13px] text-muted-foreground">
          The first image is the primary image. Drag images to reorder.
        </p>
      </div>

      <div
        role="button"
        tabIndex={0}
        className={cn(
          "cursor-pointer rounded-lg border-[1.5px] border-dashed bg-muted/60 p-4.5 text-center text-muted-foreground transition-colors",
          over && "border-primary bg-primary/10 text-primary"
        )}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            fileRef.current?.click()
          }
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setOver(false)
          addFiles(event.dataTransfer.files)
        }}
      >
        <ImageUpIcon className="mx-auto mb-1.5 size-6" />
        <strong className="font-semibold text-foreground">Drop images here</strong> or click to upload
        <div className="text-[12.5px]">PNG, JPG, WebP or GIF</div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files)
          event.target.value = ""
        }}
      />

      {urlOpen ? (
        <div className="mt-2.5">
          <div className="flex gap-2">
            <Input
              autoFocus
              type="url"
              value={url}
              placeholder="https://example.com/shoe.jpg"
              aria-label="Image URL"
              aria-invalid={Boolean(urlError)}
              className="h-8"
              onChange={(event) => {
                setUrl(event.target.value)
                setUrlError("")
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  addUrl()
                }
                if (event.key === "Escape") setUrlOpen(false)
              }}
            />
            <Button type="button" size="sm" className="h-8" onClick={addUrl}>
              Add
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setUrlOpen(false)}>
              Cancel
            </Button>
          </div>
          {urlError && <p className="mt-1.5 text-[12.5px] text-destructive">{urlError}</p>}
        </div>
      ) : (
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-primary"
          onClick={() => setUrlOpen(true)}
        >
          <LinkIcon className="size-3.5" />
          Add from URL
        </button>
      )}

      <div className="mt-3 grid empty:hidden grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
        {images.map((image, index) => (
          <figure
            key={image.id}
            draggable
            onDragStart={(event) => {
              setDragId(image.id)
              event.dataTransfer.effectAllowed = "move"
            }}
            onDragOver={(event) => {
              if (!dragId) return
              event.preventDefault()
              setDropId(image.id === dragId ? null : image.id)
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (!dragId) return
              move(images.findIndex((i) => i.id === dragId), index)
              setDragId(null)
              setDropId(null)
            }}
            onDragEnd={() => {
              setDragId(null)
              setDropId(null)
            }}
            className={cn(
              "m-0 flex flex-col overflow-hidden rounded-lg border bg-card",
              index === 0 && "border-foreground",
              dragId === image.id && "opacity-40",
              dropId === image.id && "outline-2 outline-offset-2 outline-primary"
            )}
          >
            <div className="relative aspect-[4/3] cursor-grab bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URLs */}
              <img src={image.src} alt={image.alt} draggable={false} className="size-full object-cover" />
              {index === 0 && (
                <span className="absolute top-2 left-2 rounded-full bg-foreground px-2 py-0.5 text-[11.5px] font-semibold text-background">
                  Primary
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5 pt-1.5 pr-1.5 pb-0.5 pl-2.5">
              {index > 0 && (
                <button
                  type="button"
                  className="text-[12.5px] font-medium text-primary hover:underline"
                  onClick={() => {
                    move(index, 0)
                    toast.success("Primary image updated")
                  }}
                >
                  Make primary
                </button>
              )}
              <span className="flex-1" />
              <button type="button" className={iconBtn} aria-label="Move earlier" disabled={index === 0} onClick={() => move(index, index - 1)}>
                ‹
              </button>
              <button
                type="button"
                className={iconBtn}
                aria-label="Move later"
                disabled={index === images.length - 1}
                onClick={() => move(index, index + 1)}
              >
                ›
              </button>
              <button type="button" className={iconBtn} aria-label="Edit alt text" onClick={() => setEditingAlt(image.id)}>
                Alt
              </button>
              <button
                type="button"
                className={cn(iconBtn, "hover:bg-destructive/10 hover:text-destructive")}
                aria-label="Remove image"
                onClick={() => onRemove(index)}
              >
                ✕
              </button>
            </div>
            {editingAlt === image.id ? (
              <input
                autoFocus
                value={image.alt}
                placeholder="Describe the image"
                aria-label="Alt text"
                className="mx-2 mb-2 rounded-md border border-input px-2 py-1.5 text-[13px] outline-none focus:border-ring"
                onChange={(event) => setAlt(image.id, event.target.value)}
                onBlur={() => setEditingAlt(null)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === "Escape") setEditingAlt(null)
                }}
              />
            ) : (
              <p
                title={image.alt}
                className={cn(
                  "m-0 truncate px-2.5 pb-2.5 text-xs",
                  image.alt ? "text-muted-foreground" : "text-amber-700"
                )}
              >
                {image.alt || "Missing alt text"}
              </p>
            )}
          </figure>
        ))}

        {/* With no images the drop zone above does this job. */}
        {images.length > 0 && (
        <button
          type="button"
          className="flex min-h-45 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input font-medium text-muted-foreground hover:border-primary hover:bg-primary/10 hover:text-primary"
          onClick={() => fileRef.current?.click()}
        >
          <span className="text-[26px] leading-none">+</span>
          Add media
        </button>
        )}
      </div>
    </section>
  )
}
