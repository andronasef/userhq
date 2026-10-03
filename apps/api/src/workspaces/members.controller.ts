import {
  Controller,
  Get,
  Delete,
  Post,
  Param,
  HttpCode,
  HttpStatus,
  Inject,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { and, eq, sql } from "drizzle-orm";
import {
  DB,
  type Db,
  workspaceMembers,
  user,
} from "@userhq/db";
import {
  MemberRowSchema,
  type MemberRow,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { CurrentUser } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";

@Controller("workspaces/:ws")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class MembersController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get("members")
  @SerializeOptions({ schema: MemberRowSchema })
  async listMembers(
    @CurrentTenant() tenant: Tenant
  ): Promise<MemberRow[]> {
    const rows = await this.db
      .select({
        userId: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.createdAt,
      })
      .from(workspaceMembers)
      .innerJoin(user, eq(workspaceMembers.userId, user.id))
      .where(eq(workspaceMembers.workspaceId, tenant.workspaceId))
      .orderBy(
        sql`CASE WHEN ${workspaceMembers.role} = 'owner' THEN 0 ELSE 1 END`,
        user.name
      );

    return rows.map((row) => ({
      userId: row.userId,
      name: row.name,
      email: row.email,
      image: row.image,
      role: row.role,
      joinedAt: row.joinedAt.toISOString(),
    }));
  }

  @Delete("members/:userId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() currentUser: any,
    @Param("userId") userId: string
  ): Promise<void> {
    if (userId === currentUser.id) {
      throw new ApiException("not_allowed", 403, "You cannot remove yourself.");
    }

    const deleted = await this.db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, tenant.workspaceId),
          eq(workspaceMembers.userId, userId),
          eq(workspaceMembers.role, "admin")
        )
      )
      .returning({ userId: workspaceMembers.userId });

    if (deleted.length > 0) {
      return;
    }

    const [target] = await this.db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, tenant.workspaceId),
          eq(workspaceMembers.userId, userId)
        )
      )
      .limit(1);

    if (target?.role === "owner") {
      throw new ApiException("not_allowed", 403, "The owner cannot be removed.");
    }

    throw new ApiException("not_found", 404, "Member not found.");
  }

  @Post("leave")
  @HttpCode(HttpStatus.NO_CONTENT)
  async leaveWorkspace(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() currentUser: any
  ): Promise<void> {
    if (tenant.role === "owner") {
      throw new ApiException(
        "not_allowed",
        403,
        "The owner cannot leave the workspace."
      );
    }

    await this.db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, tenant.workspaceId),
          eq(workspaceMembers.userId, currentUser.id)
        )
      );
  }
}
