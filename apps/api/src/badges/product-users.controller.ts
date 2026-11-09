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
  SerializeOptions,
  Req,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { z } from "zod";
import {
  ProductUsersResponseSchema,
  AssignUserBadgeResponseSchema,
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
import { ApiException } from "../common/api-error.filter.js";
import { BadgesService } from "./badges.service.js";

const UuidParamSchema = z.string().uuid();
function uuid(value: string): string {
  const result = UuidParamSchema.safeParse(value);
  if (!result.success) throw new ApiException("not_found", 404, "Not found.");
  return result.data;
}

@Controller("workspaces/:ws/products/:product/users")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class ProductUsersController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get()
  @RequireScopes("settings:read")
  @SerializeOptions({ schema: ProductUsersResponseSchema })
  async listUsers(
    @CurrentTenant() tenant: Tenant,
    @Req() req: any,
    @Query({ schema: ProductUsersQuerySchema }) query: ProductUsersQuery,
  ): Promise<{
    items: ProductUserListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.badgesService.listProductUsers(
      tenant.productId!,
      query,
      !req.apiKey,
    );
  }

  @Post(":userId/badges")
  @RequireScopes("settings:write")
  @SerializeOptions({ schema: AssignUserBadgeResponseSchema })
  async assignBadge(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() currentUser: { id: string },
    @Param("userId") userId: string,
    @Body({ schema: AssignUserBadgeInputSchema }) input: AssignUserBadgeInput,
  ): Promise<{ success: true }> {
    await this.badgesService.assignUserBadge(
      tenant.productId!,
      userId,
      input,
      currentUser.id,
    );
    return { success: true };
  }

  @Delete(":userId/badges/:badgeId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireScopes("settings:write")
  async revokeBadge(
    @CurrentTenant() tenant: Tenant,
    @Param("userId") userId: string,
    @Param("badgeId") badgeId: string,
  ): Promise<void> {
    const validBadgeId = uuid(badgeId);
    await this.badgesService.revokeUserBadge(
      tenant.productId!,
      userId,
      validBadgeId,
    );
  }
}
