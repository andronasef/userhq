import { Module } from "@nestjs/common";
import { PortalController } from "./portal.controller.js";
import { PortalGuard } from "./portal.guard.js";

@Module({
  controllers: [PortalController],
  providers: [PortalGuard],
})
export class PortalModule {}
