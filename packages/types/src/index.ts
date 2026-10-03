import { z } from "zod";

export * from "./user.js";
export * from "./slugs.js";
export * from "./tenancy.js";
export * from "./palette.js";

export const API_ERROR_CODES = [
  "unauthorized",
  "forbidden",
  "not_found",
  "no_file",
  "file_too_large",
  "unsupported_type",
  "image_too_large",
  "image_unreadable",
  "internal_error",
  "workspace_suspended",
  "validation_failed",
  "slug_taken",
  "slug_reserved",
  "slug_invalid",
  "name_required",
  "name_too_long",
  "status_name_taken",
  "invalid_url",
  "invalid_color",
  "tagline_too_long",
  "invalid_email",
  "already_member",
  "invite_pending",
  "not_allowed",
  "delete_default_status",
  "delete_last_status",
  "account_banned",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const ApiErrorSchema = z.object({
  code: z.enum(API_ERROR_CODES),
  message: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const UPLOAD_MAX_BYTES = 2_097_152; // D-05
export const UPLOAD_MAX_WIDTH = 1600; // D-07
export const UPLOAD_MAX_INPUT_PIXELS = 40_000_000; // D-07 decompression-bomb guard
export const UPLOAD_URL_PATTERN = /^\/uploads\/[a-z0-9/-]+\.webp$/;

export const UploadResponseSchema = z.object({
  id: z.uuid(),
  url: z.string().regex(UPLOAD_URL_PATTERN),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().positive(),
  format: z.literal("webp"),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;
