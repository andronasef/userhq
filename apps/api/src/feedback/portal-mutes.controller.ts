import {
  Controller,
  Put,
  Delete,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  HttpCode,
  HttpStatus,
  Req,
  Param,
  Inject,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { z } from "zod";
import { Throttle } from "@nestjs/throttler";
import { and, eq, isNull } from "drizzle-orm";
import { DB, type Db, posts, postMutes } from "@userhq/db";
import { MuteResultSchema, type MuteResult } from "@userhq/types";
import { CurrentUser } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { PortalGuard } from "../portal/portal.guard.js";
import { UserThrottlerGuard } from "./throttle.js";

const postNumberParamSchema = z.coerce.number().int().positive();

@Controller("portal/:ws/:product/posts/:number/mute")
@UseGuards(PortalGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalMutesController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Put()
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ schema: MuteResultSchema })
  async mute(
    @Req() req: any,
    @Param("number") rawNumber: string,
    @CurrentUser() user: any
  ): Promise<MuteResult> {
    const parseResult = postNumberParamSchema.safeParse(rawNumber);
    if (!parseResult.success) {
      throw new ApiException("post_not_found", 404, "Not found.");
    }

    const [p] = await this.db
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          eq(posts.productId, req.portal.productId),
          eq(posts.number, parseResult.data),
          isNull(posts.deletedAt),
          isNull(posts.mergedIntoId)
        )
      )
      .limit(1);

    if (!p) {
      throw new ApiException("post_not_found", 404, "Not found.");
    }

    await this.db
      .insert(postMutes)
      .values({
        userId: user.id,
        postId: p.id,
      })
      .onConflictDoNothing();

    return { muted: true };
  }

  @Delete()
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ schema: MuteResultSchema })
  async unmute(
    @Req() req: any,
    @Param("number") rawNumber: string,
    @CurrentUser() user: any
  ): Promise<MuteResult> {
    const parseResult = postNumberParamSchema.safeParse(rawNumber);
    if (!parseResult.success) {
      throw new ApiException("post_not_found", 404, "Not found.");
    }

    const [p] = await this.db
      .select({ id: posts.id })
      .from(posts)
      .where(
        and(
          eq(posts.productId, req.portal.productId),
          eq(posts.number, parseResult.data),
          isNull(posts.deletedAt),
          isNull(posts.mergedIntoId)
        )
      )
      .limit(1);

    if (!p) {
      throw new ApiException("post_not_found", 404, "Not found.");
    }

    await this.db
      .delete(postMutes)
      .where(
        and(
          eq(postMutes.userId, user.id),
          eq(postMutes.postId, p.id)
        )
      );

    return { muted: false };
  }
}
