import {
  Controller,
  Get,
  Patch,
  Post,
  HttpCode,
  Body,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  Inject,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import {
  DB,
  type Db,
  user as userTable,
  workspaces,
  workspaceMembers,
  products,
  posts,
  uploads,
} from "@userhq/db";
import {
  AccountSchema,
  type Account,
  UpdatePreferencesInputSchema,
  type UpdatePreferencesInput,
  DeleteAccountInputSchema,
  type DeleteAccountInput,
} from "@userhq/types";
import { ENV, type Env } from "../env.js";
import { CurrentUser } from "../auth/decorators.js";
import { isPlatformOwner } from "../auth/platform-owner.js";
import { ApiException } from "../common/api-error.filter.js";
import { UserThrottlerGuard } from "../feedback/throttle.js";
import { AccountService } from "./account.service.js";

@Controller("account")
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class AccountController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env,
    private readonly accountService: AccountService
  ) {}

  private async ownedWorkspaces(userId: string): Promise<Account["ownedWorkspaces"]> {
    const owned = await this.db
      .select({
        id: workspaces.id,
        slug: workspaces.slug,
        name: workspaces.name,
        logoKey: uploads.storageKey,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .leftJoin(uploads, eq(workspaces.logoUploadId, uploads.id))
      .where(
        and(
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.role, "owner"),
          isNull(workspaces.deletedAt)
        )
      )
      .orderBy(workspaces.name, workspaces.slug);

    return Promise.all(
      owned.map(async (w) => {
        const [prod] = await this.db
          .select({ n: sql<number>`count(*)::int` })
          .from(products)
          .where(and(eq(products.workspaceId, w.id), isNull(products.deletedAt)));
        const [post] = await this.db
          .select({ n: sql<number>`count(*)::int` })
          .from(posts)
          .innerJoin(products, eq(posts.productId, products.id))
          .where(
            and(
              eq(products.workspaceId, w.id),
              isNull(products.deletedAt),
              isNull(posts.deletedAt),
              isNull(posts.mergedIntoId)
            )
          );
        const members = await this.db
          .select({ userId: userTable.id, name: userTable.name })
          .from(workspaceMembers)
          .innerJoin(userTable, eq(userTable.id, workspaceMembers.userId))
          .where(
            and(
              eq(workspaceMembers.workspaceId, w.id),
              ne(workspaceMembers.userId, userId)
            )
          )
          .orderBy(userTable.name);
        return {
          slug: w.slug,
          name: w.name,
          logoUrl: w.logoKey ? `/uploads/${w.logoKey}` : null,
          productCount: prod?.n ?? 0,
          postCount: post?.n ?? 0,
          members,
        };
      })
    );
  }

  @Get()
  @SerializeOptions({ schema: AccountSchema })
  async getAccount(@CurrentUser() user: any): Promise<Account> {
    if (!user) {
      throw new ApiException("unauthorized", 401, "Sign in to continue.");
    }

    const [row] = await this.db
      .select({
        name: userTable.name,
        image: userTable.image,
        commentEmails: userTable.commentEmails,
      })
      .from(userTable)
      .where(eq(userTable.id, user.id))
      .limit(1);

    if (!row) {
      throw new ApiException("unauthorized", 401, "Sign in to continue.");
    }

    const owner = isPlatformOwner(user, this.env.PLATFORM_OWNER_EMAIL);
    return {
      name: row.name,
      image: row.image ?? null,
      commentEmails: row.commentEmails,
      isPlatformOwner: owner,
      ownedWorkspaces: await this.ownedWorkspaces(user.id),
    };
  }

  @Patch("preferences")
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @SerializeOptions({ schema: AccountSchema })
  async updatePreferences(
    @CurrentUser() user: any,
    @Body({ schema: UpdatePreferencesInputSchema })
    input: UpdatePreferencesInput
  ): Promise<Account> {
    if (!user) {
      throw new ApiException("unauthorized", 401, "Sign in to continue.");
    }

    await this.db
      .update(userTable)
      .set({ commentEmails: input.commentEmails })
      .where(eq(userTable.id, user.id));

    const [row] = await this.db
      .select({
        name: userTable.name,
        image: userTable.image,
        commentEmails: userTable.commentEmails,
      })
      .from(userTable)
      .where(eq(userTable.id, user.id))
      .limit(1);

    if (!row) {
      throw new ApiException("unauthorized", 401, "Sign in to continue.");
    }

    const owner = isPlatformOwner(user, this.env.PLATFORM_OWNER_EMAIL);
    return {
      name: row.name,
      image: row.image ?? null,
      commentEmails: row.commentEmails,
      isPlatformOwner: owner,
      ownedWorkspaces: await this.ownedWorkspaces(user.id),
    };
  }

  @Post("delete")
  @HttpCode(204)
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async deleteAccount(
    @CurrentUser() user: any,
    @Body({ schema: DeleteAccountInputSchema }) input: DeleteAccountInput
  ): Promise<void> {
    if (!user) {
      throw new ApiException("unauthorized", 401, "Sign in to continue.");
    }
    await this.accountService.deleteAccount(user, input);
  }
}
