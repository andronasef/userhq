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
    "This post is linked to a roadmap item. Change its status from the roadmap or unlink it first.",
  item_title_required: "Enter an internal title.",
  item_title_length: "Internal title must be between 3 and 120 characters.",
  public_title_required: "Enter a public title.",
  public_title_length: "Public title must be between 3 and 120 characters.",
  notes_too_long: "Keep notes under 5,000 characters.",
  post_already_linked: "This post is already linked to another roadmap item.",
  item_not_found: "That roadmap item couldn't be found.",
  move_failed: "Couldn't move item. Check your connection and try again.",
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
  owned_workspaces_unresolved:
    "Choose what happens to each of your workspaces first.",
  transfer_target_invalid:
    "That person is no longer a member of {workspace}. Choose someone else.",
  platform_owner_account:
    "This is the platform owner account. It's set in server configuration and can't be deleted here.",
  title_length: "Title must be between 3 and 150 characters.",
  slug_required: "Enter a permalink slug.",
  slug_format: "Slug may only contain lowercase letters, numbers, and hyphens.",
  slug_conflict: "That slug is already in use. A unique number was appended.",
  content_required: "Content cannot be empty.",
  invalid_image_url: "Please enter a valid http:// or https:// image URL.",
  category_name_required: "Enter a category name.",
  category_not_found: "The selected category no longer exists.",
  reorder_failed: "Couldn't reorder item. Check your connection and try again.",
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
  item_title_required: "internalTitle",
  item_title_length: "internalTitle",
  public_title_required: "publicTitle",
  public_title_length: "publicTitle",
  notes_too_long: "internalNotes",
  title_length: "title",
  slug_required: "slug",
  slug_format: "slug",
  slug_conflict: "slug",
  content_required: "content",
  category_name_required: "name",
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
