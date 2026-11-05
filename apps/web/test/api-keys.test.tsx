import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkspaceApiKeysManager } from "../components/api-keys/api-keys-manager";
import { CreateApiKeyDialog } from "../components/api-keys/create-api-key-dialog";
import type { ApiKeyMetadata, ProductSummary } from "@userhq/types";

// Mock @radix-ui/react-dialog so portal renders in static SSR environment
vi.mock("@radix-ui/react-dialog", () => ({
  Root: ({ children, open }: any) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  Trigger: ({ children }: any) => <div data-testid="dialog-trigger">{children}</div>,
  Portal: ({ children }: any) => <div data-testid="dialog-portal">{children}</div>,
  Overlay: ({ children }: any) => <div data-testid="dialog-overlay">{children}</div>,
  Content: ({ children, className }: any) => <div data-testid="dialog-content" className={className}>{children}</div>,
  Title: ({ children, className }: any) => <div data-testid="dialog-title" className={className}>{children}</div>,
  Description: ({ children, className }: any) => <div data-testid="dialog-desc" className={className}>{children}</div>,
  Close: ({ children }: any) => <div data-testid="dialog-close">{children}</div>,
}));

// Mock @radix-ui/react-alert-dialog
vi.mock("@radix-ui/react-alert-dialog", () => ({
  Root: ({ children, open }: any) => (open ? <div data-testid="alert-dialog-root">{children}</div> : null),
  Trigger: ({ children }: any) => <div>{children}</div>,
  Portal: ({ children }: any) => <div>{children}</div>,
  Overlay: ({ children }: any) => <div>{children}</div>,
  Content: ({ children }: any) => <div>{children}</div>,
  Title: ({ children }: any) => <div>{children}</div>,
  Description: ({ children }: any) => <div>{children}</div>,
  Action: ({ children }: any) => <div>{children}</div>,
  Cancel: ({ children }: any) => <div>{children}</div>,
}));

const mockProducts: ProductSummary[] = [
  {
    id: "p1",
    slug: "mobile-app",
    name: "Mobile App",
    logoUrl: null,
    accentColor: "#000000",
    features: { board: true, roadmap: true, changelog: true, faq: true },
  },
  {
    id: "p2",
    slug: "web-app",
    name: "Web App",
    logoUrl: null,
    accentColor: "#000000",
    features: { board: true, roadmap: true, changelog: true, faq: true },
  },
];

const mockKeys: ApiKeyMetadata[] = [
  {
    id: "key-1",
    workspaceId: "ws-1",
    name: "CI/CD Pipeline",
    keyPrefix: "uhq_live_abc12345",
    scopes: ["export:read", "requests:read"],
    productRestrictions: null,
    createdByUserId: "user-1",
    lastUsedAt: "2026-03-30T10:00:00Z",
    expiresAt: null,
    revokedAt: null,
    createdAt: "2026-03-01T10:00:00Z",
    updatedAt: "2026-03-01T10:00:00Z",
  },
  {
    id: "key-2",
    workspaceId: "ws-1",
    name: "Old Zapier Webhook",
    keyPrefix: "uhq_live_xyz98765",
    scopes: ["admin"],
    productRestrictions: ["p1"],
    createdByUserId: "user-1",
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: "2026-03-15T12:00:00Z",
    createdAt: "2026-02-01T10:00:00Z",
    updatedAt: "2026-03-15T12:00:00Z",
  },
];

describe("WorkspaceApiKeysManager", () => {
  it("renders empty state when no keys exist", () => {
    const html = renderToStaticMarkup(
      <WorkspaceApiKeysManager ws="acme" initialKeys={[]} products={mockProducts} />
    );

    expect(html).toContain("No API keys created yet");
    expect(html).toContain("Create API Key");
  });

  it("renders table with active and revoked keys, scopes badges, and prefix", () => {
    const html = renderToStaticMarkup(
      <WorkspaceApiKeysManager ws="acme" initialKeys={mockKeys} products={mockProducts} />
    );

    expect(html).toContain("CI/CD Pipeline");
    expect(html).toContain("uhq_live_abc12345");
    expect(html).toContain("export:read");
    expect(html).toContain("requests:read");
    expect(html).toContain("All products");
    expect(html).toContain("Active");

    expect(html).toContain("Old Zapier Webhook");
    expect(html).toContain("uhq_live_xyz98765");
    expect(html).toContain("admin");
    expect(html).toContain("Mobile App");
    expect(html).toContain("Revoked");
  });
});

describe("CreateApiKeyDialog", () => {
  it("renders form elements and scope checkboxes when open", () => {
    const html = renderToStaticMarkup(
      <CreateApiKeyDialog
        open={true}
        onOpenChange={() => {}}
        ws="acme"
        products={mockProducts}
        onKeyCreated={() => {}}
      />
    );

    expect(html).toContain("Create workspace API key");
    expect(html).toContain("Key Name");
    expect(html).toContain("Permissions &amp; Scopes");
    expect(html).toContain("Full Admin (admin)");
    expect(html).toContain("Export Feedback (export:read)");
    expect(html).toContain("Manage Requests (requests:write)");
    expect(html).toContain("Product Scope");
    expect(html).toContain("Generate key");
  });
});
