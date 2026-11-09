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
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { z } from "zod";
import {
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
import { BadgesService } from "./badges.service.js";

const UuidParamSchema = z.string().uuid();

@Controller("workspaces/:ws/products/:product/badges")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Get()
  @RequireScopes("settings:read")
  async listBadges(@CurrentTenant() tenant: Tenant): Promise<{ items: Badge[] }> {
    const items = await this.badgesService.listBadges(tenant.productId!);
    return { items };
  }

  @Post()
  @RequireScopes("settings:write")
  async createBadge(
    @CurrentTenant() tenant: Tenant,
    @Body() body: unknown
  ): Promise<Badge> {
    const input = CreateBadgeInputSchema.parse(body);
    return this.badgesService.createBadge(tenant.productId!, input);
  }

  @Patch(":badgeId")
  @RequireScopes("settings:write")
  async updateBadge(
    @CurrentTenant() tenant: Tenant,
    @Param("badgeId") badgeId: string,
    @Body() body: unknown
  ): Promise<Badge> {
    const validBadgeId = UuidParamSchema.parse(badgeId);
    const input = UpdateBadgeInputSchema.parse(body);
    return this.badgesService.updateBadge(tenant.productId!, validBadgeId, input);
  }

  @Delete(":badgeId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireScopes("settings:write")
  async deleteBadge(
    @CurrentTenant() tenant: Tenant,
    @Param("badgeId") badgeId: string
  ): Promise<void> {
    const validBadgeId = UuidParamSchema.parse(badgeId);
    await this.badgesService.deleteBadge(tenant.productId!, validBadgeId);
  }

  @Post(":badgeId/rules")
  @RequireScopes("settings:write")
  async addRule(
    @CurrentTenant() tenant: Tenant,
    @Param("badgeId") badgeId: string,
    @Body() body: unknown
  ): Promise<BadgeRule> {
    const validBadgeId = UuidParamSchema.parse(badgeId);
    const input = CreateBadgeRuleInputSchema.parse(body);
    return this.badgesService.addRule(tenant.productId!, validBadgeId, input);
  }

  @Delete(":badgeId/rules/:ruleId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireScopes("settings:write")
  async deleteRule(
    @CurrentTenant() tenant: Tenant,
    @Param("badgeId") badgeId: string,
    @Param("ruleId") ruleId: string
  ): Promise<void> {
    const validBadgeId = UuidParamSchema.parse(badgeId);
    const validRuleId = UuidParamSchema.parse(ruleId);
    await this.badgesService.deleteRule(
      tenant.productId!,
      validBadgeId,
      validRuleId
    );
  }
}
