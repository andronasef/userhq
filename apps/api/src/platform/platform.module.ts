import { Module } from "@nestjs/common";
import { PlatformController } from "./platform.controller.js";
import { PlatformOwnerGuard } from "./platform-owner.guard.js";
import { InvitesModule } from "../invites/invites.module.js";

@Module({
  imports: [InvitesModule],
  controllers: [PlatformController],
  providers: [PlatformOwnerGuard],
})
export class PlatformModule {}
