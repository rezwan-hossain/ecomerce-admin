import "server-only"

import { ApiError } from "@/lib/api"

export type ActionResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string> }

// Runs an API call and turns thrown errors into a result the UI can show.
// (Next.js hides thrown error messages from the browser in production.)
export async function handleRequest<T>(fn: () => Promise<T>): Promise<ActionResponse<T>> {
  try {
    return { success: true, data: await fn() }
  } catch (error) {
    if (error instanceof ApiError) {
      return { success: false, error: error.message, fieldErrors: error.fieldErrors }
    }
    return { success: false, error: "Something went wrong" }
  }
}
