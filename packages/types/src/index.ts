import { z } from "zod";

export const PublicUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
});
export type PublicUser = z.infer<typeof PublicUserSchema>;

export const MeResponseSchema = z.object({
  user: PublicUserSchema.nullable(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

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
  url: z.string().regex(UPLOAD_URL_PATTERN),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().positive(),
  format: z.literal("webp"),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;
