import {
  Controller,
  Get,
  Inject,
  UseInterceptors,
  SerializeOptions,
  Req,
  Res,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import { DB, type Db, workspaces, workspaceMembers, uploads } from "@userhq/db";
import { MeResponseSchema, ANONYMOUS_ME, type MeResponse } from "@userhq/types";
import { ENV, type Env } from "../env.js";
import { Public, CurrentUser } from "./decorators.js";
import { isPlatformOwner } from "./platform-owner.js";

import { InvitesService } from "../invites/invites.service.js";
import {
  AUTH_OUTCOME_COOKIE,
  verifyAuthOutcome,
} from "../analytics/auth-outcome.js";
import { recordOutcome } from "../analytics/context.js";

@Controller("me")
@Public()
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class MeController {
  private readonly consumedAuthOutcomes = new Map<string, number>();
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db,
    private readonly invitesService: InvitesService,
  ) {}

  @Get()
  @SerializeOptions({ schema: MeResponseSchema })
  async getMe(
    @CurrentUser() user: any,
    @Req() req?: any,
    @Res({ passthrough: true }) res?: any,
  ): Promise<MeResponse> {
    if (
      req?.headers?.["x-userhq-browser"] === "1" &&
      req.session?.session?.id
    ) {
      const raw = req.headers.cookie
        ?.split(";")
        .map((x: string) => x.trim())
        .find((x: string) => x.startsWith(AUTH_OUTCOME_COOKIE + "="))
        ?.slice(AUTH_OUTCOME_COOKIE.length + 1);
      if (raw) {
        const outcome = verifyAuthOutcome(
          raw,
          this.env.BETTER_AUTH_SECRET,
          req.session.session.id,
          user?.id,
        );
        res?.clearCookie(AUTH_OUTCOME_COOKIE, {
          path: "/api/v1/me",
          httpOnly: true,
          sameSite: "lax",
          secure: this.env.PUBLIC_URL.startsWith("https:"),
        });
        const now = Date.now();
        for (const [id, expiry] of this.consumedAuthOutcomes)
          if (expiry < now) this.consumedAuthOutcomes.delete(id);
        if (outcome && !this.consumedAuthOutcomes.has(outcome.session)) {
          if (this.consumedAuthOutcomes.size >= 5000)
            this.consumedAuthOutcomes.delete(
              this.consumedAuthOutcomes.keys().next().value!,
            );
          this.consumedAuthOutcomes.set(outcome.session, outcome.expires);
          if (outcome.signup)
            recordOutcome("sign_up", {
              method: outcome.method,
              module: "auth",
            });
          recordOutcome("login", { method: outcome.method, module: "auth" });
        }
      }
    }
    if (!user) {
      return ANONYMOUS_ME;
    }

    const owner = isPlatformOwner(user, this.env.PLATFORM_OWNER_EMAIL);
    const hasInvite = await this.invitesService.hasPendingPlatformInvite(user);
    const canCreate = owner || hasInvite;

    const rows = await this.db
      .select({
        slug: workspaces.slug,
        name: workspaces.name,
        role: workspaceMembers.role,
        logoKey: uploads.storageKey,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .leftJoin(uploads, eq(workspaces.logoUploadId, uploads.id))
      .where(
        and(eq(workspaceMembers.userId, user.id), isNull(workspaces.deletedAt)),
      )
      .orderBy(workspaces.name, workspaces.slug);

    const userWorkspaces = rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      role: r.role,
      logoUrl: r.logoKey ? `/uploads/${r.logoKey}` : null,
    }));

    return MeResponseSchema.parse({
      user: {
        id: user.id,
        name: user.name,
        image: user.image ?? null,
      },
      isPlatformOwner: owner,
      canCreateWorkspace: canCreate,
      workspaces: userWorkspaces,
    });
  }
}
