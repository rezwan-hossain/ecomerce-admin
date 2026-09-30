"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { XIcon } from "lucide-react"
import { toast } from "sonner"
import { z } from "zod"

import {
  addOptionValue,
  createOption,
  deleteOptionValue,
  updateOption,
  updateOptionValue,
} from "@/app/actions/option.actions"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { Option } from "@/types/option.type"

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50, "Keep it under 50 characters"),
  displayName: z.string().trim().max(50, "Keep it under 50 characters"),
})

type FormValues = z.infer<typeof schema>

// The "Add option" / "Edit option" side panel.
// New option: type a name and values, then create them together.
// Existing option: values are saved as soon as you add, rename or remove them;
// the name and display name are saved with "Save changes".
export function OptionFormSheet({
  open,
  onOpenChange,
  option,
  formKey,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  option: Option | null // null when adding a new option
  formKey: string // changes when the panel should start fresh
  onChanged: (openOptionId?: string) => Promise<void>
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-md">
        <OptionForm
          key={formKey}
          option={option}
          onClose={() => onOpenChange(false)}
          onChanged={onChanged}
        />
      </SheetContent>
    </Sheet>
  )
}

function OptionForm({
  option,
  onClose,
  onChanged,
}: {
  option: Option | null
  onClose: () => void
  onChanged: (openOptionId?: string) => Promise<void>
}) {
  const isNew = !option
  // Values typed before a new option exists. Existing options use option.values.
  const [draftValues, setDraftValues] = useState<string[]>([])
  const [newValue, setNewValue] = useState("")
  const [renaming, setRenaming] = useState<{ id: string; text: string } | null>(null)
  const [isBusy, setIsBusy] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: option?.name ?? "", displayName: option?.displayName ?? "" },
  })
  const { errors, isDirty, isSubmitting } = form.formState

  const values = option ? option.values.map((v) => v.value) : draftValues

  async function onSubmit({ name, displayName }: FormValues) {
    // An empty display name is sent as null, so shoppers see the name instead.
    const dto = { name, displayName: displayName || null }
    const res = option ? await updateOption(option.id, dto) : await createOption(dto)

    if (!res.success) {
      if (res.fieldErrors?.displayName) {
        form.setError("displayName", { message: res.fieldErrors.displayName })
      } else {
        form.setError("name", { message: res.fieldErrors?.name ?? res.error })
      }
      return
    }

    if (option) {
      toast.success(`${name} saved`)
      form.reset({ name, displayName })
      await onChanged()
      return
    }

    let failed = 0
    for (const value of draftValues) {
      const valueRes = await addOptionValue(res.data.id, { value })
      if (!valueRes.success) failed++
    }
    if (failed > 0) {
      toast.error(`${name} added, but ${failed} value(s) couldn't be saved`)
    } else {
      toast.success(`${name} added`)
    }
    // Keep the panel open on the new option, so more values can be added.
    await onChanged(res.data.id)
  }

  async function addValue() {
    const value = newValue.trim()
    if (!value) return
    if (values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      toast.error(`${value} is already a value`)
      return
    }

    if (!option) {
      setDraftValues([...draftValues, value])
      setNewValue("")
      return
    }

    setIsBusy(true)
    const res = await addOptionValue(option.id, { value })
    if (res.success) {
      setNewValue("")
      await onChanged()
    } else {
      toast.error(res.error)
    }
    setIsBusy(false)
  }

  async function removeValue(index: number) {
    if (!option) {
      setDraftValues(draftValues.filter((_, i) => i !== index))
      return
    }

    const value = option.values[index]
    setIsBusy(true)
    const res = await deleteOptionValue(option.id, value.id)
    if (res.success) {
      toast.success(`${value.value} removed`)
      await onChanged()
    } else {
      toast.error(res.error)
    }
    setIsBusy(false)
  }

  async function saveRename() {
    const current = option!.values.find((v) => v.id === renaming!.id)!
    const text = renaming!.text.trim()
    if (!text || text === current.value) {
      setRenaming(null)
      return
    }

    setIsBusy(true)
    const res = await updateOptionValue(option!.id, current.id, { value: text })
    if (res.success) {
      setRenaming(null)
      await onChanged()
    } else {
      toast.error(res.error)
    }
    setIsBusy(false)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex h-full flex-col">
      <SheetHeader className="border-b">
        <SheetTitle>{isNew ? "Add option" : "Edit option"}</SheetTitle>
        <SheetDescription>
          {isNew
            ? "Options like color or size become the variant choices on a product."
            : "Value changes are saved right away."}
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-4">
        <FieldGroup>
          <Field data-invalid={Boolean(errors.name)}>
            <FieldLabel htmlFor="option-name">Name</FieldLabel>
            <Input
              id="option-name"
              placeholder="e.g. Shirt Size"
              aria-invalid={Boolean(errors.name)}
              autoFocus={isNew}
              {...form.register("name")}
            />
            {errors.name ? (
              <FieldError>{errors.name.message}</FieldError>
            ) : (
              <FieldDescription>Only admins see this. It must be unique.</FieldDescription>
            )}
          </Field>

          <Field data-invalid={Boolean(errors.displayName)}>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="option-display-name">Display name</FieldLabel>
              <span className="text-xs text-muted-foreground">Optional</span>
            </div>
            <Input
              id="option-display-name"
              placeholder="e.g. Size"
              aria-invalid={Boolean(errors.displayName)}
              {...form.register("displayName")}
            />
            {errors.displayName ? (
              <FieldError>{errors.displayName.message}</FieldError>
            ) : (
              <FieldDescription>
                What shoppers see on the product page. Leave empty to show the name.
              </FieldDescription>
            )}
          </Field>

          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="option-value">Values</FieldLabel>
              <span className="text-xs text-muted-foreground">{values.length}</span>
            </div>

            {values.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {values.map((value, index) => {
                  const valueId = option?.values[index].id
                  if (renaming && renaming.id === valueId) {
                    return (
                      <Input
                        key={valueId}
                        value={renaming.text}
                        autoFocus
                        disabled={isBusy}
                        aria-label={`Rename ${value}`}
                        className="h-7 w-32"
                        onChange={(event) => setRenaming({ id: valueId, text: event.target.value })}
                        onBlur={() => setRenaming(null)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            saveRename()
                          }
                          if (event.key === "Escape") setRenaming(null)
                        }}
                      />
                    )
                  }

                  return (
                    <span
                      key={valueId ?? value}
                      className="flex h-7 items-center gap-1 rounded-md bg-muted pr-1 pl-2.5 text-sm"
                    >
                      {option ? (
                        <button
                          type="button"
                          title="Click to rename"
                          disabled={isBusy}
                          onClick={() => setRenaming({ id: valueId!, text: value })}
                          className="hover:underline"
                        >
                          {value}
                        </button>
                      ) : (
                        value
                      )}
                      <button
                        type="button"
                        aria-label={`Remove ${value}`}
                        disabled={isBusy}
                        onClick={() => removeValue(index)}
                        className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                id="option-value"
                value={newValue}
                placeholder="e.g. Red"
                disabled={isBusy}
                onChange={(event) => setNewValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    addValue()
                  }
                }}
              />
              <Button type="button" variant="outline" disabled={isBusy} onClick={addValue}>
                Add
              </Button>
            </div>
            <FieldDescription>
              {option
                ? "Click a value to rename it. Press Enter to add one."
                : "Press Enter to add each value."}
            </FieldDescription>
          </Field>
        </FieldGroup>
      </div>

      <SheetFooter className="flex-row justify-end border-t">
        <Button type="button" variant="outline" onClick={onClose}>
          {isNew ? "Cancel" : "Done"}
        </Button>
        <Button type="submit" disabled={isSubmitting || (!isNew && !isDirty)}>
          {isSubmitting ? "Saving..." : isNew ? "Create option" : "Save changes"}
        </Button>
      </SheetFooter>
    </form>
  )
}
