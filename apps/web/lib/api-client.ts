import type { z } from "zod";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

export interface ApiFetchOptions<T> {
  method?: string;
  body?: unknown;
  schema?: z.ZodType<T>;
  headers?: Record<string, string>;
}

export async function apiFetch<T = unknown>(
  path: string,
  opts?: ApiFetchOptions<T>
): Promise<T> {
  const method = opts?.method ?? (opts?.body ? "POST" : "GET");
  const headers = new Headers(opts?.headers);

  let bodyData: BodyInit | undefined;
  if (opts?.body !== undefined) {
    if (opts.body instanceof FormData) {
      bodyData = opts.body;
    } else {
      headers.set("Content-Type", "application/json");
      bodyData = JSON.stringify(opts.body);
    }
  }

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: bodyData,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    throw new ApiClientError(0, "network", msg);
  }

  if (!res.ok) {
    let code: string | null = null;
    let message = res.statusText || "Request failed";
    try {
      const errJson = await res.json();
      if (errJson && typeof errJson.code === "string") {
        code = errJson.code;
      }
      if (errJson && typeof errJson.message === "string") {
        message = errJson.message;
      }
    } catch {
      // not JSON
    }
    throw new ApiClientError(res.status, code, message);
  }

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const json = await res.json();
  if (opts?.schema) {
    return opts.schema.parse(json);
  }
  return json as T;
}
