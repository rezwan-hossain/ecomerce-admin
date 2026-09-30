import { connection } from "next/server"

import { getBrands } from "@/app/actions/brand.actions"
import { getCategoryTree } from "@/app/actions/category.actions"
import { getOptions } from "@/app/actions/option.actions"
import { getTags } from "@/app/actions/tag.actions"
import { getVariantTemplates } from "@/app/actions/variant-template.actions"
import { CreateProductPage } from "@/components/products/create/create-product-page"

export default async function NewProductPage() {
  // Load fresh data on every request instead of once at build time.
  await connection()

  const [brands, tags, options, categories, templates] = await Promise.all([
    getBrands(),
    getTags(),
    getOptions(),
    getCategoryTree(),
    getVariantTemplates(),
  ])

  return (
    <CreateProductPage
      initialBrands={brands.success ? brands.data.map((b) => ({ id: b.id, name: b.name })) : []}
      initialTags={tags.success ? tags.data.map((t) => ({ id: t.id, name: t.name })) : []}
      savedOptions={
        options.success
          ? options.data.map((o) => ({
              id: o.id,
              name: o.name,
              displayName: o.displayName,
              values: o.values.map((v) => v.value),
            }))
          : []
      }
      categoryTree={categories.success ? categories.data : []}
      templates={
        templates.success
          ? templates.data.map((t) => ({
              id: t.id,
              name: t.name,
              options: t.options.map((o) => ({
                name: o.option.name,
                values: o.values.map((v) => v.optionValue.value),
              })),
            }))
          : []
      }
    />
  )
}
