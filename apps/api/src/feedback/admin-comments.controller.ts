import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { z } from "zod";
import {
  PublicCommentSchema,
  UpdateCommentInputSchema,
  type PublicComment,
  type UpdateCommentInput,
  DeletedCommentPageSchema,
  type DeletedCommentPage,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { CurrentUser } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { ModerationService } from "./moderation.service.js";
import { CommentsService } from "./comments.service.js";
import { RequireScopes } from "../api-keys/api-key.decorator.js";

const uuidParamSchema = z.string().uuid();

@Controller("workspaces/:ws/products/:product/comments")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class AdminCommentsController {
  constructor(
    private readonly moderationService: ModerationService,
    private readonly commentsService: CommentsService
  ) {}

  @Patch(":id")
  @RequireScopes("comments:write")
  @SerializeOptions({ schema: PublicCommentSchema })
  async updateComment(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Param("id") id: string,
    @Body({ schema: UpdateCommentInputSchema }) input: UpdateCommentInput
  ): Promise<PublicComment> {
    const parsed = uuidParamSchema.safeParse(id);
    if (!parsed.success) throw new ApiException("comment_not_found", 404, "Comment not found.");
    return this.commentsService.updateComment({ workspaceId: tenant.workspaceId, productId: tenant.productId! }, user, parsed.data, input);
  }

  @Delete(":id")
  @RequireScopes("comments:write")
  @HttpCode(204)
  async deleteComment(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Param("id") id: string
  ): Promise<void> {
    const parsed = uuidParamSchema.safeParse(id);
    if (!parsed.success) throw new ApiException("comment_not_found", 404, "Comment not found.");
    return this.commentsService.deleteComment({ workspaceId: tenant.workspaceId, productId: tenant.productId! }, user, parsed.data);
  }

  @Get("deleted")
  @RequireScopes("comments:read")
  @SerializeOptions({ schema: DeletedCommentPageSchema })
  async listDeletedComments(
    @CurrentTenant() tenant: Tenant,
    @Query("cursor") cursor?: string
  ): Promise<DeletedCommentPage> {
    return this.moderationService.listDeletedComments(
      { workspaceId: tenant.workspaceId, productId: tenant.productId! },
      cursor
    );
  }

  @Post(":id/restore")
  @RequireScopes("comments:write")
  @HttpCode(204)
  async restoreComment(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Param("id") id: string
  ): Promise<void> {
    const parsedId = uuidParamSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiException("comment_not_found", 404, "Comment not found.");
    }

    return this.moderationService.restoreComment(
      { workspaceId: tenant.workspaceId, productId: tenant.productId! },
      parsedId.data,
      user.id
    );
  }
}
