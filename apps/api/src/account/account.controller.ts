import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  Inject,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { eq } from "drizzle-orm";
import { DB, type Db, user as userTable } from "@userhq/db";
import {
  AccountSchema,
  type Account,
  UpdatePreferencesInputSchema,
  type UpdatePreferencesInput,
} from "@userhq/types";
import { ENV, type Env } from "../env.js";
import { CurrentUser } from "../auth/decorators.js";
import { isPlatformOwner } from "../auth/platform-owner.js";
import { ApiException } from "../common/api-error.filter.js";
import { UserThrottlerGuard } from "../feedback/throttle.js";

@Controller("account")
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class AccountController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env
  ) {}

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
    };
  }
}
