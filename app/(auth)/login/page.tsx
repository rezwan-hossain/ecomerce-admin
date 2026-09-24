import type { Metadata } from "next"

import { LoginForm } from "@/components/login-form"

export const metadata: Metadata = {
  title: "Login · Ecommerce Admin",
}

export default function LoginPage() {
  return <LoginForm />
}
