import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  HttpCode,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  Inject,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { and, eq, isNull } from "drizzle-orm";
import {
  DB,
  type Db,
  user,
  posts,
  products,
  workspaces,
  postMutes,
} from "@userhq/db";
import {
  UnsubscribeStateSchema,
  type UnsubscribeState,
  postSlug,
} from "@userhq/types";
import { ENV, type Env } from "../env.js";
import { Public, SkipOriginCheck } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { verifyToken } from "./tokens.js";
import { UserThrottlerGuard } from "../feedback/throttle.js";

@Controller("unsubscribe")
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class UnsubscribeController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env
  ) {}

  private async resolveToken(token: string): Promise<{
    userId: string;
    scope: "all" | `p:${string}`;
    userRow: typeof user.$inferSelect;
  }> {
    const verified = verifyToken(this.env.BETTER_AUTH_SECRET, token);
    if (!verified) {
      throw new ApiException("invalid_token", 404, "This link isn't valid.");
    }

    const [userRow] = await this.db
      .select()
      .from(user)
      .where(and(eq(user.id, verified.u), isNull(user.deletedAt)))
      .limit(1);

    if (!userRow) {
      throw new ApiException("invalid_token", 404, "This link isn't valid.");
    }

    return {
      userId: verified.u,
      scope: verified.s as "all" | `p:${string}`,
      userRow,
    };
  }

  private async resolvePost(postId: string): Promise<{
    live: boolean;
    title: string | null;
    url: string | null;
  }> {
    const [row] = await this.db
      .select({
        id: posts.id,
        number: posts.number,
        title: posts.title,
        deletedAt: posts.deletedAt,
        mergedIntoId: posts.mergedIntoId,
        productSlug: products.slug,
        workspaceSlug: workspaces.slug,
      })
      .from(posts)
      .innerJoin(products, eq(posts.productId, products.id))
      .innerJoin(workspaces, eq(products.workspaceId, workspaces.id))
      .where(eq(posts.id, postId))
      .limit(1);

    if (!row || row.deletedAt !== null || row.mergedIntoId !== null) {
      return { live: false, title: null, url: null };
    }

    const url = `/${row.workspaceSlug}/${row.productSlug}/p/${row.number}-${postSlug(row.title)}`;
    return { live: true, title: row.title, url };
  }

  @Get(":token")
  @Public()
  @SerializeOptions({ schema: UnsubscribeStateSchema })
  async getState(@Param("token") token: string): Promise<UnsubscribeState> {
    const { userId, scope, userRow } = await this.resolveToken(token);

    if (scope === "all") {
      return {
        scope: "all",
        state: userRow.commentEmails ? "subscribed" : "unsubscribed",
        postTitle: null,
        postUrl: null,
      };
    }

    const postId = scope.slice(2);
    const postInfo = await this.resolvePost(postId);
    if (!postInfo.live) {
      return {
        scope: "post",
        state: "post_unavailable",
        postTitle: null,
        postUrl: null,
      };
    }

    const [muteRow] = await this.db
      .select()
      .from(postMutes)
      .where(and(eq(postMutes.userId, userId), eq(postMutes.postId, postId)))
      .limit(1);

    return {
      scope: "post",
      state: muteRow ? "unsubscribed" : "subscribed",
      postTitle: postInfo.title,
      postUrl: postInfo.url,
    };
  }

  @Post(":token")
  @Public()
  @SkipOriginCheck()
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(200)
  @SerializeOptions({ schema: UnsubscribeStateSchema })
  async unsubscribe(@Param("token") token: string): Promise<UnsubscribeState> {
    const { userId, scope } = await this.resolveToken(token);

    if (scope === "all") {
      await this.db
        .update(user)
        .set({ commentEmails: false })
        .where(eq(user.id, userId));

      return {
        scope: "all",
        state: "unsubscribed",
        postTitle: null,
        postUrl: null,
      };
    }

    const postId = scope.slice(2);
    const postInfo = await this.resolvePost(postId);
    if (!postInfo.live) {
      return {
        scope: "post",
        state: "post_unavailable",
        postTitle: null,
        postUrl: null,
      };
    }

    await this.db
      .insert(postMutes)
      .values({
        userId,
        postId,
      })
      .onConflictDoNothing();

    return {
      scope: "post",
      state: "unsubscribed",
      postTitle: postInfo.title,
      postUrl: postInfo.url,
    };
  }

  @Delete(":token")
  @Public()
  @SerializeOptions({ schema: UnsubscribeStateSchema })
  async resubscribe(@Param("token") token: string): Promise<UnsubscribeState> {
    const { userId, scope } = await this.resolveToken(token);

    if (scope === "all") {
      await this.db
        .update(user)
        .set({ commentEmails: true })
        .where(eq(user.id, userId));

      return {
        scope: "all",
        state: "subscribed",
        postTitle: null,
        postUrl: null,
      };
    }

    const postId = scope.slice(2);
    const postInfo = await this.resolvePost(postId);
    if (!postInfo.live) {
      return {
        scope: "post",
        state: "post_unavailable",
        postTitle: null,
        postUrl: null,
      };
    }

    await this.db
      .delete(postMutes)
      .where(and(eq(postMutes.userId, userId), eq(postMutes.postId, postId)));

    return {
      scope: "post",
      state: "subscribed",
      postTitle: postInfo.title,
      postUrl: postInfo.url,
    };
  }
}
