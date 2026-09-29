import { getBrands } from "@/app/actions/brand.actions";
import { BrandsManager } from "@/components/brands/brands-manager";
import { connection } from "next/server";

export default async function BrandsPage() {
  // Load fresh data on every request instead of once at build time.
  await connection();

  const res = await getBrands();

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <BrandsManager initial={res.success ? res.data : []} />
    </div>
  );
}
