import {
  Controller,
  Post,
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
  type CreateCommentInput,
  type PublicComment,
} from "@userhq/types";
import { CurrentUser } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { PortalGuard } from "../portal/portal.guard.js";
import { CommentsService } from "./comments.service.js";

const postNumberParamSchema = z.coerce.number().int().positive();

@Controller("portal/:ws/:product")
@UseGuards(PortalGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post("posts/:number/comments")
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
}
