import { connection } from "next/server"

import { getTags } from "@/app/actions/tag.actions"
import { TagsManager } from "@/components/tags/tags-manager"

export default async function TagsPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const res = await getTags()

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <TagsManager initialTags={res.success ? res.data : []} />
    </div>
  )
}
