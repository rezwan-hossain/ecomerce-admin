// lib/api.ts

// Get the NestJS API URL from environment variables
const API_URL = process.env.NEST_API_URL;

// Make sure the API URL exists
if (!API_URL) {
  throw new Error("NEST_API_URL is not defined");
}

/**
 * Common fetch function.
 *
 * This function handles:
 * - API URL
 * - JSON headers
 * - JSON body
 * - Error handling
 * - Response parsing
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,

    headers: {
      "Content-Type": "application/json",

      // Keep any custom headers passed to the request
      ...options.headers,
    },
  });

  // If the request failed, throw an error
  if (!response.ok) {
    const error = await response.json().catch(() => null);

    throw new Error(
      error?.message || "Something went wrong with the API request",
    );
  }

  // Return the API response as JSON
  return response.json();
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
