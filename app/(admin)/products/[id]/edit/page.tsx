import { notFound } from "next/navigation"

import { ProductForm } from "@/components/products/product-form"
import { getProduct, products } from "@/lib/demo-data"

export function generateStaticParams() {
  return products.map((p) => ({ id: p.id }))
}

export default async function EditProductPage({
  params,
}: PageProps<"/products/[id]/edit">) {
  const { id } = await params
  const product = getProduct(id)
  if (!product) notFound()

  return <ProductForm product={product} />
}
