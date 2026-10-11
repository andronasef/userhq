import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service.js";
import { NotificationsController } from "./notifications.controller.js";
import { PortalActivityController } from "./portal-activity.controller.js";

@Module({
  controllers: [NotificationsController, PortalActivityController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
