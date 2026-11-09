import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { z } from "zod";
import {
  BadgeListResponseSchema,
  BadgeSchema,
  BadgeRuleSchema,
  CreateBadgeInputSchema,
  UpdateBadgeInputSchema,
  CreateBadgeRuleInputSchema,
  type Badge,
  type BadgeRule,
  type CreateBadgeInput,
  type UpdateBadgeInput,
  type CreateBadgeRuleInput,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { RequireScopes } from "../api-keys/api-key.decorator.js";
import { ApiException } from "../common/api-error.filter.js";
import { BadgesService } from "./badges.service.js";

const UuidParamSchema = z.string().uuid();
function uuid(value: string): string {
  const result = UuidParamSchema.safeParse(value);
  if (!result.success) throw new ApiException("not_found", 404, "Not found.");
  return result.data;
}

@Controller("workspaces/:ws/products/:product/badges")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get()
  @RequireScopes("settings:read")
  @SerializeOptions({ schema: BadgeListResponseSchema })
  async listBadges(
    @CurrentTenant() tenant: Tenant,
  ): Promise<{ items: Badge[] }> {
    const items = await this.badgesService.listBadges(tenant.productId!);
    return { items };
  }

  @Post()
  @RequireScopes("settings:write")
  @SerializeOptions({ schema: BadgeSchema })
  async createBadge(
    @CurrentTenant() tenant: Tenant,
    @Body({ schema: CreateBadgeInputSchema }) input: CreateBadgeInput,
  ): Promise<Badge> {
    return this.badgesService.createBadge(tenant.productId!, input);
  }

  @Patch(":badgeId")
  @RequireScopes("settings:write")
  @SerializeOptions({ schema: BadgeSchema })
  async updateBadge(
    @CurrentTenant() tenant: Tenant,
    @Param("badgeId") badgeId: string,
    @Body({ schema: UpdateBadgeInputSchema }) input: UpdateBadgeInput,
  ): Promise<Badge> {
    const validBadgeId = uuid(badgeId);
    return this.badgesService.updateBadge(
      tenant.productId!,
      validBadgeId,
      input,
    );
  }

  @Delete(":badgeId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireScopes("settings:write")
  async deleteBadge(
    @CurrentTenant() tenant: Tenant,
    @Param("badgeId") badgeId: string,
  ): Promise<void> {
    const validBadgeId = uuid(badgeId);
    await this.badgesService.deleteBadge(tenant.productId!, validBadgeId);
  }

  @Post(":badgeId/rules")
  @RequireScopes("settings:write")
  @SerializeOptions({ schema: BadgeRuleSchema })
  async addRule(
    @CurrentTenant() tenant: Tenant,
    @Param("badgeId") badgeId: string,
    @Body({ schema: CreateBadgeRuleInputSchema }) input: CreateBadgeRuleInput,
  ): Promise<BadgeRule> {
    const validBadgeId = uuid(badgeId);
    return this.badgesService.addRule(tenant.productId!, validBadgeId, input);
  }

  @Delete(":badgeId/rules/:ruleId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireScopes("settings:write")
  async deleteRule(
    @CurrentTenant() tenant: Tenant,
    @Param("badgeId") badgeId: string,
    @Param("ruleId") ruleId: string,
  ): Promise<void> {
    const validBadgeId = uuid(badgeId);
    const validRuleId = uuid(ruleId);
    await this.badgesService.deleteRule(
      tenant.productId!,
      validBadgeId,
      validRuleId,
    );
  }
}
