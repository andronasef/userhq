import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { UserMenu } from "../components/user-menu";
import { LanguagePreference } from "../app/(app)/account/language-preference";
import { SUPPORTED_LOCALES, LOCALE_CATALOG } from "@userhq/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/account",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock DropdownMenu primitives for SSR markup verification
vi.mock("../components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: any) => <div data-testid="submenu">{children}</div>,
  DropdownMenuSubTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children }: any) => <div>{children}</div>,
}));

describe("Language Switcher in UserMenu and Account Settings", () => {
  const baseUser = {
    name: "Alex",
    email: "alex@example.com",
    image: null,
  };

  it("renders Language submenu in UserMenu with all supported locales", () => {
    const html = renderToStaticMarkup(
      <UserMenu
        user={baseUser}
        devUploadEnabled={false}
        isPlatformOwner={false}
        isWorkspaceOwner={false}
      />
    );

    // Language submenu trigger exists
    expect(html).toContain("Language");

    // All supported locales should be rendered in the dropdown options
    for (const code of SUPPORTED_LOCALES) {
      const meta = LOCALE_CATALOG[code];
      expect(html).toContain(meta.nativeName);
    }
  });

  it("renders LanguagePreference component in Account settings with all 13 locales in select options", () => {
    const html = renderToStaticMarkup(<LanguagePreference />);

    expect(html).toContain("Language");
    for (const code of SUPPORTED_LOCALES) {
      const meta = LOCALE_CATALOG[code];
      expect(html).toContain(`value="${code}"`);
      expect(html).toContain(meta.nativeName);
    }
  });
});
