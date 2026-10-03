import {
  Controller,
  Post,
  Patch,
  Delete,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  HttpCode,
  HttpStatus,
  Req,
  Body,
  Param,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { z } from "zod";
import {
  PublicCommentSchema,
  CreateCommentInputSchema,
  UpdateCommentInputSchema,
  type CreateCommentInput,
  type UpdateCommentInput,
  type PublicComment,
} from "@userhq/types";
import { CurrentUser } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { PortalGuard } from "../portal/portal.guard.js";
import { CommentsService } from "./comments.service.js";
import { Throttle } from "@nestjs/throttler";
import { UserThrottlerGuard } from "./throttle.js";

const postNumberParamSchema = z.coerce.number().int().positive();
const uuidParamSchema = z.string().uuid();

@Controller("portal/:ws/:product")
@UseGuards(PortalGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post("posts/:number/comments")
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @SerializeOptions({ schema: PublicCommentSchema })
  async createComment(
    @Req() req: any,
    @CurrentUser() user: any,
    @Param("number") rawNumber: string,
    @Body({ schema: CreateCommentInputSchema }) input: CreateCommentInput
  ): Promise<PublicComment> {
    if (!user) {
      throw new ApiException("unauthorized", 401, "Sign in required.");
    }
    const parseResult = postNumberParamSchema.safeParse(rawNumber);
    if (!parseResult.success) {
      throw new ApiException("post_not_found", 404, "Post not found.");
    }

    const portal = req.portal;
    return this.commentsService.createComment(portal, user, parseResult.data, input);
  }

  @Patch("comments/:id")
  @SerializeOptions({ schema: PublicCommentSchema })
  async updateComment(
    @Req() req: any,
    @CurrentUser() user: any,
    @Param("id") rawId: string,
    @Body({ schema: UpdateCommentInputSchema }) input: UpdateCommentInput
  ): Promise<PublicComment> {
    if (!user) {
      throw new ApiException("unauthorized", 401, "Sign in required.");
    }
    const idParsed = uuidParamSchema.safeParse(rawId);
    if (!idParsed.success) {
      throw new ApiException("comment_not_found", 404, "Comment not found.");
    }

    const portal = req.portal;
    return this.commentsService.updateComment(portal, user, idParsed.data, input);
  }

  @Delete("comments/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @Req() req: any,
    @CurrentUser() user: any,
    @Param("id") rawId: string
  ): Promise<void> {
    if (!user) {
      throw new ApiException("unauthorized", 401, "Sign in required.");
    }
    const idParsed = uuidParamSchema.safeParse(rawId);
    if (!idParsed.success) {
      throw new ApiException("comment_not_found", 404, "Comment not found.");
    }

    const portal = req.portal;
    await this.commentsService.deleteComment(portal, user, idParsed.data);
  }
}
