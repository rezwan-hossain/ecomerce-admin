import { notFound } from "next/navigation"
import { connection } from "next/server"

import { getBrands } from "@/app/actions/brand.actions"
import { getCategoryTree } from "@/app/actions/category.actions"
import { getOptions } from "@/app/actions/option.actions"
import { getProduct } from "@/app/actions/product.actions"
import { getTags } from "@/app/actions/tag.actions"
import { CreateProductPage } from "@/components/products/create/create-product-page"

// Reuses the Create product page, prefilled with the saved product.
export default async function EditProductPage({ params }: PageProps<"/products/[id]/edit">) {
  await connection()
  const { id } = await params

  const [product, brands, tags, options, categories] = await Promise.all([
    getProduct(id),
    getBrands(),
    getTags(),
    getOptions(),
    getCategoryTree(),
  ])
  if (!product.success) notFound()

  return (
    <CreateProductPage
      product={product.data}
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
      templates={[]}
    />
  )
}
