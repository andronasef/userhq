import {
  Controller,
  Get,
  Param,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { InviteLookupSchema, type InviteLookup } from "@userhq/types";
import { CurrentUser } from "../auth/decorators.js";
import { InvitesService } from "./invites.service.js";

@Controller("invites")
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get(":token")
  @SerializeOptions({ schema: InviteLookupSchema })
  async lookup(
    @Param("token") token: string,
    @CurrentUser() user: any
  ): Promise<InviteLookup> {
    return await this.invitesService.lookup(token, user);
  }
}
