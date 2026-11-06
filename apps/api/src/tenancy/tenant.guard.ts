import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { eq, and, isNull } from "drizzle-orm";
import {
  DB,
  type Db,
  workspaces,
  workspaceMembers,
  products,
} from "@userhq/db";
import type { ApiKeyScope } from "@userhq/types";
import { ApiException } from "../common/api-error.filter.js";
import { REQUIRE_SCOPES } from "../api-keys/api-key.decorator.js";

export interface Tenant {
  workspaceId: string;
  productId?: string;
  role: "owner" | "admin";
}

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly reflector: Reflector
  ) {}

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

    let workspaceId: string;
    let role: "owner" | "admin";

    if (req.apiKey) {
      // API Key authentication path
      const [wsRow] = await this.db
        .select({
          id: workspaces.id,
          suspendedAt: workspaces.suspendedAt,
        })
        .from(workspaces)
        .where(and(eq(workspaces.slug, ws), isNull(workspaces.deletedAt)))
        .limit(1);

      if (!wsRow || wsRow.id !== req.apiKey.workspaceId) {
        throw new ApiException("not_found", 404, "Not found.");
      }

      if (wsRow.suspendedAt) {
        throw new ApiException("workspace_suspended", 403, "This workspace is suspended.");
      }

      workspaceId = wsRow.id;
      role = "admin";
    } else {
      // User session authentication path
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
        .where(and(eq(workspaces.slug, ws), isNull(workspaces.deletedAt)))
        .limit(1);

      if (!row) {
        throw new ApiException("not_found", 404, "Not found.");
      }

      if (row.suspendedAt) {
        throw new ApiException("workspace_suspended", 403, "This workspace is suspended.");
      }

      workspaceId = row.id;
      role = row.role as "owner" | "admin";
    }

    let productId: string | undefined;
    if (product !== undefined) {
      const [p] = await this.db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.workspaceId, workspaceId),
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

    // Workspace-wide handlers cannot prove product isolation. Restricted keys
    // must address an allowed product explicitly, even when they have admin scope.
    if (req.apiKey?.productRestrictions && req.apiKey.productRestrictions.length > 0) {
      if (!productId || !req.apiKey.productRestrictions.includes(productId)) {
        throw new ApiException(
          "product_restricted",
          403,
          "API key is not authorized for this product."
        );
      }
    }

    // Check required scopes for API keys
    const requiredScopes = this.reflector.getAllAndOverride<ApiKeyScope[] | undefined>(
      REQUIRE_SCOPES,
      [ctx.getHandler(), ctx.getClass()]
    );

    if (req.apiKey && requiredScopes && requiredScopes.length > 0) {
      const hasAdminScope = req.apiKey.scopes.includes("admin");
      const hasRequiredScope = requiredScopes.some((s) => req.apiKey.scopes.includes(s));
      if (!hasAdminScope && !hasRequiredScope) {
        throw new ApiException(
          "insufficient_scope",
          403,
          `API key lacks required scope: ${requiredScopes.join(", ")}`
        );
      }
    }

    req.tenant = {
      workspaceId,
      productId,
      role,
    };

    return true;
  }
}
