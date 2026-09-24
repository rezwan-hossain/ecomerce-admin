import Link from "next/link"
import { StoreIcon } from "lucide-react"

const highlights = [
  { value: "2,847", label: "Orders this month" },
  { value: "$84K", label: "Revenue tracked" },
  { value: "3.2%", label: "Conversion rate" },
]

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <StoreIcon className="size-4" />
            </div>
            Acme Store
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          {/* Neutral (black) buttons for the auth forms; the rest of the app stays blue. */}
          <div className="w-full max-w-xs [--primary:var(--foreground)] [--primary-foreground:var(--background)] [--ring:var(--muted-foreground)]">
            {children}
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_40%),radial-gradient(circle_at_80%_70%,white_0,transparent_35%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,rgb(255_255_255/0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.07)_1px,transparent_1px)] [background-size:40px_40px]"
        />
        <div className="relative text-sm font-medium opacity-80">
          Store Admin
        </div>
        <div className="relative flex flex-col gap-8">
          <blockquote className="flex flex-col gap-3">
            <p className="text-2xl leading-snug font-medium text-balance">
              &ldquo;Everything we need to run the store — orders, products and
              inventory — in one clean dashboard.&rdquo;
            </p>
            <footer className="text-sm opacity-80">
              Sofia Davis, Operations Lead
            </footer>
          </blockquote>
          <dl className="grid grid-cols-3 gap-4 border-t border-white/20 pt-6">
            {highlights.map((item) => (
              <div key={item.label} className="flex flex-col gap-1">
                <dt className="order-2 text-xs opacity-75">{item.label}</dt>
                <dd className="order-1 text-2xl font-semibold">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
