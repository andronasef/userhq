import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  HttpCode,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { z } from "zod";
import {
  CreatePostInputSchema,
  type CreatePostInput,
  CreateCommentInputSchema,
  PublicCommentSchema,
  type CreateCommentInput,
  type PublicComment,
  UpdatePostInputSchema,
  PostCreatedSchema,
  type UpdatePostInput,
  type PostCreated,
  StatusChangeInputSchema,
  StatusChangeResultSchema,
  AdminBoardQuerySchema,
  AdminBoardListResponseSchema,
  AdminPostDetailSchema,
  VoterPageSchema,
  MergeInputSchema,
  BulkMergeInputSchema,
  MergeResultSchema,
  type StatusChangeInput,
  type StatusChangeResult,
  type AdminBoardQuery,
  type AdminBoardListResponse,
  type AdminPostDetail,
  type VoterPage,
  type MergeInput,
  type BulkMergeInput,
  type MergeResult,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { CurrentUser } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { ModerationService } from "./moderation.service.js";
import { RequireScopes } from "../api-keys/api-key.decorator.js";

import { PostsService } from "./posts.service.js";
import { CommentsService } from "./comments.service.js";
import { Throttle } from "@nestjs/throttler";
import { UserThrottlerGuard } from "./throttle.js";

const postNumberParamSchema = z.coerce.number().int().positive();

@Controller("workspaces/:ws/products/:product/posts")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class AdminPostsController {
  constructor(
    private readonly moderationService: ModerationService,
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService
  ) {}

  @Post()
  @RequireScopes("requests:write")
  @HttpCode(201)
  @SerializeOptions({ schema: PostCreatedSchema })
  async createPost(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Req() req: any,
    @Body({ schema: CreatePostInputSchema }) input: CreatePostInput
  ): Promise<PostCreated> {
    return this.postsService.createPost(
      { workspaceId: tenant.workspaceId, productId: tenant.productId! },
      user,
      input,
      req.headers?.["user-agent"],
      req.apiKey?.id
    );
  }

  @Post(":number/comments")
  @RequireScopes("comments:write")
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(201)
  @SerializeOptions({ schema: PublicCommentSchema })
  async createComment(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Req() req: any,
    @Param("number") number: string,
    @Body({ schema: CreateCommentInputSchema }) input: CreateCommentInput
  ): Promise<PublicComment> {
    const parsed = postNumberParamSchema.safeParse(number);
    if (!parsed.success) throw new ApiException("post_not_found", 404, "Post not found.");
    return this.commentsService.createComment(
      { workspaceId: tenant.workspaceId, productId: tenant.productId! },
      user,
      parsed.data,
      input,
      req.headers?.["user-agent"],
      req.apiKey?.id
    );
  }

  @Patch(":number")
  @RequireScopes("requests:write")
  @SerializeOptions({ schema: PostCreatedSchema })
  async updatePost(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Param("number") number: string,
    @Body({ schema: UpdatePostInputSchema }) input: UpdatePostInput
  ): Promise<PostCreated> {
    const parsed = postNumberParamSchema.safeParse(number);
    if (!parsed.success) throw new ApiException("post_not_found", 404, "Post not found.");
    return this.postsService.updatePost({ workspaceId: tenant.workspaceId, productId: tenant.productId! }, user, parsed.data, input);
  }

  @Delete(":number")
  @RequireScopes("requests:write")
  @HttpCode(204)
  async deletePost(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Param("number") number: string
  ): Promise<void> {
    const parsed = postNumberParamSchema.safeParse(number);
    if (!parsed.success) throw new ApiException("post_not_found", 404, "Post not found.");
    return this.postsService.deletePost({ workspaceId: tenant.workspaceId, productId: tenant.productId! }, user, parsed.data);
  }

  @Get()
  @RequireScopes("requests:read")
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

  @Post("merge")
  @RequireScopes("requests:write")
  @HttpCode(200)
  @SerializeOptions({ schema: MergeResultSchema })
  async bulkMerge(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Body({ schema: BulkMergeInputSchema }) body: BulkMergeInput
  ): Promise<MergeResult> {
    return this.moderationService.mergePosts(
      { workspaceId: tenant.workspaceId, productId: tenant.productId! },
      body.keepNumber,
      body.mergeNumbers,
      user.id
    );
  }

  @Post(":number/merge")
  @RequireScopes("requests:write")
  @HttpCode(200)
  @SerializeOptions({ schema: MergeResultSchema })
  async mergePost(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Param("number") number: string,
    @Body({ schema: MergeInputSchema }) body: MergeInput
  ): Promise<MergeResult> {
    const parsedNumber = postNumberParamSchema.safeParse(number);
    if (!parsedNumber.success) {
      throw new ApiException("post_not_found", 404, "Post not found.");
    }

    return this.moderationService.mergePosts(
      { workspaceId: tenant.workspaceId, productId: tenant.productId! },
      body.targetNumber,
      [parsedNumber.data],
      user.id
    );
  }

  @Get(":number")
  @RequireScopes("requests:read")
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
  @RequireScopes("requests:read")
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
  @RequireScopes("requests:write")
  @HttpCode(204)
  async restorePost(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
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
      parsedNumber.data,
      user.id
    );
  }

  @Put(":number/status")
  @RequireScopes("requests:write")
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
