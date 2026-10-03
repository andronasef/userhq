import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import {
  DB,
  type Db,
  workspaces,
  workspaceMembers,
  uploads,
} from "@userhq/db";
import {
  CreateWorkspaceInputSchema,
  WorkspaceCreatedSchema,
  WorkspaceSchema,
  UpdateWorkspaceInputSchema,
  type CreateWorkspaceInput,
  type WorkspaceCreated,
  type Workspace,
  type UpdateWorkspaceInput,
} from "@userhq/types";
import { ENV, type Env } from "../env.js";
import { CurrentUser } from "../auth/decorators.js";
import { isPlatformOwner } from "../auth/platform-owner.js";
import { ApiException } from "../common/api-error.filter.js";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { InvitesService } from "../invites/invites.service.js";

@Controller("workspaces")
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class WorkspacesController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(DB) private readonly db: Db,
    private readonly invitesService: InvitesService
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @SerializeOptions({ schema: WorkspaceCreatedSchema })
  async create(
    @Body({ schema: CreateWorkspaceInputSchema }) input: CreateWorkspaceInput,
    @CurrentUser() user: any
  ): Promise<WorkspaceCreated> {
    const owner = isPlatformOwner(user, this.env.PLATFORM_OWNER_EMAIL);
    if (!owner && user.emailVerified !== true) {
      throw new ApiException(
        "not_allowed",
        403,
        "Workspace creation is invite-only."
      );
    }

    if (input.logoUploadId) {
      const [upload] = await this.db
        .select({ id: uploads.id })
        .from(uploads)
        .where(
          and(
            eq(uploads.id, input.logoUploadId),
            eq(uploads.uploaderId, user.id)
          )
        )
        .limit(1);

      if (!upload) {
        throw new ApiException(
          "validation_failed",
          400,
          "That logo can't be used."
        );
      }
    }

    await this.db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(workspaces)
        .values({
          slug: input.slug,
          name: input.name,
          logoUploadId: input.logoUploadId ?? null,
        })
        .onConflictDoNothing({ target: workspaces.slug })
        .returning({ id: workspaces.id });

      if (!inserted) {
        throw new ApiException("slug_taken", 409, "That URL is taken.");
      }

      await tx.insert(workspaceMembers).values({
        workspaceId: inserted.id,
        userId: user.id,
        role: "owner",
      });

      if (!owner) {
        await this.invitesService.claimPlatformInvite(tx, user, inserted.id);
      }
    });

    return WorkspaceCreatedSchema.parse({ slug: input.slug });
  }
}

@Controller("workspaces/:ws")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class WorkspaceController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  @SerializeOptions({ schema: WorkspaceSchema })
  async getWorkspace(
    @CurrentTenant() tenant: Tenant
  ): Promise<Workspace> {
    const [row] = await this.db
      .select({
        slug: workspaces.slug,
        name: workspaces.name,
        websiteUrl: workspaces.websiteUrl,
        directoryEnabled: workspaces.directoryEnabled,
        logoKey: uploads.storageKey,
      })
      .from(workspaces)
      .leftJoin(uploads, eq(workspaces.logoUploadId, uploads.id))
      .where(eq(workspaces.id, tenant.workspaceId))
      .limit(1);

    if (!row) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    return WorkspaceSchema.parse({
      slug: row.slug,
      name: row.name,
      logoUrl: row.logoKey ? `/uploads/${row.logoKey}` : null,
      websiteUrl: row.websiteUrl ?? null,
      directoryEnabled: row.directoryEnabled,
      role: tenant.role,
    });
  }

  @Patch()
  @SerializeOptions({ schema: WorkspaceSchema })
  async updateWorkspace(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Body({ schema: UpdateWorkspaceInputSchema }) input: UpdateWorkspaceInput
  ): Promise<Workspace> {
    if (input.logoUploadId) {
      const [upload] = await this.db
        .select({ id: uploads.id })
        .from(uploads)
        .where(
          and(
            eq(uploads.id, input.logoUploadId),
            eq(uploads.uploaderId, user.id)
          )
        )
        .limit(1);

      if (!upload) {
        throw new ApiException(
          "validation_failed",
          400,
          "That logo can't be used."
        );
      }
    }

    const updates: Partial<{
      name: string;
      logoUploadId: string | null;
      websiteUrl: string | null;
      directoryEnabled: boolean;
    }> = {};

    if (input.name !== undefined) updates.name = input.name;
    if (input.logoUploadId !== undefined) updates.logoUploadId = input.logoUploadId;
    if (input.websiteUrl !== undefined) updates.websiteUrl = input.websiteUrl;
    if (input.directoryEnabled !== undefined) updates.directoryEnabled = input.directoryEnabled;

    if (Object.keys(updates).length > 0) {
      await this.db
        .update(workspaces)
        .set(updates)
        .where(eq(workspaces.id, tenant.workspaceId));
    }

    const [row] = await this.db
      .select({
        slug: workspaces.slug,
        name: workspaces.name,
        websiteUrl: workspaces.websiteUrl,
        directoryEnabled: workspaces.directoryEnabled,
        logoKey: uploads.storageKey,
      })
      .from(workspaces)
      .leftJoin(uploads, eq(workspaces.logoUploadId, uploads.id))
      .where(eq(workspaces.id, tenant.workspaceId))
      .limit(1);

    if (!row) {
      throw new ApiException("not_found", 404, "Not found.");
    }

    return WorkspaceSchema.parse({
      slug: row.slug,
      name: row.name,
      logoUrl: row.logoKey ? `/uploads/${row.logoKey}` : null,
      websiteUrl: row.websiteUrl ?? null,
      directoryEnabled: row.directoryEnabled,
      role: tenant.role,
    });
  }
}
