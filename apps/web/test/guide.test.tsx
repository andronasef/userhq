import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GuideView } from "../components/guide/guide-view";
import { SwaggerExplorer } from "../components/guide/swagger-explorer";
import { UserMenu } from "../components/user-menu";
import { DashboardSidebar } from "../components/dashboard/sidebar";
import { I18nProvider } from "../lib/i18n/context";

vi.mock("next/navigation", () => ({
  usePathname: () => "/guide",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("../components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children }: any) => <div>{children}</div>,
}));

describe("UserMenu guide link visibility", () => {
  const baseUser = {
    name: "Alex",
    email: "alex@example.com",
    image: null,
  };

  it("does not render Guide link for standard non-owner members", () => {
    const html = renderToStaticMarkup(
      <UserMenu
        user={baseUser}
        devUploadEnabled={false}
        isPlatformOwner={false}
        isWorkspaceOwner={false}
      />
    );
    expect(html).not.toContain('href="/guide"');
    expect(html).not.toContain("User guide");
  });

  it("renders Guide link when user is a workspace owner", () => {
    const html = renderToStaticMarkup(
      <UserMenu
        user={baseUser}
        devUploadEnabled={false}
        isPlatformOwner={false}
        isWorkspaceOwner={true}
      />
    );
    expect(html).toContain('href="/guide"');
    expect(html).toContain("User guide");
  });

  it("renders Guide link when user is a platform owner", () => {
    const html = renderToStaticMarkup(
      <UserMenu
        user={baseUser}
        devUploadEnabled={false}
        isPlatformOwner={true}
        isWorkspaceOwner={false}
      />
    );
    expect(html).toContain('href="/guide"');
    expect(html).toContain("User guide");
  });
});

describe("DashboardSidebar guide link visibility", () => {
  it("hides User Guide link from sidebar when user is not a workspace owner", () => {
    const html = renderToStaticMarkup(
      <DashboardSidebar
        ws="acme"
        products={[]}
        isWorkspaceOwner={false}
      />
    );
    expect(html).not.toContain('href="/guide"');
    expect(html).not.toContain("User Guide");
  });

  it("renders User Guide link in sidebar when user is a workspace owner", () => {
    const html = renderToStaticMarkup(
      <DashboardSidebar
        ws="acme"
        products={[]}
        isWorkspaceOwner={true}
      />
    );
    expect(html).toContain('href="/guide"');
    expect(html).toContain("User Guide");
  });
});

describe("SwaggerExplorer component", () => {
  it("renders API categories, search bar, and endpoints", () => {
    const html = renderToStaticMarkup(
      <SwaggerExplorer
        workspaces={[{ slug: "acme", name: "Acme Corp" }]}
      />
    );

    // Search bar and workspace selector
    expect(html).toContain("Search endpoints by path, verb, scope, or keyword");
    expect(html).toContain("Acme Corp (acme)");

    // Key category filters
    expect(html).toContain("Feedback Requests");
    expect(html).toContain("Comments &amp; Attention");
    expect(html).toContain("Roadmap");
    expect(html).toContain("Changelog");
    expect(html).toContain("Webhooks");

    // Endpoint paths
    expect(html).toContain("/api/v1/workspaces/");
    expect(html).toContain("/requests");
    expect(html).toContain("/comments");
    expect(html).toContain("/roadmap");
    expect(html).toContain("/changelog");

    // Method badges
    expect(html).toContain("GET");
    expect(html).toContain("POST");
    expect(html).toContain("PUT");
  });
});

describe("GuideView Rubix-style documentation", () => {
  it("renders user-centric documentation for workspace admins without internal developer policies", () => {
    const html = renderToStaticMarkup(
      <GuideView
        workspaces={[{ slug: "acme", name: "Acme Corp", role: "owner" }]}
        isPlatformOwner={false}
      />
    );

    // Header badges and internal developer policies removed
    expect(html).not.toContain("Workspace Owners Only");
    expect(html).not.toContain("Platform Owner");
    expect(html).not.toContain("LLM Rules");
    expect(html).not.toContain("AGENTS.md");
    expect(html).not.toContain("docs/user-guide.md");

    // Scrollable navigation sidebar
    expect(html).toContain("overflow-y-auto");
    expect(html).toContain("Search topics...");

    // User-facing sections
    expect(html).toContain("User Guide &amp; API Reference");
    expect(html).toContain("Overview &amp; Structure");
    expect(html).toContain("Roles &amp; Team Permissions");
    expect(html).toContain("Requests (All Boards) &amp; Triage");
    expect(html).toContain("Comments &amp; Needs Attention Inbox");
    expect(html).toContain("Author Contact &amp; Location Insights");
    expect(html).toContain("Public Customer Portals");
    expect(html).toContain("Roadmap Planning &amp; Release Notes");
    expect(html).toContain("Self-Serve FAQ Knowledge Base");
    expect(html).toContain("Interactive API Explorer");
    expect(html).toContain("Webhooks &amp; HMAC Signature Verification");
  });

  it("renders Arabic localized markdown guide when locale is ar", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="ar">
        <GuideView
          workspaces={[{ slug: "acme", name: "Acme Corp", role: "owner" }]}
          isPlatformOwner={false}
        />
      </I18nProvider>
    );

    // RTL layout
    expect(html).toContain('dir="rtl"');

    // Arabic Header & Breadcrumbs
    expect(html).toContain("دليل الاستخدام ومرجع الـ API");
    expect(html).toContain("دليل منصة UserHQ وواجهة البرمجة (API)");
    expect(html).toContain("البحث في الموضوعات...");

    // Arabic Sections
    expect(html).toContain("نظرة عامة وهيكل مساحة العمل");
    expect(html).toContain("الأدوار وصلاحيات الفريق");
    expect(html).toContain("صندوق الطلبات الموحد والفرز");
    expect(html).toContain("صندوق التعليقات والملاحظات التي تحتاج انتباهاً");
    expect(html).toContain("بيانات وتواصل أصحاب الطلبات والموقع الجغرافي");
    expect(html).toContain("بوابات العملاء العامة");
    expect(html).toContain("خريطة الطريق وسجل التحديثات");
    expect(html).toContain("قاعدة معرفة الأسئلة الشائعة الذاتية");
    expect(html).toContain("مستعرض API التفاعلي");
    expect(html).toContain("الـ Webhooks والتحقق من توقيع HMAC");

    // Interactive Swagger explorer still embedded in Arabic view
    expect(html).toContain("Search endpoints by path, verb, scope, or keyword");
  });

  it("renders localized guide across all 13 supported locales", () => {
    const locales = [
      "en", "ar", "de", "es", "fr", "ja", "ko", "pt", "ru", "zh", "fil", "hi", "id",
    ];

    for (const loc of locales) {
      const html = renderToStaticMarkup(
        <I18nProvider initialLocale={loc as any}>
          <GuideView
            workspaces={[{ slug: "acme", name: "Acme Corp", role: "owner" }]}
            isPlatformOwner={false}
          />
        </I18nProvider>
      );

      expect(html).toContain("acme");
      expect(html).toContain("overview");
      expect(html).toContain("roles-permissions");
      expect(html).toContain("requests-inbox");
      expect(html).toContain("comments-attention");
      expect(html).toContain("author-location");
      expect(html).toContain("customer-portals");
      expect(html).toContain("roadmap-changelog");
      expect(html).toContain("faq-system");
      expect(html).toContain("themes-push");
      expect(html).toContain("api-overview");
      expect(html).toContain("swagger-explorer");
      expect(html).toContain("webhooks-hmac");
    }
  });
});

