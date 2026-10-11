import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
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
  AdminRoadmapItemSchema,
  AdminRoadmapListResponseSchema,
  CreateRoadmapItemInputSchema,
  UpdateRoadmapItemInputSchema,
  MoveRoadmapItemInputSchema,
  RoadmapPostLinkSearchResponseSchema,
  type AdminRoadmapItem,
  type AdminRoadmapListResponse,
  type CreateRoadmapItemInput,
  type UpdateRoadmapItemInput,
  type MoveRoadmapItemInput,
  type RoadmapPostLinkSearchResponse,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { CurrentUser } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { RoadmapService } from "./roadmap.service.js";

const UuidParamSchema = z.string().uuid();
const LinkPostInputSchema = z.object({
  postId: z.string().uuid(),
});

@Controller("workspaces/:ws/products/:product/roadmap")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class RoadmapController {
  constructor(private readonly roadmapService: RoadmapService) {}

  @Get()
  @SerializeOptions({ schema: AdminRoadmapListResponseSchema })
  async listItems(
    @CurrentTenant() tenant: Tenant
  ): Promise<AdminRoadmapListResponse> {
    const items = await this.roadmapService.listAdminItems({
      workspaceId: tenant.workspaceId,
      productId: tenant.productId!,
    });
    return { items };
  }

  @Get("search-posts")
  @SerializeOptions({ schema: RoadmapPostLinkSearchResponseSchema })
  async searchPosts(
    @CurrentTenant() tenant: Tenant,
    @Query("q") query?: string
  ): Promise<RoadmapPostLinkSearchResponse> {
    const posts = await this.roadmapService.searchPosts(
      {
        workspaceId: tenant.workspaceId,
        productId: tenant.productId!,
      },
      query
    );
    return { posts };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @SerializeOptions({ schema: AdminRoadmapItemSchema })
  async createItem(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: { id: string },
    @Body({ schema: CreateRoadmapItemInputSchema }) input: CreateRoadmapItemInput
  ): Promise<AdminRoadmapItem> {
    return this.roadmapService.createItem(
      {
        workspaceId: tenant.workspaceId,
        productId: tenant.productId!,
      },
      user,
      input
    );
  }

  @Patch(":id/move")
  @SerializeOptions({ schema: AdminRoadmapItemSchema })
  async moveItem(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: { id: string },
    @Param("id") rawId: string,
    @Body({ schema: MoveRoadmapItemInputSchema }) input: MoveRoadmapItemInput
  ): Promise<AdminRoadmapItem> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("item_not_found", 404, "Invalid item ID.");
    }

    return this.roadmapService.moveItem(
      {
        workspaceId: tenant.workspaceId,
        productId: tenant.productId!,
      },
      user,
      parsed.data,
      input
    );
  }

  @Patch(":id")
  @SerializeOptions({ schema: AdminRoadmapItemSchema })
  async updateItem(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: { id: string },
    @Param("id") rawId: string,
    @Body({ schema: UpdateRoadmapItemInputSchema }) input: UpdateRoadmapItemInput
  ): Promise<AdminRoadmapItem> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("item_not_found", 404, "Invalid item ID.");
    }

    return this.roadmapService.updateItem(
      {
        workspaceId: tenant.workspaceId,
        productId: tenant.productId!,
      },
      user,
      parsed.data,
      input
    );
  }

  @Delete(":id")
  async deleteItem(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string
  ): Promise<{ success: boolean }> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("item_not_found", 404, "Invalid item ID.");
    }

    await this.roadmapService.deleteItem(
      {
        workspaceId: tenant.workspaceId,
        productId: tenant.productId!,
      },
      parsed.data
    );

    return { success: true };
  }

  @Post(":id/link")
  async linkPost(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: { id: string },
    @Param("id") rawId: string,
    @Body({ schema: LinkPostInputSchema }) body: { postId: string }
  ): Promise<{ success: boolean; linkedPostCount: number }> {
    const parsed = UuidParamSchema.safeParse(rawId);
    if (!parsed.success) {
      throw new ApiException("item_not_found", 404, "Invalid item ID.");
    }

    return this.roadmapService.linkPost(
      {
        workspaceId: tenant.workspaceId,
        productId: tenant.productId!,
      },
      user,
      parsed.data,
      body.postId
    );
  }

  @Delete(":id/unlink/:postId")
  async unlinkPost(
    @CurrentTenant() tenant: Tenant,
    @Param("id") rawId: string,
    @Param("postId") rawPostId: string
  ): Promise<{ success: boolean }> {
    const parsedId = UuidParamSchema.safeParse(rawId);
    const parsedPostId = UuidParamSchema.safeParse(rawPostId);
    if (!parsedId.success || !parsedPostId.success) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    return this.roadmapService.unlinkPost(
      {
        workspaceId: tenant.workspaceId,
        productId: tenant.productId!,
      },
      parsedId.data,
      parsedPostId.data
    );
  }
}
