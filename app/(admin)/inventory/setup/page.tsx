import { redirect } from "next/navigation"

// /setup has no page of its own; the breadcrumb links here.
export default function SetupPage() {
  redirect("/inventory/setup/warehouses")
}
