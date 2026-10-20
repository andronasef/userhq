import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Dialog, DialogContent } from "../components/ui/dialog";
import { DropdownMenu, DropdownMenuContent } from "../components/ui/dropdown-menu";
import { PortalAccentProvider } from "../components/portal/portal-accent-context";
import { accentStyle } from "../lib/accent";

// Mock @radix-ui/react-dialog
vi.mock("@radix-ui/react-dialog", () => ({
  Root: ({ children, open }: any) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  Trigger: ({ children }: any) => <>{children}</>,
  Portal: ({ children }: any) => <div data-testid="dialog-portal">{children}</div>,
  Overlay: () => null,
  Content: ({ children, style, className }: any) => (
    <div data-testid="dialog-content" style={style} className={className}>
      {children}
    </div>
  ),
  Header: ({ children }: any) => <div>{children}</div>,
  Title: ({ children }: any) => <h2>{children}</h2>,
  Description: ({ children }: any) => <p>{children}</p>,
  Close: ({ children }: any) => <button>{children}</button>,
}));

// Mock @radix-ui/react-dropdown-menu
vi.mock("@radix-ui/react-dropdown-menu", () => ({
  Root: ({ children }: any) => <div>{children}</div>,
  Trigger: ({ children }: any) => <>{children}</>,
  Group: ({ children }: any) => <div>{children}</div>,
  Sub: ({ children }: any) => <div>{children}</div>,
  RadioGroup: ({ children }: any) => <div>{children}</div>,
  Portal: ({ children }: any) => <div data-testid="menu-portal">{children}</div>,
  Content: ({ children, style, className }: any) => (
    <div data-testid="menu-content" style={style} className={className}>
      {children}
    </div>
  ),
  Item: ({ children }: any) => <div>{children}</div>,
  Label: ({ children }: any) => <div>{children}</div>,
  Separator: () => <hr />,
}));

describe("Portal Accent Context & Radix Portals", () => {
  it("injects product identity colors into DialogContent via PortalAccentProvider", () => {
    const style = accentStyle("#2563EB") as React.CSSProperties;
    const html = renderToStaticMarkup(
      <PortalAccentProvider value={style}>
        <Dialog open>
          <DialogContent>
            <span>Modal content</span>
          </DialogContent>
        </Dialog>
      </PortalAccentProvider>
    );

    expect(html).toContain("--primary:#2563EB");
    expect(html).toContain("--ring:#2563EB");
    expect(html).toContain("--primary-foreground:#FFFFFF");
  });

  it("injects product identity colors into DropdownMenuContent via PortalAccentProvider", () => {
    const style = accentStyle("#F59E0B") as React.CSSProperties;
    const html = renderToStaticMarkup(
      <PortalAccentProvider value={style}>
        <DropdownMenu>
          <DropdownMenuContent>
            <span>Menu item</span>
          </DropdownMenuContent>
        </DropdownMenu>
      </PortalAccentProvider>
    );

    expect(html).toContain("--primary:#F59E0B");
    expect(html).toContain("--ring:#F59E0B");
  });

  it("renders normally without portal accent when outside provider", () => {
    const html = renderToStaticMarkup(
      <Dialog open>
        <DialogContent>
          <span>Modal content</span>
        </DialogContent>
      </Dialog>
    );

    expect(html).not.toContain("--primary:#");
    expect(html).toContain("Modal content");
  });
});
