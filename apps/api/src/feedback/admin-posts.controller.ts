import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  HttpCode,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { z } from "zod";
import {
  StatusChangeInputSchema,
  StatusChangeResultSchema,
  AdminBoardQuerySchema,
  AdminBoardListResponseSchema,
  AdminPostDetailSchema,
  VoterPageSchema,
  type StatusChangeInput,
  type StatusChangeResult,
  type AdminBoardQuery,
  type AdminBoardListResponse,
  type AdminPostDetail,
  type VoterPage,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { CurrentUser } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { ModerationService } from "./moderation.service.js";

const postNumberParamSchema = z.coerce.number().int().positive();

@Controller("workspaces/:ws/products/:product/posts")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class AdminPostsController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get()
  @SerializeOptions({ schema: AdminBoardListResponseSchema })
  async listPosts(
    @CurrentTenant() tenant: Tenant,
    @Query({ schema: AdminBoardQuerySchema }) query: AdminBoardQuery
  ): Promise<AdminBoardListResponse> {
    if (query?.view === "deleted") {
      return this.moderationService.listDeletedPosts(
        { workspaceId: tenant.workspaceId, productId: tenant.productId! },
        query.cursor
      );
    }
    return this.moderationService.listAdminPosts(
      { workspaceId: tenant.workspaceId, productId: tenant.productId! },
      query
    );
  }

  @Get(":number")
  @SerializeOptions({ schema: AdminPostDetailSchema })
  async getPost(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Param("number") number: string
  ): Promise<AdminPostDetail> {
    const parsedNumber = postNumberParamSchema.safeParse(number);
    if (!parsedNumber.success) {
      throw new ApiException(
        "post_not_found",
        404,
        "Post not found."
      );
    }

    return this.moderationService.getAdminPost(
      { workspaceId: tenant.workspaceId, productId: tenant.productId! },
      user,
      parsedNumber.data
    );
  }

  @Get(":number/voters")
  @SerializeOptions({ schema: VoterPageSchema })
  async listVoters(
    @CurrentTenant() tenant: Tenant,
    @Param("number") number: string,
    @Query("cursor") cursor?: string
  ): Promise<VoterPage> {
    const parsedNumber = postNumberParamSchema.safeParse(number);
    if (!parsedNumber.success) {
      throw new ApiException(
        "post_not_found",
        404,
        "Post not found."
      );
    }

    return this.moderationService.listVoters(
      { workspaceId: tenant.workspaceId, productId: tenant.productId! },
      parsedNumber.data,
      cursor
    );
  }

  @Post(":number/restore")
  @HttpCode(204)
  async restorePost(
    @CurrentTenant() tenant: Tenant,
    @Param("number") number: string
  ): Promise<void> {
    const parsedNumber = postNumberParamSchema.safeParse(number);
    if (!parsedNumber.success) {
      throw new ApiException(
        "post_not_found",
        404,
        "Post not found."
      );
    }

    return this.moderationService.restorePost(
      { workspaceId: tenant.workspaceId, productId: tenant.productId! },
      parsedNumber.data
    );
  }

  @Put(":number/status")
  @SerializeOptions({ schema: StatusChangeResultSchema })
  async changeStatus(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Param("number") number: string,
    @Body({ schema: StatusChangeInputSchema }) input: StatusChangeInput
  ): Promise<StatusChangeResult> {
    const parsedNumber = postNumberParamSchema.safeParse(number);
    if (!parsedNumber.success) {
      throw new ApiException(
        "post_not_found",
        404,
        "This post was removed or merged. Go back to the board."
      );
    }

    return this.moderationService.changeStatus(
      { workspaceId: tenant.workspaceId, productId: tenant.productId! },
      user,
      parsedNumber.data,
      input
    );
  }
}
