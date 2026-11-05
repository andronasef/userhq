import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { eq, and, isNull } from "drizzle-orm";
import { DB, type Db, workspaces, products } from "@userhq/db";
import type { ProductFeatures } from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";
import {
  PORTAL_FEATURE,
  featureEnabled,
  isPortalFeatureSetting,
  type PortalFeatureSetting,
  productFeatureColumns,
} from "./product-features.js";

@Injectable()
export class PortalGuard implements CanActivate {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly reflector: Reflector
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const wsSlug = req.params?.ws;
    const productSlug = req.params?.product;

    if (!wsSlug) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    // Product routes must classify themselves (fail closed): a handler added without a
    // capability decision is a server configuration error, never silently public.
    const setting = this.reflector.getAllAndOverride<unknown>(PORTAL_FEATURE, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (productSlug && !isPortalFeatureSetting(setting)) {
      throw new Error(
        `Portal route ${ctx.getClass().name}.${ctx.getHandler().name} is missing @PortalFeature(...) classification.`
      );
    }

    const [ws] = await this.db
      .select({
        id: workspaces.id,
        suspendedAt: workspaces.suspendedAt,
      })
      .from(workspaces)
      .where(and(eq(workspaces.slug, wsSlug), isNull(workspaces.deletedAt)))
      .limit(1);

    if (!ws) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    if (ws.suspendedAt) {
      throw new ApiException("workspace_suspended", 403, "This portal is unavailable.");
    }

    let productId: string | undefined;
    let features: ProductFeatures | undefined;

    if (productSlug) {
      const [prod] = await this.db
        .select({ id: products.id, ...productFeatureColumns })
        .from(products)
        .where(
          and(
            eq(products.workspaceId, ws.id),
            eq(products.slug, productSlug),
            isNull(products.deletedAt)
          )
        )
        .limit(1);

      if (!prod) {
        throw new ApiException("not_found", 404, "Not found.");
      }

      features = {
        board: prod.board,
        roadmap: prod.roadmap,
        changelog: prod.changelog,
        faq: prod.faq,
      };
      if (!featureEnabled(features, setting as PortalFeatureSetting)) {
        throw new ApiException("not_found", 404, "Not found.");
      }

      productId = prod.id;
    }

    req.portal = {
      workspaceId: ws.id,
      productId,
      features,
    };

    return true;
  }
}
