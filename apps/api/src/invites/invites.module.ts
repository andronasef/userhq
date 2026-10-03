import { Module } from "@nestjs/common";
import { InvitesService } from "./invites.service.js";

import { InvitesController } from "./invites.controller.js";

@Module({
  controllers: [InvitesController],
  providers: [InvitesService],
  exports: [InvitesService],
})
export class InvitesModule {}
