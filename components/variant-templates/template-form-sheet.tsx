"use client"

import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2Icon } from "lucide-react"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import type { ActionResponse } from "@/lib/action-response"
import { cn } from "@/lib/utils"
import type { Option } from "@/types/option.type"
import type { CreateVariantTemplateDto, VariantTemplate } from "@/types/variant-template.type"

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Keep it under 100 characters"),
  description: z.string().trim().max(500, "Keep it under 500 characters"),
  options: z
    .array(
      z.object({
        optionId: z.string(),
        optionValueIds: z.array(z.string()).min(1, "Pick at least one value"),
      })
    )
    .min(1, "Add at least one option"),
})

type FormValues = z.infer<typeof schema>

const PREVIEW_COUNT = 6

// The "Add template" / "Edit template" side panel.
// Render with key={…} so each open starts with a fresh form.
export function TemplateFormSheet({
  open,
  onOpenChange,
  template,
  options,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: VariantTemplate | null // null when adding a new template
  options: Option[] // every option, from the Options page
  onSave: (values: CreateVariantTemplateDto) => Promise<ActionResponse<VariantTemplate>>
}) {
  const isNew = !template

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: template?.name ?? "",
      description: template?.description ?? "",
      options: (template?.options ?? []).map((templateOption) => ({
        optionId: templateOption.optionId,
        optionValueIds: templateOption.values.map((v) => v.optionValueId),
      })),
    },
  })
  const { errors, isSubmitting } = form.formState
  const chosen = form.watch("options")

  const unusedOptions = options.filter((o) => !chosen.some((c) => c.optionId === o.id))

  // Every combination of the chosen values, e.g. "S / Red", "S / Blue", …
  let combinations: string[][] = [[]]
  for (const choice of chosen) {
    const option = options.find((o) => o.id === choice.optionId)!
    const values = option.values.filter((v) => choice.optionValueIds.includes(v.id))
    combinations = combinations.flatMap((combo) => values.map((v) => [...combo, v.value]))
  }
  const variantCount = chosen.length > 0 ? combinations.length : 0

  function setChosen(next: FormValues["options"]) {
    form.setValue("options", next, { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
  }

  function addOption(optionId: string) {
    const option = options.find((o) => o.id === optionId)!
    setChosen([...chosen, { optionId, optionValueIds: option.values.map((v) => v.id) }])
  }

  function setValues(index: number, optionValueIds: string[]) {
    const next = [...chosen]
    next[index] = { ...chosen[index], optionValueIds }
    setChosen(next)
  }

  function toggleValue(index: number, valueId: string) {
    const ids = chosen[index].optionValueIds
    if (ids.includes(valueId)) {
      setValues(index, ids.filter((id) => id !== valueId))
    } else {
      setValues(index, [...ids, valueId])
    }
  }

  async function onSubmit(values: FormValues) {
    const res = await onSave(values)
    if (res.success) return

    if (res.fieldErrors?.name) {
      form.setError("name", { message: res.fieldErrors.name })
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex h-full flex-col">
          <SheetHeader className="border-b">
            <SheetTitle>{isNew ? "Add variant template" : "Edit variant template"}</SheetTitle>
            <SheetDescription>
              A preset of options and values, like &quot;T-Shirt&quot; = Size + Color, to fill in a
              product&apos;s variants quickly.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            <FieldGroup>
              <Field data-invalid={Boolean(errors.name)}>
                <FieldLabel htmlFor="template-name">Name</FieldLabel>
                <Input
                  id="template-name"
                  placeholder="e.g. T-Shirt"
                  aria-invalid={Boolean(errors.name)}
                  autoFocus={isNew}
                  {...form.register("name")}
                />
                <FieldError>{errors.name?.message}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.description)}>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="template-description">Description</FieldLabel>
                  <span className="text-xs text-muted-foreground">Optional</span>
                </div>
                <Textarea
                  id="template-description"
                  rows={2}
                  placeholder="e.g. Unisex tops in standard sizes"
                  aria-invalid={Boolean(errors.description)}
                  {...form.register("description")}
                />
                <FieldError>{errors.description?.message}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.options?.message)}>
                <div className="flex items-center justify-between">
                  <FieldLabel>Options</FieldLabel>
                  {variantCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Makes {variantCount} {variantCount === 1 ? "variant" : "variants"}
                    </span>
                  )}
                </div>

                {options.length === 0 ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    No options yet.{" "}
                    <Link href="/products/options" className="text-primary underline-offset-2 hover:underline">
                      Create options
                    </Link>{" "}
                    like Size or Color first.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {chosen.map((choice, index) => {
                      const option = options.find((o) => o.id === choice.optionId)!
                      const valueError = errors.options?.[index]?.optionValueIds?.message
                      const allSelected = choice.optionValueIds.length === option.values.length

                      return (
                        <div key={choice.optionId} className="flex flex-col gap-3 rounded-lg border p-3">
                          <div className="flex items-center gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{option.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {choice.optionValueIds.length} of {option.values.length} values
                                {option.displayName && ` · Shown as ${option.displayName}`}
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground"
                              onClick={() =>
                                setValues(index, allSelected ? [] : option.values.map((v) => v.id))
                              }
                            >
                              {allSelected ? "Clear" : "Select all"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground"
                              aria-label={`Remove ${option.name}`}
                              onClick={() => setChosen(chosen.filter((_, i) => i !== index))}
                            >
                              <Trash2Icon />
                            </Button>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {option.values.map((value) => {
                              const selected = choice.optionValueIds.includes(value.id)
                              return (
                                <button
                                  key={value.id}
                                  type="button"
                                  aria-pressed={selected}
                                  onClick={() => toggleValue(index, value.id)}
                                  className={cn(
                                    "h-7 rounded-md border px-2.5 text-sm transition-colors",
                                    selected
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                  )}
                                >
                                  {value.value}
                                </button>
                              )
                            })}
                            {option.values.length === 0 && (
                              <span className="text-sm text-muted-foreground">
                                This option has no values yet.
                              </span>
                            )}
                          </div>

                          {valueError && <p className="text-sm text-destructive">{valueError}</p>}
                        </div>
                      )
                    })}

                    {unusedOptions.length > 0 && (
                      <Select
                        value={null}
                        onValueChange={(value) => value && addOption(value)}
                        items={unusedOptions.map((o) => ({ value: o.id, label: o.name }))}
                      >
                        <SelectTrigger className="w-full" aria-label="Add an option">
                          <SelectValue placeholder="+ Add an option" />
                        </SelectTrigger>
                        <SelectContent>
                          {unusedOptions.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                <FieldError>{errors.options?.message}</FieldError>

                {variantCount > 0 && (
                  <FieldDescription>
                    {combinations
                      .slice(0, PREVIEW_COUNT)
                      .map((combo) => combo.join(" / "))
                      .join(", ")}
                    {variantCount > PREVIEW_COUNT && `, +${variantCount - PREVIEW_COUNT} more`}
                  </FieldDescription>
                )}
              </Field>
            </FieldGroup>
          </div>

          <SheetFooter className="flex-row justify-end border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isNew ? "Add template" : "Save changes"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
