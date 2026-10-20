import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductBrandingForm } from "../app/dashboard/[ws]/[product]/settings/product-branding-form";
import { ColorField } from "../components/color-field";
import type { ProductDetail } from "@userhq/types";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

const mockProduct: ProductDetail = {
  slug: "core",
  name: "Core App",
  accentColor: "#2563EB",
  accentTextColor: null,
  logoUrl: null,
  logoUploadId: null,
  tagline: "The best product",
  websiteUrl: "https://example.com",
};

describe("ProductBrandingForm & ColorField (Button text color)", () => {
  it("renders both accent color and button text color fields with live preview", () => {
    const html = renderToStaticMarkup(
      <ProductBrandingForm ws="acme" product={mockProduct} />
    );

    expect(html).toContain("Accent color");
    expect(html).toContain("Button text color");
    expect(html).toContain("Live Preview");
    expect(html).toContain("Primary Button");
    expect(html).toContain("Auto");
  });

  it("renders custom accentTextColor when set on the product", () => {
    const customProduct: ProductDetail = {
      ...mockProduct,
      accentColor: "#FACC15",
      accentTextColor: "#000000",
    };

    const html = renderToStaticMarkup(
      <ProductBrandingForm ws="acme" product={customProduct} />
    );

    expect(html).toContain("--primary-foreground:#000000");
    expect(html).toContain("--primary:#FACC15");
  });

  it("ColorField renders presets and Auto swatch when allowAuto is true", () => {
    const html = renderToStaticMarkup(
      <ColorField
        label="Button text color"
        value=""
        onChange={() => {}}
        allowAuto={true}
        autoValue="#FFFFFF"
        presets={[
          { name: "White", hex: "#FFFFFF" },
          { name: "Black", hex: "#000000" },
        ]}
      />
    );

    expect(html).toContain("Auto");
    expect(html).toContain("#FFFFFF");
    expect(html).toContain("#000000");
  });
});
