import {
  Controller,
  Get,
  Post,
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
  DeletedCommentPageSchema,
  type DeletedCommentPage,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { ApiException } from "../common/api-error.filter.js";
import { ModerationService } from "./moderation.service.js";

const uuidParamSchema = z.string().uuid();

@Controller("workspaces/:ws/products/:product/comments")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class AdminCommentsController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get("deleted")
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
  @HttpCode(204)
  async restoreComment(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string
  ): Promise<void> {
    const parsedId = uuidParamSchema.safeParse(id);
    if (!parsedId.success) {
      throw new ApiException("comment_not_found", 404, "Comment not found.");
    }

    return this.moderationService.restoreComment(
      { workspaceId: tenant.workspaceId, productId: tenant.productId! },
      parsedId.data
    );
  }
}
