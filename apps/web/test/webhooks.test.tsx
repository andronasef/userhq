import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceWebhooksManager } from "../components/webhooks/webhooks-manager";
import { WebhookSecretDialog } from "../components/webhooks/webhook-secret-dialog";
import type { WebhookSubscription, ProductSummary } from "@userhq/types";

vi.mock("@radix-ui/react-dialog", () => ({
  Root: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  Trigger: ({ children }: any) => <div>{children}</div>,
  Portal: ({ children }: any) => <div>{children}</div>,
  Overlay: ({ children }: any) => <div>{children}</div>,
  Content: ({ children }: any) => <div>{children}</div>,
  Title: ({ children }: any) => <div>{children}</div>,
  Description: ({ children }: any) => <div>{children}</div>,
  Close: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@radix-ui/react-alert-dialog", () => ({
  Root: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  Trigger: ({ children }: any) => <div>{children}</div>,
  Portal: ({ children }: any) => <div>{children}</div>,
  Overlay: ({ children }: any) => <div>{children}</div>,
  Content: ({ children }: any) => <div>{children}</div>,
  Title: ({ children }: any) => <div>{children}</div>,
  Description: ({ children }: any) => <div>{children}</div>,
  Action: ({ children }: any) => <div>{children}</div>,
  Cancel: ({ children }: any) => <div>{children}</div>,
}));

const products: ProductSummary[] = [];

const sub: WebhookSubscription = {
  id: "sub-1",
  workspaceId: "ws-1",
  url: "https://hooks.example.com/userhq",
  events: ["post.created"],
  productRestrictions: null,
  description: null,
  isActive: true,
  createdByUserId: "user-1",
  createdAt: "2026-03-01T10:00:00Z",
  updatedAt: "2026-03-01T10:00:00Z",
};

describe("WorkspaceWebhooksManager", () => {
  it("renders no signing secret and offers rotation", () => {
    const html = renderToStaticMarkup(
      <WorkspaceWebhooksManager ws="acme" initialSubscriptions={[sub]} products={products} />
    );
    expect(html).toContain("https://hooks.example.com/userhq");
    expect(html).not.toContain("whsec_");
    expect(html).not.toContain("Secret:");
    expect(html).toContain("Rotate secret");
    expect(html).toContain('data-testid="rotate-webhook-sub-1"');
  });
});

describe("WebhookSecretDialog", () => {
  it("shows the rotated secret once with a warning", () => {
    const html = renderToStaticMarkup(
      <WebhookSecretDialog open onOpenChange={() => {}} url={sub.url} secret="whsec_rotated123" />
    );
    expect(html).toContain("whsec_rotated123");
    expect(html).toContain("will not be shown again");
  });
});
