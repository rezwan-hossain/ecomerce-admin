// lib/api.ts
import "server-only";

// Get the NestJS API URL from environment variables
const API_URL = process.env.NEST_API_URL;

// Make sure the API URL exists
if (!API_URL) {
  throw new Error("NEST_API_URL is not defined");
}

/**
 * The error thrown when the API answers with a failure (4xx / 5xx), or can't
 * be reached at all (status 0).
 *
 * It keeps the details a form needs:
 *   error.message      "Category with this slug already exists"
 *   error.status       409
 *   error.fieldErrors  { slug: "…" }   ← from nestjs-zod "Validation failed"
 */
export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(
    message: string,
    status: number,
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * The error body NestJS sends back. Validation errors from nestjs-zod look
 * like: { statusCode: 400, message: "Validation failed",
 *         errors: [{ path: ["slug"], message: "…" }] }
 */
type NestErrorBody = {
  message?: string | string[];
  errors?: { path?: (string | number)[]; message?: string }[];
};

function toApiError(body: NestErrorBody | null, status: number) {
  // Turn [{ path: ["slug"], message }] into { slug: message }
  const fieldErrors: Record<string, string> = {};
  for (const issue of body?.errors ?? []) {
    const field = issue.path?.[0];
    if (typeof field === "string" && issue.message && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }

  const message = Array.isArray(body?.message)
    ? body.message.join(", ")
    : body?.message || "Something went wrong with the API request";

  return new ApiError(
    message,
    status,
    Object.keys(fieldErrors).length ? fieldErrors : undefined,
  );
}

/**
 * Common fetch function.
 *
 * This function handles:
 * - API URL
 * - JSON headers
 * - JSON body
 * - Error handling (throws ApiError)
 * - Response parsing (empty responses like 204 return undefined)
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,

      headers: {
        "Content-Type": "application/json",

        // Keep any custom headers passed to the request
        ...options.headers,
      },
    });
  } catch {
    // The server is down or the URL is wrong.
    throw new ApiError("Can't reach the server. Is the API running?", 0);
  }

  // Read the body as text first: some responses (like 204) are empty.
  const text = await response.text();
  const body = text ? safeJson(text) : null;

  // If the request failed, throw an error
  if (!response.ok) {
    throw toApiError(body as NestErrorBody | null, response.status);
  }

  // Return the API response as JSON
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * GET request
 *
 * Example:
 * api.get<Category[]>("/categories")
 */
export const api = {
  get: <T>(endpoint: string) => {
    return request<T>(endpoint, {
      method: "GET",
    });
  },

  /**
   * POST request
   *
   * Example:
   * api.post<Category>("/categories", categoryData)
   */
  post: <T>(endpoint: string, data: unknown) => {
    return request<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * PUT request
   */
  put: <T>(endpoint: string, data: unknown) => {
    return request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  /**
   * PATCH request
   */
  patch: <T>(endpoint: string, data: unknown) => {
    return request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /**
   * DELETE request
   */
  delete: <T>(endpoint: string) => {
    return request<T>(endpoint, {
      method: "DELETE",
    });
  },
};
