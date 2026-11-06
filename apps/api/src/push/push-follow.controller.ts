import { Controller, Post, Delete, HttpCode, UseGuards, UseInterceptors } from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators.js";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { PushService } from "./push.service.js";

/**
 * Follow a product for new-post and new-comment alerts (D-11). TenantGuard admits only members of
 * the workspace (owners and admins) and resolves the product from the URL slug pair, so a raw
 * product id is never accepted. No RequireScopes: API keys are denied by default.
 */
@Controller("workspaces/:ws/products/:product/push-follow")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PushFollowController {
  constructor(private readonly pushService: PushService) {}

  @Post()
  @HttpCode(200)
  follow(@CurrentUser() user: { id: string }, @CurrentTenant() tenant: Tenant): Promise<{ success: boolean }> {
    return this.pushService.followProduct(user.id, tenant.productId!);
  }

  @Delete()
  @HttpCode(200)
  unfollow(@CurrentUser() user: { id: string }, @CurrentTenant() tenant: Tenant): Promise<{ success: boolean }> {
    return this.pushService.unfollowProduct(user.id, tenant.productId!);
  }
}
