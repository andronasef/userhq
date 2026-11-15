import { z } from "zod";

/** Telemetry is a separate allowlisted contract: never serialize application DTOs. */
export const AnalyticsEventNameSchema = z.enum([
  "page_view",
  "portal_viewed",
  "content_opened",
  "search_completed",
  "search_result_opened",
  "contribution_started",
  "sign_in_required",
  "auth_started",
  "auth_failed",
  "login",
  "sign_up",
  "vote_added",
  "vote_removed",
  "comment_created",
  "feedback_created",
  "contribution_failed",
  "validation_error_shown",
  "workspace_created",
  "product_created",
  "product_configured",
  "portal_ready",
  "team_invite_accepted",
  "feedback_reviewed",
  "feedback_handled",
  "public_response_added",
  "feedback_decision_published",
  "roadmap_feedback_linked",
  "roadmap_status_changed",
  "changelog_published",
  "notification_link_opened",
  "post_auth_action_completed",
]);
export type AnalyticsEventName = z.infer<typeof AnalyticsEventNameSchema>;
export const AnalyticsPropertiesSchema = z
  .object({
    environment: z.enum(["production"]).optional(),
    release: z
      .string()
      .regex(/^[A-Za-z0-9._-]{1,80}$/)
      .optional(),
    actor_role: z.enum(["visitor", "customer", "admin", "owner"]).optional(),
    surface: z
      .enum(["marketing", "portal", "dashboard", "auth", "account", "guide"])
      .optional(),
    module: z
      .enum([
        "board",
        "roadmap",
        "changelog",
        "faq",
        "workspace",
        "team",
        "settings",
        "account",
        "auth",
      ])
      .optional(),
    action: z
      .enum([
        "vote",
        "comment",
        "feedback",
        "read",
        "configure",
        "triage",
        "publish",
      ])
      .optional(),
    method: z.enum(["google", "github"]).optional(),
    outcome: z
      .enum([
        "cancelled",
        "expired",
        "account_conflict",
        "provider_error",
        "request_failed",
        "rejected",
        "network",
        "server_error",
        "validation",
        "unknown",
      ])
      .optional(),
    channel: z.enum(["in_app", "email", "push"]).optional(),
    notification_type: z
      .enum(["reply", "status", "release", "new_post", "new_comment", "other"])
      .optional(),
    result_count: z.number().int().min(0).max(1000000).optional(),
    duration_ms: z.number().int().min(0).max(2592000000).optional(),
    resumed: z.boolean().optional(),
    workspace_id: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .optional(),
    product_id: z
      .string()
      .regex(/^[a-f0-9]{32}$/)
      .optional(),
    route: z
      .string()
      .regex(/^\/[a-zA-Z0-9_:/-]*$/)
      .max(160)
      .optional(),
  })
  .strip();
export type AnalyticsProperties = z.infer<typeof AnalyticsPropertiesSchema>;
export const AnalyticsEventSchema = z
  .object({
    name: AnalyticsEventNameSchema,
    properties: AnalyticsPropertiesSchema,
  })
  .strict();
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;
export const AnalyticsReceiptSchema = z
  .object({
    id: z.string().uuid(),
    events: z.array(AnalyticsEventSchema).max(8),
  })
  .strict();
export const ANALYTICS_RECEIPT_HEADER = "x-userhq-analytics";
export const ANALYTICS_REQUEST_HEADER = "x-userhq-browser";
