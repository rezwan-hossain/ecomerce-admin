"use client"

import { useState } from "react"
import Link from "next/link"
import { CalendarIcon, CopyIcon, FlagIcon, PlusIcon, TagIcon } from "lucide-react"
import { toast } from "sonner"

import {
  loadMarketing,
  patchCampaign,
  patchPromotion,
  removeCampaign,
  removePromotion,
  saveCampaign,
  savePromotion,
} from "@/app/actions/marketing.actions"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

import { CampaignDrawer } from "./campaign-drawer"
import { CampaignList } from "./campaign-list"
import { plural, type Campaign, type MarketingData, type Promotion } from "./marketing-utils"
import { PlannerView } from "./planner-view"
import { PromotionCards } from "./promotion-cards"
import { PromotionDrawer } from "./promotion-drawer"

export type View = "planner" | "campaigns" | "promotions"

type Drawer =
  | { kind: "campaign"; draft: Campaign; isNew: boolean; key: number }
  | { kind: "promotion"; draft: Promotion; isNew: boolean; key: number }

type Confirm = { title: string; text: string; label: string; onConfirm: () => void }

const newId = () => `new-${Math.random().toString(36).slice(2, 10)}`

const blankCampaign = (): Campaign => ({
  id: newId(),
  name: "",
  slug: "",
  description: "",
  status: "DRAFT",
  startsAt: null,
  endsAt: null,
  bannerUrl: "",
  thumbnailUrl: "",
  isActive: true,
  isFeatured: false,
  metaTitle: "",
  metaDescription: "",
  metaImageUrl: "",
  banners: [],
  sections: [],
  promotionIds: [],
})

const blankPromotion = (): Promotion => ({
  id: newId(),
  name: "",
  description: "",
  type: "PERCENTAGE",
  status: "DRAFT",
  value: null,
  buyQuantity: null,
  getQuantity: null,
  minOrderAmount: null,
  maxDiscountAmount: null,
  startsAt: null,
  endsAt: null,
  isActive: true,
  priority: 0,
  scope: "SPECIFIC",
  targets: [],
  campaignIds: [],
})

export function MarketingWorkspace({
  view,
  initialData,
  now,
}: {
  view: View
  initialData: MarketingData
  now: number // from the server, so server and browser render the same "today"
}) {
  const [data, setData] = useState(initialData)
  const [drawer, setDrawer] = useState<Drawer | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [payload, setPayload] = useState<string | null>(null)

  async function refresh() {
    const res = await loadMarketing()
    if (res.success) setData(res.data)
    return res
  }

  function openCampaign(campaign: Campaign | null) {
    setDrawer({ kind: "campaign", draft: campaign ? structuredClone(campaign) : blankCampaign(), isNew: !campaign, key: Date.now() })
  }

  function openPromotion(promotion: Promotion | null) {
    setDrawer({ kind: "promotion", draft: promotion ? structuredClone(promotion) : blankPromotion(), isNew: !promotion, key: Date.now() })
  }

  function open(kind: "campaign" | "promotion", id: string) {
    if (kind === "campaign") openCampaign(data.campaigns.find((c) => c.id === id)!)
    else openPromotion(data.promotions.find((p) => p.id === id)!)
  }

  function closeDrawer(dirty: boolean) {
    if (!dirty) {
      setDrawer(null)
      return
    }
    setConfirm({
      title: "Discard unsaved changes?",
      text: `Your edits to “${drawer!.draft.name || `this ${drawer!.kind}`}” haven’t been saved.`,
      label: "Discard changes",
      onConfirm: () => setDrawer(null),
    })
  }

  // After saving, reload everything and reopen the drawer on the saved record,
  // so new banners, sections and targets get their real ids.
  async function saveDrawer(draft: Campaign | Promotion) {
    setSaving(true)
    let res
    if (drawer!.kind === "campaign") {
      const before = data.campaigns.find((c) => c.id === draft.id)?.promotionIds ?? []
      res = await saveCampaign(draft as Campaign, before)
    } else {
      const original = data.promotions.find((p) => p.id === draft.id)
      res = await savePromotion(draft as Promotion, {
        targetIds: original?.targets.map((t) => t.id) ?? [],
        campaignIds: original?.campaignIds ?? [],
      })
    }
    if (!res.success) {
      setSaving(false)
      toast.error(res.error)
      return
    }
    const fresh = await refresh()
    setSaving(false)
    toast.success(`${drawer!.kind === "campaign" ? "Campaign" : "Promotion"} saved`)
    if (!fresh.success) return
    const savedId = res.data.id
    if (drawer!.kind === "campaign") {
      setDrawer({ kind: "campaign", draft: fresh.data.campaigns.find((c) => c.id === savedId)!, isNew: false, key: Date.now() })
    } else {
      setDrawer({ kind: "promotion", draft: fresh.data.promotions.find((p) => p.id === savedId)!, isNew: false, key: Date.now() })
    }
  }

  function askDelete(kind: "campaign" | "promotion", entity: Campaign | Promotion, fromDrawer: boolean) {
    const links = kind === "campaign" ? (entity as Campaign).promotionIds.length : (entity as Promotion).campaignIds.length
    const text =
      kind === "campaign"
        ? `“${entity.name}” and its banners, sections and rules will be deleted. Linked promotions stay, but are unlinked from this campaign.`
        : `“${entity.name}” will be deleted${links ? ` and removed from ${plural(links, "campaign")}` : ""}. Orders that already used it keep their discount record.`
    setConfirm({
      title: `Delete this ${kind}?`,
      text,
      label: `Delete ${kind}`,
      onConfirm: async () => {
        const res = kind === "campaign" ? await removeCampaign(entity.id) : await removePromotion(entity.id)
        if (!res.success) {
          toast.error(res.error)
          return
        }
        if (fromDrawer) setDrawer(null)
        await refresh()
        toast.success(`${kind === "campaign" ? "Campaign" : "Promotion"} deleted`)
      },
    })
  }

  // Quick toggles update the screen first and roll back if the save fails.
  async function quickCampaign(c: Campaign, patch: { isActive?: boolean; isFeatured?: boolean }, message: string) {
    setData({ ...data, campaigns: data.campaigns.map((x) => (x.id === c.id ? { ...x, ...patch } : x)) })
    const res = await patchCampaign(c.id, patch)
    if (!res.success) {
      setData(data)
      toast.error(res.error)
      return
    }
    toast.success(message)
  }

  async function quickPromotion(p: Promotion, isActive: boolean) {
    setData({ ...data, promotions: data.promotions.map((x) => (x.id === p.id ? { ...x, isActive } : x)) })
    const res = await patchPromotion(p.id, { isActive })
    if (!res.success) {
      setData(data)
      toast.error(res.error)
      return
    }
    toast.success(isActive ? `${p.name} is enabled` : `${p.name} is paused`)
  }

  // Copies get new ids for every nested row, start as drafts, and keep their links.
  async function duplicateCampaign(c: Campaign) {
    let slug = `${c.slug}-copy`
    let n = 2
    while (data.campaigns.some((x) => x.slug === slug)) slug = `${c.slug}-copy-${n++}`
    const copy: Campaign = {
      ...structuredClone(c),
      id: newId(),
      name: `${c.name} (copy)`,
      slug,
      status: "DRAFT",
      isFeatured: false,
      banners: c.banners.map((b) => ({ ...b, id: newId() })),
      sections: c.sections.map((s) => ({ ...s, id: newId(), rules: s.rules.map((r) => ({ ...r, id: newId() })) })),
      // Paused or archived promotions can't take new links.
      promotionIds: c.promotionIds.filter((id) => {
        const p = data.promotions.find((x) => x.id === id)!
        return p.isActive && p.status !== "ARCHIVED"
      }),
    }
    const res = await saveCampaign(copy, [])
    if (!res.success) {
      toast.error(res.error)
      return
    }
    await refresh()
    toast.success(`Duplicated as “${copy.name}”`)
  }

  async function duplicatePromotion(p: Promotion) {
    const copy: Promotion = {
      ...structuredClone(p),
      id: newId(),
      name: `${p.name} (copy)`,
      status: "DRAFT",
      targets: p.targets.map((t) => ({ ...t, id: newId() })),
      campaignIds: [],
    }
    const res = await savePromotion(copy, { targetIds: [], campaignIds: [] })
    if (!res.success) {
      toast.error(res.error)
      return
    }
    await refresh()
    toast.success(`Duplicated as “${copy.name}”`)
  }

  const tabs = [
    { key: "planner", label: "Planner", href: "/marketing/planner", icon: CalendarIcon, count: null },
    { key: "campaigns", label: "Campaigns", href: "/marketing/campaigns", icon: FlagIcon, count: data.campaigns.length },
    { key: "promotions", label: "Promotions", href: "/marketing/promotions", icon: TagIcon, count: data.promotions.length },
  ]

  return (
    <div className="min-h-full flex-1 bg-muted/50 text-[14.5px] tabular-nums">
      <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-7 gap-y-2 px-4 py-2.5 lg:px-7">
          <nav className="flex gap-0.5 overflow-x-auto" aria-label="Views">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={t.href}
                aria-current={view === t.key ? "page" : undefined}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold whitespace-nowrap text-foreground/75 hover:bg-muted hover:text-foreground",
                  view === t.key && "bg-foreground text-background hover:bg-foreground hover:text-background"
                )}
              >
                <t.icon className="size-4" />
                {t.label}
                {t.count !== null && <em className="text-xs font-medium not-italic opacity-70">{t.count}</em>}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" onClick={() => openPromotion(null)}>
              <PlusIcon data-icon="inline-start" />
              New promotion
            </Button>
            <Button onClick={() => openCampaign(null)}>
              <PlusIcon data-icon="inline-start" />
              New campaign
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[1360px] px-4 pt-7.5 pb-6 lg:px-7">
        {view === "planner" && (
          <PlannerView
            data={data}
            now={now}
            onOpen={open}
            onNewCampaign={() => openCampaign(null)}
            onNewPromotion={() => openPromotion(null)}
          />
        )}
        {view === "campaigns" && (
          <CampaignList
            data={data}
            now={now}
            onOpen={(id) => open("campaign", id)}
            onNew={() => openCampaign(null)}
            onToggleFeatured={(c) =>
              quickCampaign(c, { isFeatured: !c.isFeatured }, c.isFeatured ? `${c.name} is no longer featured` : `${c.name} is featured on the homepage`)
            }
            onToggleActive={(c, isActive) =>
              quickCampaign(c, { isActive }, isActive ? `${c.name} is visible on the storefront` : `${c.name} is hidden from the storefront`)
            }
            onDuplicate={duplicateCampaign}
            onDelete={(c) => askDelete("campaign", c, false)}
          />
        )}
        {view === "promotions" && (
          <PromotionCards
            data={data}
            now={now}
            onOpen={(id) => open("promotion", id)}
            onNew={() => openPromotion(null)}
            onToggleActive={quickPromotion}
            onDuplicate={duplicatePromotion}
            onDelete={(p) => askDelete("promotion", p, false)}
          />
        )}
      </main>

      {drawer?.kind === "campaign" && (
        <CampaignDrawer
          key={drawer.key}
          initial={drawer.draft}
          isNew={drawer.isNew}
          data={data}
          now={now}
          saving={saving}
          onClose={closeDrawer}
          onSave={saveDrawer}
          onDelete={() => askDelete("campaign", drawer.draft, true)}
          onPayload={(draft) => setPayload(JSON.stringify(draft, null, 2))}
        />
      )}
      {drawer?.kind === "promotion" && (
        <PromotionDrawer
          key={drawer.key}
          initial={drawer.draft}
          isNew={drawer.isNew}
          data={data}
          now={now}
          saving={saving}
          onClose={closeDrawer}
          onSave={saveDrawer}
          onDelete={() => askDelete("promotion", drawer.draft, true)}
          onPayload={(draft) => setPayload(JSON.stringify(draft, null, 2))}
        />
      )}

      <AlertDialog open={confirm !== null} onOpenChange={(isOpen) => !isOpen && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.text}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                confirm!.onConfirm()
                setConfirm(null)
              }}
            >
              {confirm?.label}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={payload !== null} onOpenChange={(isOpen) => !isOpen && setPayload(null)}>
        <DialogContent className="sm:max-w-[780px]">
          <DialogHeader>
            <DialogTitle>API payload</DialogTitle>
            <DialogDescription>
              The form as it is now. Saving sends the record first, then its banners, sections, rules, products, targets
              and links through their own endpoints. Ids starting with <code>new-</code> are created on save.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[52vh] overflow-auto rounded-lg border bg-muted/60 p-3.5 font-mono text-[12.5px] leading-normal">{payload}</pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayload(null)}>
              Close
            </Button>
            <Button
              onClick={async () => {
                await navigator.clipboard.writeText(payload!)
                toast.success("Copied to clipboard")
              }}
            >
              <CopyIcon data-icon="inline-start" />
              Copy JSON
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
