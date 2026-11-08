import { Module } from "@nestjs/common";
import { ChangelogService } from "./changelog.service.js";
import { ChangelogController } from "./changelog.controller.js";
import { PortalChangelogController } from "./portal-changelog.controller.js";
import { ChangelogScheduler } from "./changelog.scheduler.js";

@Module({
  controllers: [ChangelogController, PortalChangelogController],
  providers: [ChangelogService, ChangelogScheduler],
  exports: [ChangelogService],
})
export class ChangelogModule {}
