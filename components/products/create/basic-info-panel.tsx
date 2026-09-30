"use client"

import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const TOOLS = [
  { cmd: "bold", label: <b>B</b>, aria: "Bold" },
  { cmd: "italic", label: <i>I</i>, aria: "Italic" },
  { cmd: "underline", label: <u>U</u>, aria: "Underline" },
  { cmd: "insertUnorderedList", label: "• List", aria: "Bulleted list" },
]

export function BasicInfoPanel({
  name,
  slug,
  slugAuto,
  shortDesc,
  initialDescHtml,
  errorIds,
  onNameChange,
  onSlugChange,
  onSlugAutoChange,
  onShortDescChange,
  onDescChange,
}: {
  name: string
  slug: string
  slugAuto: boolean
  shortDesc: string
  initialDescHtml: string // the editor is uncontrolled; remount it to load a draft
  errorIds: string[]
  onNameChange: (name: string) => void
  onSlugChange: (slug: string) => void
  onSlugAutoChange: (auto: boolean) => void
  onShortDescChange: (text: string) => void
  onDescChange: (html: string) => void
}) {
  const slugRef = useRef<HTMLInputElement>(null)
  const descRef = useRef<HTMLDivElement>(null)
  const savedRange = useRef<Range | null>(null)
  const [pressed, setPressed] = useState<string[]>([])
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState("")

  // Load the HTML once; after that the editor owns its content (the page remounts it for a draft).
  useEffect(() => {
    descRef.current!.innerHTML = initialDescHtml
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Highlights Bold/Italic/… for the text under the cursor.
  useEffect(() => {
    function onSelectionChange() {
      const selection = getSelection()
      if (!selection?.rangeCount || !descRef.current?.contains(selection.anchorNode)) return
      setPressed(TOOLS.filter((t) => document.queryCommandState(t.cmd)).map((t) => t.cmd))
    }
    document.addEventListener("selectionchange", onSelectionChange)
    return () => document.removeEventListener("selectionchange", onSelectionChange)
  }, [])

  // The link box and file picker take focus, so remember where the cursor was.
  function saveRange() {
    const selection = getSelection()
    if (selection?.rangeCount && descRef.current!.contains(selection.anchorNode)) {
      savedRange.current = selection.getRangeAt(0).cloneRange()
    }
  }

  function restoreRange() {
    descRef.current!.focus()
    if (savedRange.current) {
      const selection = getSelection()!
      selection.removeAllRanges()
      selection.addRange(savedRange.current)
    }
  }

  function run(cmd: string) {
    descRef.current!.focus()
    document.execCommand(cmd)
    onDescChange(descRef.current!.innerHTML)
  }

  function applyLink() {
    let url = linkUrl.trim()
    if (!url) return
    if (!/^(https?:|mailto:|\/|#)/i.test(url)) url = `https://${url}`
    restoreRange()
    const selection = getSelection()!
    if (selection.isCollapsed) {
      document.execCommand("insertHTML", false, `<a href="${url}">${url}</a>&nbsp;`)
    } else {
      document.execCommand("createLink", false, url)
    }
    setLinkOpen(false)
    onDescChange(descRef.current!.innerHTML)
  }

  function insertImage(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      restoreRange()
      document.execCommand("insertImage", false, String(reader.result))
      onDescChange(descRef.current!.innerHTML)
    }
    reader.readAsDataURL(file)
  }

  const toolClass =
    "h-7.5 min-w-8 rounded-md px-1.5 text-[13px] text-foreground hover:bg-muted aria-pressed:bg-primary/10 aria-pressed:text-primary"

  return (
    <section className="mb-5 rounded-[10px] border bg-card p-5">
      <h2 className="mb-3.5 text-base font-semibold">Basic information</h2>

      <div className="mb-4">
        <label htmlFor="nameInput" className="mb-1.5 flex text-[13px] font-medium">
          Product name<span className="ml-0.5 text-destructive">*</span>
        </label>
        <Input
          id="nameInput"
          value={name}
          autoComplete="off"
          placeholder="e.g. Air Max Alpha 5"
          aria-invalid={errorIds.includes("fName")}
          className="h-9"
          onChange={(event) => onNameChange(event.target.value)}
        />
      </div>

      <div className="mb-4">
        <label htmlFor="slugInput" className="mb-1.5 flex justify-between text-[13px] font-medium">
          <span>
            URL slug<span className="ml-0.5 text-destructive">*</span>
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {slugAuto ? "Generated from name" : "Custom"}
          </span>
        </label>
        <div
          className={cn(
            "flex items-stretch overflow-hidden rounded-md border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
            errorIds.includes("fSlug") && "border-destructive"
          )}
        >
          <span className="hidden py-2 pl-3 text-muted-foreground sm:block">store.com/products/</span>
          <input
            ref={slugRef}
            id="slugInput"
            value={slug}
            readOnly={slugAuto}
            spellCheck={false}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-2 pr-1.5 pl-3 outline-none sm:pl-px"
            onChange={(event) =>
              onSlugChange(event.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
            }
          />
          <button
            type="button"
            className="border-l px-3 text-[13px] font-medium hover:bg-muted"
            onClick={() => {
              onSlugAutoChange(!slugAuto)
              if (slugAuto) setTimeout(() => slugRef.current?.select(), 0)
            }}
          >
            {slugAuto ? "Edit" : "Use auto"}
          </button>
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="shortDesc" className="mb-1.5 flex justify-between text-[13px] font-medium">
          <span>Short description</span>
          <span
            className={cn(
              "text-xs font-normal tabular-nums",
              shortDesc.length > 450 ? "text-amber-700" : "text-muted-foreground"
            )}
          >
            {shortDesc.length} / 500
          </span>
        </label>
        <Textarea
          id="shortDesc"
          value={shortDesc}
          maxLength={500}
          rows={3}
          placeholder="One or two sentences shown in product listings"
          onChange={(event) => onShortDescChange(event.target.value)}
        />
      </div>

      <div>
        <div id="descLabel" className="mb-1.5 text-[13px] font-medium">
          Detailed description
        </div>
        <div className="overflow-hidden rounded-md border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <div
            role="toolbar"
            aria-label="Text formatting"
            className="flex flex-wrap items-center gap-0.5 border-b bg-muted/60 px-1.5 py-1"
            onMouseDown={(event) => event.preventDefault()} // keep the text selected
          >
            {TOOLS.map((tool) => (
              <button
                key={tool.cmd}
                type="button"
                aria-label={tool.aria}
                aria-pressed={pressed.includes(tool.cmd)}
                className={toolClass}
                onClick={() => run(tool.cmd)}
              >
                {tool.label}
              </button>
            ))}
            <span className="mx-1 h-4.5 w-px bg-border" aria-hidden />
            <button
              type="button"
              className={toolClass}
              onClick={() => {
                saveRange()
                setLinkUrl("")
                setLinkOpen(true)
              }}
            >
              Link
            </button>
            <label className={cn(toolClass, "flex cursor-pointer items-center")} onClick={saveRange}>
              Image
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) insertImage(file)
                  event.target.value = ""
                }}
              />
            </label>
            <button type="button" className={toolClass} onClick={() => run("removeFormat")}>
              Clear
            </button>
          </div>

          {linkOpen && (
            <div className="flex gap-1.5 border-b bg-muted/60 p-2">
              <Input
                autoFocus
                value={linkUrl}
                placeholder="Paste a link, e.g. https://store.com/sizing"
                aria-label="Link URL"
                onChange={(event) => setLinkUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    applyLink()
                  }
                  if (event.key === "Escape") {
                    setLinkOpen(false)
                    restoreRange()
                  }
                }}
              />
              <Button type="button" size="sm" onClick={applyLink}>
                Add link
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setLinkOpen(false)
                  restoreRange()
                }}
              >
                Cancel
              </Button>
            </div>
          )}

          <div
            ref={descRef}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-multiline
            aria-labelledby="descLabel"
            data-placeholder="Describe materials, fit, and what the product is for"
            className="min-h-37.5 px-3.5 py-3 leading-relaxed outline-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)] [&_a]:text-primary [&_a]:underline [&_img]:my-2 [&_img]:max-h-70 [&_img]:rounded-md [&_p]:mb-2.5 [&_ul]:list-disc [&_ul]:pl-5"
            onInput={() => onDescChange(descRef.current!.innerHTML)}
          />
        </div>
      </div>
    </section>
  )
}
