import type { ApiClientError } from "./api-client";

export const API_ERROR_COPY: Record<string, string> = {
  slug_taken: "That URL is taken. Try another.",
  slug_reserved: "That URL is reserved by UserHQ. Try another.",
  slug_invalid:
    "Use 2–32 lowercase letters, numbers, and single hyphens. It can't start or end with a hyphen.",
  name_required: "Enter a name.",
  name_too_long: "Keep it under 50 characters.",
  status_name_taken: "This product already has a status with that name.",
  invalid_url: "Enter a full web address starting with https://.",
  invalid_color: "Enter a color as a 6-digit hex code, like #2563EB.",
  tagline_too_long: "Keep the tagline to 80 characters.",
  invalid_email: "Enter a valid email address.",
  already_member: "{email} is already in this workspace.",
  invite_pending:
    "There's already a pending invite for {email}. Revoke it first to create a new link.",
  not_allowed: "You no longer have access to this. Refresh the page.",
  workspace_suspended:
    "This workspace is suspended, so changes can't be saved.",
  delete_default_status: "The default status can't be deleted.",
  delete_last_status: "A product needs at least one status.",
};

export const FIELD_FOR_CODE: Record<string, string> = {
  slug_taken: "slug",
  slug_reserved: "slug",
  slug_invalid: "slug",
  name_required: "name",
  name_too_long: "name",
  status_name_taken: "name",
  invalid_url: "websiteUrl",
  invalid_color: "color",
  tagline_too_long: "tagline",
  invalid_email: "email",
  already_member: "email",
  invite_pending: "email",
};

export const NETWORK_ERROR_COPY =
  "Couldn't reach UserHQ. Check your connection and try again.";
export const GENERIC_ERROR_COPY =
  "Something went wrong on our end. Try again in a moment.";

export function errorCopy(
  err: ApiClientError | { code?: string | null; status?: number; message?: string },
  vars?: Record<string, string>
): string {
  if (err.status === 0 || err.code === "network") {
    return NETWORK_ERROR_COPY;
  }

  if (err.code && API_ERROR_COPY[err.code]) {
    let copy = API_ERROR_COPY[err.code];
    if (vars) {
      for (const [key, value] of Object.entries(vars)) {
        copy = copy.replaceAll(`{${key}}`, value);
      }
    }
    return copy;
  }

  return GENERIC_ERROR_COPY;
}
