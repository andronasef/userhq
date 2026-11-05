import type { z } from "zod";
import {
  WorkspaceCommentItemSchema,
  type WorkspaceCommentItem,
  type ReplyWorkspaceCommentInput,
  WorkspaceRequestsResponseSchema,
  type WorkspaceRequestsResponse,
  type WorkspaceRequestsQuery,
  WorkspaceCommentsResponseSchema,
  type WorkspaceCommentsResponse,
  type WorkspaceCommentsQuery,
} from "@userhq/types";

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

export async function fetchWorkspaceRequests(
  ws: string,
  query?: WorkspaceRequestsQuery
): Promise<WorkspaceRequestsResponse> {
  const params = new URLSearchParams();
  if (query?.product) params.set("product", query.product);
  if (query?.statusId) params.set("statusId", query.statusId);
  if (query?.statusType) params.set("statusType", query.statusType);
  if (query?.categoryId) params.set("categoryId", query.categoryId);
  if (query?.search) params.set("search", query.search);
  if (query?.sort) params.set("sort", query.sort);
  if (query?.cursor) params.set("cursor", query.cursor);
  if (query?.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return apiFetch(
    `/api/v1/workspaces/${encodeURIComponent(ws)}/requests${qs ? `?${qs}` : ""}`,
    { schema: WorkspaceRequestsResponseSchema }
  );
}

export async function fetchWorkspaceComments(
  ws: string,
  query?: WorkspaceCommentsQuery
): Promise<WorkspaceCommentsResponse> {
  const params = new URLSearchParams();
  if (query?.product) params.set("product", query.product);
  if (query?.attention) params.set("attention", query.attention);
  if (query?.cursor) params.set("cursor", query.cursor);
  if (query?.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return apiFetch(
    `/api/v1/workspaces/${encodeURIComponent(ws)}/comments${qs ? `?${qs}` : ""}`,
    { schema: WorkspaceCommentsResponseSchema }
  );
}

export async function markCommentHandled(
  ws: string,
  commentId: string
): Promise<void> {
  return apiFetch(
    `/api/v1/workspaces/${encodeURIComponent(ws)}/comments/${encodeURIComponent(commentId)}/handled`,
    { method: "POST" }
  );
}

export async function reopenComment(
  ws: string,
  commentId: string
): Promise<void> {
  return apiFetch(
    `/api/v1/workspaces/${encodeURIComponent(ws)}/comments/${encodeURIComponent(commentId)}/handled`,
    { method: "DELETE" }
  );
}

export async function replyWorkspaceComment(
  ws: string,
  commentId: string,
  input: ReplyWorkspaceCommentInput
): Promise<WorkspaceCommentItem> {
  return apiFetch(
    `/api/v1/workspaces/${encodeURIComponent(ws)}/comments/${encodeURIComponent(commentId)}/reply`,
    {
      method: "POST",
      body: input,
      schema: WorkspaceCommentItemSchema,
    }
  );
}

export async function markCommentRead(
  ws: string,
  commentId: string
): Promise<void> {
  return apiFetch(
    `/api/v1/workspaces/${encodeURIComponent(ws)}/comments/${encodeURIComponent(commentId)}/read`,
    { method: "POST" }
  );
}

