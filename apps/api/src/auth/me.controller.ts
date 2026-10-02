import {
  Controller,
  Get,
  Inject,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DB, type Db, workspaces, workspaceMembers, uploads } from "@userhq/db";
import {
  MeResponseSchema,
  ANONYMOUS_ME,
  type MeResponse,
} from "@userhq/types";
import { ENV, type Env } from "../env.js";
import { Public, CurrentUser } from "./decorators.js";
import { isPlatformOwner } from "./platform-owner.js";

@Controller("me")
@Public()
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class MeController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db
  ) {}

  @Get()
  @SerializeOptions({ schema: MeResponseSchema })
  async getMe(@CurrentUser() user: any): Promise<MeResponse> {
    if (!user) {
      return ANONYMOUS_ME;
    }

    const owner = isPlatformOwner(user, this.env.PLATFORM_OWNER_EMAIL);

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
      .where(eq(workspaceMembers.userId, user.id))
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
      canCreateWorkspace: owner,
      workspaces: userWorkspaces,
    });
  }
}
