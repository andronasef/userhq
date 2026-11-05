import {
  Controller,
  Get,
  Post,
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
  WorkspaceRequestsQuerySchema,
  WorkspaceRequestsResponseSchema,
  type WorkspaceRequestsQuery,
  type WorkspaceRequestsResponse,
  WorkspaceCommentsQuerySchema,
  WorkspaceCommentsResponseSchema,
  type WorkspaceCommentsQuery,
  type WorkspaceCommentsResponse,
  ReplyWorkspaceCommentInputSchema,
  WorkspaceCommentItemSchema,
  type ReplyWorkspaceCommentInput,
  type WorkspaceCommentItem,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { CurrentUser } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { WorkspaceFeedbackService } from "./workspace-feedback.service.js";
import { RequireScopes } from "../api-keys/api-key.decorator.js";

const uuidParamSchema = z.string().uuid();

@Controller("workspaces/:ws")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class WorkspaceFeedbackController {
  constructor(
    private readonly workspaceFeedbackService: WorkspaceFeedbackService
  ) {}

  @Get("requests")
  @RequireScopes("requests:read")
  @SerializeOptions({ schema: WorkspaceRequestsResponseSchema })
  async listRequests(
    @CurrentTenant() tenant: Tenant,
    @Query({ schema: WorkspaceRequestsQuerySchema }) query: WorkspaceRequestsQuery
  ): Promise<WorkspaceRequestsResponse> {
    return this.workspaceFeedbackService.listRequests(
      { workspaceId: tenant.workspaceId },
      query
    );
  }

  @Get("comments")
  @RequireScopes("comments:read")
  @SerializeOptions({ schema: WorkspaceCommentsResponseSchema })
  async listComments(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Query({ schema: WorkspaceCommentsQuerySchema }) query: WorkspaceCommentsQuery
  ): Promise<WorkspaceCommentsResponse> {
    return this.workspaceFeedbackService.listComments(
      { workspaceId: tenant.workspaceId },
      user,
      query
    );
  }

  @Post("comments/:id/handled")
  @RequireScopes("comments:write")
  @HttpCode(204)
  async markCommentHandled(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Param("id") id: string
  ): Promise<void> {
    const parsed = uuidParamSchema.safeParse(id);
    if (!parsed.success) {
      throw new ApiException("comment_not_found", 404, "Comment not found.");
    }
    return this.workspaceFeedbackService.markCommentHandled(
      { workspaceId: tenant.workspaceId },
      user,
      parsed.data
    );
  }

  @Delete("comments/:id/handled")
  @RequireScopes("comments:write")
  @HttpCode(204)
  async reopenComment(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string
  ): Promise<void> {
    const parsed = uuidParamSchema.safeParse(id);
    if (!parsed.success) {
      throw new ApiException("comment_not_found", 404, "Comment not found.");
    }
    return this.workspaceFeedbackService.reopenComment(
      { workspaceId: tenant.workspaceId },
      parsed.data
    );
  }

  @Post("comments/:id/reply")
  @RequireScopes("comments:write")
  @HttpCode(201)
  @SerializeOptions({ schema: WorkspaceCommentItemSchema })
  async replyToComment(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Req() req: any,
    @Param("id") id: string,
    @Body({ schema: ReplyWorkspaceCommentInputSchema }) input: ReplyWorkspaceCommentInput
  ): Promise<WorkspaceCommentItem> {
    const parsed = uuidParamSchema.safeParse(id);
    if (!parsed.success) {
      throw new ApiException("comment_not_found", 404, "Comment not found.");
    }
    return this.workspaceFeedbackService.replyToComment(
      { workspaceId: tenant.workspaceId },
      user,
      parsed.data,
      input,
      req.apiKey?.id
    );
  }

  @Post("comments/:id/read")
  @HttpCode(204)
  async markCommentRead(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Param("id") id: string
  ): Promise<void> {
    const parsed = uuidParamSchema.safeParse(id);
    if (!parsed.success) {
      throw new ApiException("comment_not_found", 404, "Comment not found.");
    }
    return this.workspaceFeedbackService.markCommentRead(
      { workspaceId: tenant.workspaceId },
      user,
      parsed.data
    );
  }
}
