import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { z } from "zod";
import {
  ProductUsersQuerySchema,
  AssignUserBadgeInputSchema,
  type ProductUsersQuery,
  type ProductUserListItem,
  type AssignUserBadgeInput,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { CurrentUser } from "../auth/decorators.js";
import { RequireScopes } from "../api-keys/api-key.decorator.js";
import { BadgesService } from "./badges.service.js";

const UuidParamSchema = z.string().uuid();

@Controller("workspaces/:ws/products/:product/users")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class ProductUsersController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get()
  @RequireScopes("settings:read")
  async listUsers(
    @CurrentTenant() tenant: Tenant,
    @Query() rawQuery: unknown
  ): Promise<{
    items: ProductUserListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const query = ProductUsersQuerySchema.parse(rawQuery);
    return this.badgesService.listProductUsers(tenant.productId!, query);
  }

  @Post(":userId/badges")
  @RequireScopes("settings:write")
  async assignBadge(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() currentUser: { id: string },
    @Param("userId") userId: string,
    @Body() body: unknown
  ): Promise<{ success: true }> {
    const input = AssignUserBadgeInputSchema.parse(body);
    await this.badgesService.assignUserBadge(
      tenant.productId!,
      userId,
      input,
      currentUser.id
    );
    return { success: true };
  }

  @Delete(":userId/badges/:badgeId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireScopes("settings:write")
  async revokeBadge(
    @CurrentTenant() tenant: Tenant,
    @Param("userId") userId: string,
    @Param("badgeId") badgeId: string
  ): Promise<void> {
    const validBadgeId = UuidParamSchema.parse(badgeId);
    await this.badgesService.revokeUserBadge(
      tenant.productId!,
      userId,
      validBadgeId
    );
  }
}
