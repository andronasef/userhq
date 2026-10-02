import {
  Controller,
  Get,
  Inject,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  Req,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { alias } from "drizzle-orm/pg-core";
import { eq } from "drizzle-orm";
import { DB, type Db, workspaces, products, uploads } from "@userhq/db";
import {
  PublicPortalProductSchema,
  type PublicPortalProduct,
} from "@userhq/types";
import { Public } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { PortalGuard } from "./portal.guard.js";

const productLogo = alias(uploads, "product_logo");
const workspaceLogo = alias(uploads, "workspace_logo");

@Controller("portal")
@Public()
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get(":ws/:product")
  @UseGuards(PortalGuard)
  @SerializeOptions({ schema: PublicPortalProductSchema })
  async getPortalProduct(@Req() req: any): Promise<PublicPortalProduct> {
    const { productId } = req.portal ?? {};
    if (!productId) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    const [row] = await this.db
      .select({
        workspaceSlug: workspaces.slug,
        workspaceName: workspaces.name,
        workspaceWebsiteUrl: workspaces.websiteUrl,
        workspaceLogoKey: workspaceLogo.storageKey,
        productSlug: products.slug,
        productName: products.name,
        productTagline: products.tagline,
        productAccentColor: products.accentColor,
        productWebsiteUrl: products.websiteUrl,
        productLogoKey: productLogo.storageKey,
      })
      .from(products)
      .innerJoin(workspaces, eq(products.workspaceId, workspaces.id))
      .leftJoin(productLogo, eq(products.logoUploadId, productLogo.id))
      .leftJoin(workspaceLogo, eq(workspaces.logoUploadId, workspaceLogo.id))
      .where(eq(products.id, productId))
      .limit(1);

    if (!row) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    const logoKey = row.productLogoKey ?? row.workspaceLogoKey ?? null;
    const logoUrl = logoKey ? `/uploads/${logoKey}` : null;
    const websiteUrl = row.productWebsiteUrl ?? row.workspaceWebsiteUrl ?? null;

    return PublicPortalProductSchema.parse({
      workspace: {
        slug: row.workspaceSlug,
        name: row.workspaceName,
      },
      product: {
        slug: row.productSlug,
        name: row.productName,
        tagline: row.productTagline ?? null,
        accentColor: row.productAccentColor,
        logoUrl,
        websiteUrl,
      },
    });
  }
}
