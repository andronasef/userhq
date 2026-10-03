import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { eq, or, ilike, desc, sql } from "drizzle-orm";
import {
  DB,
  type Db,
  workspaces,
  products,
  workspaceMembers,
  uploads,
  user,
  session,
} from "@userhq/db";
import {
  CreateInviteInputSchema,
  InviteCreatedSchema,
  InviteRowSchema,
  PlatformListQuerySchema,
  PlatformWorkspacePageSchema,
  PlatformWorkspaceDetailSchema,
  PlatformUserPageSchema,
  type CreateInviteInput,
  type InviteCreated,
  type InviteRow,
  type PlatformListQuery,
  type PlatformWorkspacePage,
  type PlatformWorkspaceDetail,
  type PlatformUserPage,
} from "@userhq/types";
import { Public, CurrentUser } from "../auth/decorators.js";
import { PlatformOwnerGuard } from "./platform-owner.guard.js";
import { InvitesService } from "../invites/invites.service.js";
import { ApiException } from "../common/api-error.filter.js";
import { isPlatformOwner } from "../auth/platform-owner.js";
import { ENV, type Env } from "../env.js";
import { z } from "zod";

export function escapeLike(q: string): string {
  return q.replace(/[\\%_]/g, "\\$&");
}

@Controller("platform")
@Public()
@UseGuards(PlatformOwnerGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PlatformController {
  constructor(
    private readonly invitesService: InvitesService,
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env
  ) {}

  @Get("invites")
  @SerializeOptions({ schema: InviteRowSchema })
  async listInvites(): Promise<InviteRow[]> {
    return this.invitesService.list("platform", null);
  }

  @Post("invites")
  @HttpCode(HttpStatus.CREATED)
  @SerializeOptions({ schema: InviteCreatedSchema })
  async createInvite(
    @Body({ schema: CreateInviteInputSchema }) input: CreateInviteInput,
    @CurrentUser() user: any
  ): Promise<InviteCreated> {
    return this.invitesService.create({
      kind: "platform",
      workspaceId: null,
      email: input.email,
      createdById: user?.id ?? null,
    });
  }

  @Delete("invites/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @SerializeOptions({ schema: z.void() })
  async revokeInvite(@Param("id") id: string): Promise<void> {
    await this.invitesService.revoke("platform", null, id);
  }

  @Get("workspaces")
  @SerializeOptions({ schema: PlatformWorkspacePageSchema })
  async listWorkspaces(
    @Query({ schema: PlatformListQuerySchema }) query: PlatformListQuery
  ): Promise<PlatformWorkspacePage> {
    const page = query.page ?? 1;
    const q = query.q?.trim() || "";

    const whereClause =
      q.length > 0
        ? or(
            ilike(workspaces.name, `%${escapeLike(q)}%`),
            ilike(workspaces.slug, `%${escapeLike(q)}%`)
          )
        : undefined;

    const rows = await this.db
      .select({
        id: workspaces.id,
        slug: workspaces.slug,
        name: workspaces.name,
        logoKey: uploads.storageKey,
        suspended: sql<boolean>`${workspaces.suspendedAt} IS NOT NULL`,
        createdAt: workspaces.createdAt,
        productCount: sql<number>`(SELECT count(*)::int FROM products WHERE products.workspace_id = ${workspaces.id} AND products.deleted_at IS NULL)`,
        memberCount: sql<number>`(SELECT count(*)::int FROM workspace_members WHERE workspace_members.workspace_id = ${workspaces.id})`,
      })
      .from(workspaces)
      .leftJoin(uploads, eq(workspaces.logoUploadId, uploads.id))
      .where(whereClause)
      .orderBy(desc(workspaces.createdAt), desc(workspaces.id))
      .limit(51)
      .offset((page - 1) * 50);

    const hasNext = rows.length > 50;
    const slice = rows.slice(0, 50);

    return {
      rows: slice.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        logoUrl: r.logoKey ? `/uploads/${r.logoKey}` : null,
        productCount: Number(r.productCount),
        memberCount: Number(r.memberCount),
        // ponytail: Phase 3 replaces these zeros with posts/votes counts
        postCount: 0,
        // ponytail: Phase 3 replaces these zeros with posts/votes counts
        voteCount: 0,
        suspended: Boolean(r.suspended),
        createdAt: r.createdAt.toISOString(),
      })),
      page,
      hasNext,
    };
  }

  @Get("workspaces/:id")
  @SerializeOptions({ schema: PlatformWorkspaceDetailSchema })
  async getWorkspaceDetail(
    @Param("id") id: string
  ): Promise<PlatformWorkspaceDetail> {
    if (!z.uuid().safeParse(id).success) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    const [wsRow] = await this.db
      .select({
        id: workspaces.id,
        slug: workspaces.slug,
        name: workspaces.name,
        logoKey: uploads.storageKey,
        suspended: sql<boolean>`${workspaces.suspendedAt} IS NOT NULL`,
        createdAt: workspaces.createdAt,
        productCount: sql<number>`(SELECT count(*)::int FROM products WHERE products.workspace_id = ${workspaces.id} AND products.deleted_at IS NULL)`,
        memberCount: sql<number>`(SELECT count(*)::int FROM workspace_members WHERE workspace_members.workspace_id = ${workspaces.id})`,
      })
      .from(workspaces)
      .leftJoin(uploads, eq(workspaces.logoUploadId, uploads.id))
      .where(eq(workspaces.id, id))
      .limit(1);

    if (!wsRow) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    const wsProducts = await this.db
      .select({
        slug: products.slug,
        name: products.name,
        deletedAt: products.deletedAt,
      })
      .from(products)
      .where(eq(products.workspaceId, id))
      .orderBy(desc(products.createdAt), desc(products.id));

    const wsMembers = await this.db
      .select({
        name: user.name,
        email: user.email,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.createdAt,
      })
      .from(workspaceMembers)
      .innerJoin(user, eq(workspaceMembers.userId, user.id))
      .where(eq(workspaceMembers.workspaceId, id))
      .orderBy(desc(workspaceMembers.createdAt));

    return {
      id: wsRow.id,
      slug: wsRow.slug,
      name: wsRow.name,
      logoUrl: wsRow.logoKey ? `/uploads/${wsRow.logoKey}` : null,
      productCount: Number(wsRow.productCount),
      memberCount: Number(wsRow.memberCount),
      // ponytail: Phase 3 replaces these zeros with posts/votes counts
      postCount: 0,
      // ponytail: Phase 3 replaces these zeros with posts/votes counts
      voteCount: 0,
      suspended: Boolean(wsRow.suspended),
      createdAt: wsRow.createdAt.toISOString(),
      products: wsProducts.map((p) => ({
        slug: p.slug,
        name: p.name,
        live: p.deletedAt === null,
        // ponytail: Phase 3 replaces these zeros with posts/votes counts
        postCount: 0,
        // ponytail: Phase 3 replaces these zeros with posts/votes counts
        voteCount: 0,
      })),
      members: wsMembers.map((m) => ({
        name: m.name,
        email: m.email,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
    };
  }

  @Post("workspaces/:id/suspend")
  @HttpCode(HttpStatus.NO_CONTENT)
  @SerializeOptions({ schema: z.void() })
  async suspendWorkspace(@Param("id") id: string): Promise<void> {
    if (!z.uuid().safeParse(id).success) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    const [updated] = await this.db
      .update(workspaces)
      .set({
        suspendedAt: sql`coalesce(${workspaces.suspendedAt}, now())`,
      })
      .where(eq(workspaces.id, id))
      .returning({ id: workspaces.id });

    if (!updated) {
      throw new ApiException("not_found", 404, "Not found.");
    }
  }

  @Delete("workspaces/:id/suspend")
  @HttpCode(HttpStatus.NO_CONTENT)
  @SerializeOptions({ schema: z.void() })
  async liftWorkspaceSuspension(@Param("id") id: string): Promise<void> {
    if (!z.uuid().safeParse(id).success) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    const [updated] = await this.db
      .update(workspaces)
      .set({
        suspendedAt: null,
      })
      .where(eq(workspaces.id, id))
      .returning({ id: workspaces.id });

    if (!updated) {
      throw new ApiException("not_found", 404, "Not found.");
    }
  }

  @Get("users")
  @SerializeOptions({ schema: PlatformUserPageSchema })
  async listUsers(
    @Query({ schema: PlatformListQuerySchema }) query: PlatformListQuery
  ): Promise<PlatformUserPage> {
    const page = query.page ?? 1;
    const q = query.q?.trim() || "";

    const whereClause =
      q.length > 0
        ? or(
            ilike(user.name, `%${escapeLike(q)}%`),
            ilike(user.email, `%${escapeLike(q)}%`)
          )
        : undefined;

    const rows = await this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        banned: sql<boolean>`${user.bannedAt} IS NOT NULL`,
        createdAt: user.createdAt,
        workspaceCount: sql<number>`(SELECT count(*)::int FROM workspace_members WHERE workspace_members.user_id = ${user.id})`,
      })
      .from(user)
      .where(whereClause)
      .orderBy(desc(user.createdAt), desc(user.id))
      .limit(51)
      .offset((page - 1) * 50);

    const hasNext = rows.length > 50;
    const slice = rows.slice(0, 50);

    return {
      rows: slice.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        image: r.image ?? null,
        workspaceCount: Number(r.workspaceCount),
        // ponytail: Phase 3 replaces these zeros with posts/votes counts
        postCount: 0,
        // ponytail: Phase 3 replaces these zeros with posts/votes counts
        voteCount: 0,
        banned: Boolean(r.banned),
        isPlatformOwner: isPlatformOwner(
          { email: r.email, emailVerified: true },
          this.env.PLATFORM_OWNER_EMAIL
        ),
        createdAt: r.createdAt.toISOString(),
      })),
      page,
      hasNext,
    };
  }

  @Post("users/:id/ban")
  @HttpCode(HttpStatus.NO_CONTENT)
  @SerializeOptions({ schema: z.void() })
  async banUser(@Param("id") id: string): Promise<void> {
    const [target] = await this.db
      .select({
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
      })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);

    if (!target) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    if (isPlatformOwner(target, this.env.PLATFORM_OWNER_EMAIL)) {
      throw new ApiException("not_allowed", 403, "Cannot ban the platform owner.");
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(user)
        .set({
          bannedAt: sql`coalesce(${user.bannedAt}, now())`,
        })
        .where(eq(user.id, id));

      await tx.delete(session).where(eq(session.userId, id));
    });
  }

  @Delete("users/:id/ban")
  @HttpCode(HttpStatus.NO_CONTENT)
  @SerializeOptions({ schema: z.void() })
  async liftUserBan(@Param("id") id: string): Promise<void> {
    const [target] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);

    if (!target) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    await this.db
      .update(user)
      .set({
        bannedAt: null,
      })
      .where(eq(user.id, id));
  }
}
