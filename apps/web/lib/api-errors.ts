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
  title_required: "Enter a title.",
  title_too_short: "Titles need to be at least 3 characters.",
  title_too_long: "Keep titles under 120 characters.",
  description_too_long: "Keep details under 5,000 characters.",
  category_required: "Choose a category.",
  category_invalid: "Choose a category from the list.",
  category_name_taken: "This product already has a category with that name.",
  category_name_too_long: "Keep it under 30 characters.",
  comment_required: "Write a comment.",
  comment_too_long: "Keep comments under 5,000 characters.",
  note_too_long: "Keep status notes under 1,000 characters.",
  post_locked:
    "This post is locked because someone else voted or commented on it.",
  edit_conflict:
    "Someone edited this while you were looking at it. Refresh to see the latest version.",
  rate_limited:
    "You're doing that a bit too fast. Wait a moment and try again.",
  comment_parent_mismatch: "You can only reply to a comment on this post.",
  comment_deleted: "That comment was deleted.",
  post_deleted: "That post was deleted.",
  post_merged: "That post was merged into another.",
  target_post_invalid: "Choose another post to merge into.",
  post_not_found: "That post couldn't be found.",
  cannot_vote_closed: "You can't vote on closed or completed posts.",
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
  title_required: "title",
  title_too_short: "title",
  title_too_long: "title",
  description_too_long: "description",
  category_required: "categoryId",
  category_invalid: "categoryId",
  comment_required: "body",
  comment_too_long: "body",
  note_too_long: "note",
  category_name_taken: "name",
  category_name_too_long: "name",
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
