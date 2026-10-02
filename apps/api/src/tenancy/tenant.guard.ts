import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
} from "@nestjs/common";
import { eq, and, isNull } from "drizzle-orm";
import {
  DB,
  type Db,
  workspaces,
  workspaceMembers,
  products,
} from "@userhq/db";
import { ApiException } from "../common/api-error.filter.js";

export interface Tenant {
  workspaceId: string;
  productId?: string;
  role: "owner" | "admin";
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(@Inject(DB) private readonly db: Db) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user?.id) {
      throw new ApiException("unauthorized", 401, "Sign in required.");
    }

    const ws = req.params?.ws;
    const product = req.params?.product;

    if (!ws) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    const [row] = await this.db
      .select({
        id: workspaces.id,
        suspendedAt: workspaces.suspendedAt,
        role: workspaceMembers.role,
      })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        and(
          eq(workspaceMembers.workspaceId, workspaces.id),
          eq(workspaceMembers.userId, req.user.id)
        )
      )
      .where(eq(workspaces.slug, ws))
      .limit(1);

    if (!row) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    if (row.suspendedAt) {
      throw new ApiException("workspace_suspended", 403, "This workspace is suspended.");
    }

    let productId: string | undefined;
    if (product !== undefined) {
      const [p] = await this.db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.workspaceId, row.id),
            eq(products.slug, product),
            isNull(products.deletedAt)
          )
        )
        .limit(1);

      if (!p) {
        throw new ApiException("not_found", 404, "Not found.");
      }
      productId = p.id;
    }

    req.tenant = {
      workspaceId: row.id,
      productId,
      role: row.role as "owner" | "admin",
    };

    return true;
  }
}
