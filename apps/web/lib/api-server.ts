import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { MeResponseSchema, type MeResponse } from "@userhq/types";

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
      return { user: null };
    }
    const data = await res.json();
    return MeResponseSchema.parse(data);
  } catch (error) {
    const errorName = error instanceof Error ? error.message : String(error);
    console.error(`getMe failed: ${errorName}`);
    return { user: null };
  }
});
