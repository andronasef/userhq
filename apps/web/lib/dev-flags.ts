export function isDevUploadEnabled(): boolean {
  return process.env.DEV_UPLOAD_PAGE === "true";
}
