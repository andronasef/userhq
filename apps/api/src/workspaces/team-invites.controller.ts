import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import {
  CreateInviteInputSchema,
  InviteCreatedSchema,
  InviteRowSchema,
  type CreateInviteInput,
  type InviteCreated,
  type InviteRow,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { CurrentUser } from "../auth/decorators.js";
import { InvitesService } from "../invites/invites.service.js";

@Controller("workspaces/:ws/invites")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class TeamInvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get()
  @SerializeOptions({ schema: InviteRowSchema })
  async list(
    @CurrentTenant() tenant: Tenant
  ): Promise<InviteRow[]> {
    return await this.invitesService.list("workspace", tenant.workspaceId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @SerializeOptions({ schema: InviteCreatedSchema })
  async create(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Body({ schema: CreateInviteInputSchema }) input: CreateInviteInput
  ): Promise<InviteCreated> {
    return await this.invitesService.create({
      kind: "workspace",
      workspaceId: tenant.workspaceId,
      email: input.email,
      createdById: user.id,
    });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string
  ): Promise<void> {
    await this.invitesService.revoke("workspace", tenant.workspaceId, id);
  }
}
