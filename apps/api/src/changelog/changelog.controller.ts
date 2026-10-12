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
  AdminChangelogEntrySchema,
  AdminChangelogListResponseSchema,
  ChangelogTagSchema,
  CreateChangelogEntryInputSchema,
  UpdateChangelogEntryInputSchema,
  PublishChangelogEntryInputSchema,
  ChangelogTagInputSchema,
  type AdminChangelogEntry,
  type AdminChangelogListResponse,
  type ChangelogTag,
  type CreateChangelogEntryInput,
  type UpdateChangelogEntryInput,
  type PublishChangelogEntryInput,
  type ChangelogTagInput,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { ApiException } from "../common/api-error.filter.js";
import { ChangelogService } from "./changelog.service.js";

const UuidParamSchema = z.string().uuid();

@Controller("workspaces/:ws/products/:product/changelog")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class ChangelogController {
  constructor(private readonly changelogService: ChangelogService) {}

  @Get()
  @SerializeOptions({ schema: AdminChangelogListResponseSchema })
  async listEntries(@CurrentTenant() tenant: Tenant): Promise<AdminChangelogListResponse> {
    return this.changelogService.listAdminEntries(tenant.productId!);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @SerializeOptions({ schema: AdminChangelogEntrySchema })
  async createEntry(
    @CurrentTenant() tenant: Tenant,
    @Body({ schema: CreateChangelogEntryInputSchema }) input: CreateChangelogEntryInput
  ): Promise<AdminChangelogEntry> {
    return this.changelogService.createEntry(tenant.productId!, input);
  }

  @Get("tags")
  @SerializeOptions({ schema: ChangelogTagSchema })
  async listTags(@CurrentTenant() tenant: Tenant): Promise<ChangelogTag[]> {
    return this.changelogService.listTags(tenant.productId!);
  }

  @Post("tags")
  @HttpCode(HttpStatus.CREATED)
  @SerializeOptions({ schema: ChangelogTagSchema })
  async createTag(
    @CurrentTenant() tenant: Tenant,
    @Body({ schema: ChangelogTagInputSchema }) input: ChangelogTagInput
  ): Promise<ChangelogTag> {
    return this.changelogService.createTag(tenant.productId!, input);
  }

  @Delete("tags/:tagId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTag(
    @CurrentTenant() tenant: Tenant,
    @Param("tagId") rawId: string
  ): Promise<void> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Tag not found.");
    }
    await this.changelogService.deleteTag(tenant.productId!, parsed.data);
  }

  @Get(":id")
  @SerializeOptions({ schema: AdminChangelogEntrySchema })
  async getEntry(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string
  ): Promise<AdminChangelogEntry> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Changelog entry not found.");
    }
    return this.changelogService.getEntryById(tenant.productId!, parsed.data);
  }

  @Patch(":id")
  @SerializeOptions({ schema: AdminChangelogEntrySchema })
  async updateEntry(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string,
    @Body({ schema: UpdateChangelogEntryInputSchema }) input: UpdateChangelogEntryInput
  ): Promise<AdminChangelogEntry> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Changelog entry not found.");
    }
    return this.changelogService.updateEntry(tenant.productId!, parsed.data, input);
  }

  @Post(":id/publish")
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ schema: AdminChangelogEntrySchema })
  async publishEntry(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string,
    @Body({ schema: PublishChangelogEntryInputSchema }) input: PublishChangelogEntryInput
  ): Promise<AdminChangelogEntry> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Changelog entry not found.");
    }
    return this.changelogService.publishEntry(tenant.productId!, parsed.data, input.publishedAt);
  }

  @Post(":id/unpublish")
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ schema: AdminChangelogEntrySchema })
  async unpublishEntry(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string
  ): Promise<AdminChangelogEntry> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Changelog entry not found.");
    }
    return this.changelogService.unpublishEntry(tenant.productId!, parsed.data);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEntry(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string
  ): Promise<void> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Changelog entry not found.");
    }
    await this.changelogService.deleteEntry(tenant.productId!, parsed.data);
  }
}
