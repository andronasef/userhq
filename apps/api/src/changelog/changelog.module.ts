import { Module } from "@nestjs/common";
import { ChangelogService } from "./changelog.service.js";
import { ChangelogController } from "./changelog.controller.js";
import { PortalChangelogController } from "./portal-changelog.controller.js";

@Module({
  controllers: [ChangelogController, PortalChangelogController],
  providers: [ChangelogService],
  exports: [ChangelogService],
})
export class ChangelogModule {}
