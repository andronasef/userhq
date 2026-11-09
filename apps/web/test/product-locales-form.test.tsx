import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ProductLocalesForm,
  LocaleSwapConfirmation,
} from "../app/dashboard/[ws]/[product]/settings/product-locales-form";
import type { ProductDetail } from "@userhq/types";
import { I18nProvider } from "../lib/i18n/context";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock("../components/ui/dialog", () => ({
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogHeader: ({ children }: any) => <header>{children}</header>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
}));

const mockProduct: ProductDetail = {
  features: { board: true, roadmap: true, changelog: true, faq: true },
  slug: "core",
  name: "Core App",
  accentColor: "#2563EB",
  accentTextColor: null,
  logoUrl: null,
  logoUploadId: null,
  tagline: "The best product",
  websiteUrl: "https://example.com",
  locales: {
    defaultLocale: "en",
    enabledLocales: ["en", "ar", "es"],
  },
};

describe("ProductLocalesForm & Swap Confirmation", () => {
  const previewProps = {
    open: true,
    onOpenChange: vi.fn(),
    loadingPreview: false,
    swapStats: {
      changelog: { total: 5, promoted: 3, fallback: 2 },
      faq: { total: 2, promoted: 2, fallback: 0 },
      roadmap: { total: 4, promoted: 1, fallback: 3 },
    },
    previewTarget: "es" as const,
    defaultLocale: "es" as const,
    previewError: false,
    saving: false,
    onRetry: vi.fn(),
    onConfirm: vi.fn(),
  };

  it.each([
    { loadingPreview: true },
    { swapStats: null },
    { previewTarget: "ar" as const },
    { saving: true },
  ])(
    "disables confirmation without a completed preview for the chosen language: %j",
    (override) => {
      const html = renderToStaticMarkup(
        <LocaleSwapConfirmation {...previewProps} {...override} />,
      );
      const buttons = html.match(/<button\b[^>]*>/g)!;
      expect(buttons.at(-1)).toContain('disabled=""');
    },
  );

  it("shows a retryable error and disables confirmation if the preview fails", () => {
    const html = renderToStaticMarkup(
      <LocaleSwapConfirmation
        {...previewProps}
        swapStats={null}
        previewError
      />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("Could not load the impact preview");
    expect(html).toContain("Retry preview");
    expect(html.match(/<button\b[^>]*>/g)!.at(-1)).toContain('disabled=""');
  });

  it("shows impact counts and enables confirmation for the completed preview", () => {
    const html = renderToStaticMarkup(
      <LocaleSwapConfirmation {...previewProps} />,
    );
    expect(html).toContain("Changelog");
    expect(html).toContain("FAQ");
    expect(html).toContain("Roadmap");
    expect(html).toContain("promoted to primary");
    expect(html).toContain("keep existing fallback");
    expect(html.match(/<button\b[^>]*>/g)!.at(-1)).not.toContain('disabled=""');
  });

  it("renders preview failure and retry controls in Arabic", () => {
    const html = renderToStaticMarkup(
      <I18nProvider initialLocale="ar">
        <LocaleSwapConfirmation {...previewProps} swapStats={null} previewError />
      </I18nProvider>,
    );
    expect(html).toContain("تعذّر تحميل معاينة التأثير");
    expect(html).toContain("إعادة تحميل المعاينة");
    expect(html).not.toContain("Retry preview");
  });

  it("renders default language select and enabled languages list", () => {
    const html = renderToStaticMarkup(
      <ProductLocalesForm ws="acme" product={mockProduct} />,
    );

    expect(html).toContain("Languages &amp; Localization");
    expect(html).toContain("Primary / Default Language");
    expect(html).toContain("Enabled Languages for Portal &amp; Entries");
    expect(html).toContain("English (English)");
    expect(html).toContain("العربية (Arabic) — RTL");
    expect(html).toContain("Default");
  });

  it("renders all 13 supported languages in the selection grid", () => {
    const html = renderToStaticMarkup(
      <ProductLocalesForm ws="acme" product={mockProduct} />,
    );

    expect(html).toContain("English");
    expect(html).toContain("العربية");
    expect(html).toContain("Español");
    expect(html).toContain("Français");
    expect(html).toContain("Deutsch");
    expect(html).toContain("Português");
    expect(html).toContain("Русский");
    expect(html).toContain("हिन्दी");
    expect(html).toContain("Filipino");
    expect(html).toContain("Bahasa Indonesia");
    expect(html).toContain("日本語");
    expect(html).toContain("한국어");
    expect(html).toContain("简体中文");
  });
});
