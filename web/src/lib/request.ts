import { ApiError } from "@/lib/products/api";

const API_BASE = "/api/plugins/ecommerce-plugin";

/** A 400 response that names the fields at fault (`errors: { field: message }`). */
export class FieldErrors extends ApiError {
  fields: Record<string, string>;
  constructor(message: string, fields: Record<string, string>) {
    super(message, 400);
    this.fields = fields;
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  let data: { success?: boolean; message?: string; errors?: Record<string, string> } & Record<string, unknown>;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(`Unexpected response from the server (${res.status}).`, res.status);
  }
  if (!res.ok || data.success === false) {
    const message = data.message || `Request failed (${res.status}).`;
    if (res.status === 400 && data.errors && typeof data.errors === "object") throw new FieldErrors(message, data.errors);
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export const sendJson = <T>(method: "POST" | "PUT" | "DELETE", path: string, body?: unknown) =>
  apiRequest<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

/** Field errors from a failed save, or null when the failure wasn't about specific fields. */
export const fieldErrorsOf = (err: unknown) => (err instanceof FieldErrors ? err.fields : null);
