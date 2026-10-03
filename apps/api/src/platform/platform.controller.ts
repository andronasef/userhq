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
import { Public, CurrentUser } from "../auth/decorators.js";
import { PlatformOwnerGuard } from "./platform-owner.guard.js";
import { InvitesService } from "../invites/invites.service.js";
import { z } from "zod";

@Controller("platform")
@Public()
@UseGuards(PlatformOwnerGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PlatformController {
  constructor(private readonly invitesService: InvitesService) {}

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
}
