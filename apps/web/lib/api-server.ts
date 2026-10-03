import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { z } from "zod";
import {
  MeResponseSchema,
  type MeResponse,
  PublicPortalProductSchema,
  type PublicPortalProduct,
  WorkspaceSchema,
  type Workspace,
  InviteRowSchema,
  type InviteRow,
  InviteLookupSchema,
  type InviteLookup,
  ANONYMOUS_ME,
} from "@userhq/types";

export async function apiServer(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const apiInternalUrl = process.env.API_INTERNAL_URL;
  if (!apiInternalUrl) {
    throw new Error(
      "apiServer: API_INTERNAL_URL environment variable is required"
    );
  }

  const incomingHeaders = await headers();
  const cookie = incomingHeaders.get("cookie") ?? "";

  const targetUrl = new URL(path, apiInternalUrl);

  const forwardHeaders = new Headers();
  if (cookie) {
    forwardHeaders.set("cookie", cookie);
  }

  if (init?.headers) {
    const customHeaders = new Headers(init.headers);
    for (const [k, v] of customHeaders.entries()) {
      if (k.toLowerCase() !== "host" && k.toLowerCase() !== "cookie") {
        forwardHeaders.set(k, v);
      }
    }
  }

  return fetch(targetUrl, {
    ...init,
    headers: forwardHeaders,
    cache: "no-store",
  });
}

export const getMe: () => Promise<MeResponse> = cache(async () => {
  try {
    const res = await apiServer("/api/v1/me");
    if (!res.ok) {
      console.error(`getMe failed: ${res.status}`);
      return ANONYMOUS_ME;
    }
    const data = await res.json();
    return MeResponseSchema.parse(data);
  } catch (error) {
    const errorName = error instanceof Error ? error.message : String(error);
    console.error(`getMe failed: ${errorName}`);
    return ANONYMOUS_ME;
  }
});

export type ApiReadResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string | null };

export async function apiRead<T>(
  path: string,
  schema: z.ZodType<T>
): Promise<ApiReadResult<T>> {
  const res = await apiServer(path, { method: "GET" });

  if (res.ok) {
    const json = await res.json();
    return { ok: true, data: schema.parse(json) };
  }

  if (res.status >= 400 && res.status < 500) {
    let code: string | null = null;
    try {
      const errJson = await res.json();
      if (errJson && typeof errJson.code === "string") {
        code = errJson.code;
      }
    } catch {
      // unreadable body
    }
    return { ok: false, status: res.status, code };
  }

  throw new Error(`apiRead error: ${res.status} ${res.statusText} for ${path}`);
}

export const getPortalProduct = cache(
  (ws: string, product: string): Promise<ApiReadResult<PublicPortalProduct>> => {
    return apiRead(
      "/api/v1/portal/" + encodeURIComponent(ws) + "/" + encodeURIComponent(product),
      PublicPortalProductSchema
    );
  }
);

export const getWorkspace = cache(
  (ws: string): Promise<ApiReadResult<Workspace>> => {
    return apiRead(
      "/api/v1/workspaces/" + encodeURIComponent(ws),
      WorkspaceSchema
    );
  }
);

export const getPlatformInvites = cache((): Promise<ApiReadResult<InviteRow[]>> => {
  return apiRead("/api/v1/platform/invites", z.array(InviteRowSchema));
});

export const getInvite = cache((token: string): Promise<ApiReadResult<InviteLookup>> => {
  return apiRead("/api/v1/invites/" + encodeURIComponent(token), InviteLookupSchema);
});

export async function publicHost(): Promise<string> {
  const incomingHeaders = await headers();
  return (
    incomingHeaders.get("x-forwarded-host") ??
    incomingHeaders.get("host") ??
    "localhost:8080"
  );
}

