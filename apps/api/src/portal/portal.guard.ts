import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
} from "@nestjs/common";
import { eq, and, isNull } from "drizzle-orm";
import { DB, type Db, workspaces, products } from "@userhq/db";
import { ApiException } from "../common/api-error.filter.js";

@Injectable()
export class PortalGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Db) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const wsSlug = req.params?.ws;
    const productSlug = req.params?.product;

    if (!wsSlug) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    const [ws] = await this.db
      .select({
        id: workspaces.id,
        suspendedAt: workspaces.suspendedAt,
      })
      .from(workspaces)
      .where(eq(workspaces.slug, wsSlug))
      .limit(1);

    if (!ws) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    if (ws.suspendedAt) {
      throw new ApiException("workspace_suspended", 403, "This portal is unavailable.");
    }

    let productId: string | undefined;

    if (productSlug) {
      const [prod] = await this.db
        .select({ id: products.id })
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

      productId = prod.id;
    }

    req.portal = {
      workspaceId: ws.id,
      productId,
    };

    return true;
  }
}
