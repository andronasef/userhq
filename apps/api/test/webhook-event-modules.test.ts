import { describe, it, expect } from "vitest";
import { WEBHOOK_EVENTS } from "@userhq/types";
import { webhookEventModule } from "../src/webhooks/outbox.js";

// AF-03: every concrete webhook event belongs to a product module or is deliberately ungated.
// A new event must be classified here, or the module gate (enqueue, delivery and suppression) silently skips it.
const EVENT_MODULES = {
  "post.created": "board",
  "post.updated": "board",
  "post.status_changed": "board",
  "post.deleted": "board",
  "post.merged": "board",
  "post.restored": "board",
  "comment.created": "board",
  "comment.deleted": "board",
  "comment.restored": "board",
  "changelog.published": "changelog",
} as const;

describe("webhook event to module classification (AF-03)", () => {
  it("classifies every concrete WEBHOOK_EVENTS entry", () => {
    const concrete = WEBHOOK_EVENTS.filter((e) => e !== "*").sort();
    expect(
      Object.keys(EVENT_MODULES).sort(),
      "WEBHOOK_EVENTS changed: add the new event to EVENT_MODULES (board or changelog) so the module gate covers it",
    ).toEqual(concrete);
  });

  it("webhookEventModule agrees with the table, and pings stay ungated", () => {
    for (const [event, module] of Object.entries(EVENT_MODULES)) {
      expect(webhookEventModule(event), event).toBe(module);
    }
    expect(webhookEventModule("ping")).toBeNull();
  });
});
