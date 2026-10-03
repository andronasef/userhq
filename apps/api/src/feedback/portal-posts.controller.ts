import {
  Controller,
  Get,
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
  Query,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { z } from "zod";
import {
  PublicBoardPageSchema,
  PublicPostPageSchema,
  PostCreatedSchema,
  CreatePostInputSchema,
  UpdatePostInputSchema,
  BoardQuerySchema,
  type BoardQuery,
  type CreatePostInput,
  type UpdatePostInput,
  type PublicBoardPage,
  type PublicPostPage,
  type PostCreated,
} from "@userhq/types";
import { Public, CurrentUser } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { PortalGuard } from "../portal/portal.guard.js";
import { PostsService } from "./posts.service.js";

import { Throttle } from "@nestjs/throttler";
import { UserThrottlerGuard } from "./throttle.js";

const postNumberParamSchema = z.coerce.number().int().positive();

@Controller("portal/:ws/:product")
@UseGuards(PortalGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalPostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get("posts")
  @Public()
  @SerializeOptions({ schema: PublicBoardPageSchema })
  async listBoard(
    @Req() req: any,
    @Query({ schema: BoardQuerySchema }) query: BoardQuery
  ): Promise<PublicBoardPage> {
    const portal = req.portal;
    const viewerId = req.user?.id ?? null;
    return this.postsService.listBoard(portal, viewerId, query);
  }

  @Get("posts/:number")
  @Public()
  @SerializeOptions({ schema: PublicPostPageSchema })
  async getPostPage(
    @Req() req: any,
    @Param("number") rawNumber: string
  ): Promise<PublicPostPage> {
    const parseResult = postNumberParamSchema.safeParse(rawNumber);
    if (!parseResult.success) {
      throw new ApiException("post_not_found", 404, "Post not found.");
    }

    const portal = req.portal;
    const viewerId = req.user?.id ?? null;
    return this.postsService.getPostPage(portal, viewerId, parseResult.data);
  }

  @Post("posts")
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @SerializeOptions({ schema: PostCreatedSchema })
  async createPost(
    @Req() req: any,
    @CurrentUser() user: any,
    @Body({ schema: CreatePostInputSchema }) input: CreatePostInput
  ): Promise<PostCreated> {
    if (!user) {
      throw new ApiException("unauthorized", 401, "Sign in required.");
    }
    const portal = req.portal;
    return this.postsService.createPost(portal, user, input);
  }

  @Patch("posts/:number")
  @SerializeOptions({ schema: PostCreatedSchema })
  async updatePost(
    @Req() req: any,
    @CurrentUser() user: any,
    @Param("number") rawNumber: string,
    @Body({ schema: UpdatePostInputSchema }) input: UpdatePostInput
  ): Promise<PostCreated> {
    if (!user) {
      throw new ApiException("unauthorized", 401, "Sign in required.");
    }
    const parseResult = postNumberParamSchema.safeParse(rawNumber);
    if (!parseResult.success) {
      throw new ApiException("post_not_found", 404, "Post not found.");
    }
    const portal = req.portal;
    return this.postsService.updatePost(portal, user, parseResult.data, input);
  }

  @Delete("posts/:number")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePost(
    @Req() req: any,
    @CurrentUser() user: any,
    @Param("number") rawNumber: string
  ): Promise<void> {
    if (!user) {
      throw new ApiException("unauthorized", 401, "Sign in required.");
    }
    const parseResult = postNumberParamSchema.safeParse(rawNumber);
    if (!parseResult.success) {
      throw new ApiException("post_not_found", 404, "Post not found.");
    }
    const portal = req.portal;
    return this.postsService.deletePost(portal, user, parseResult.data);
  }
}
