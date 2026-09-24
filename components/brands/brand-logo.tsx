"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}

// Shows the brand's logo, falling back to initials when there is no logoUrl
// or the image fails to load.
export function BrandLogo({
  name,
  logoUrl,
  className,
}: {
  name: string
  logoUrl: string | null
  className?: string
}) {
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null)
  const showImage = logoUrl && failedUrl !== logoUrl

  return (
    <div
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted text-xs font-semibold text-muted-foreground",
        className
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className="size-full object-contain"
          onError={() => setFailedUrl(logoUrl)}
        />
      ) : (
        <span aria-hidden>{initials(name) || "?"}</span>
      )}
    </div>
  )
}
