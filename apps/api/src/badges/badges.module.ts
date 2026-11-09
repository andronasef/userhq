import { UserThrottlerGuard } from "../feedback/throttle.js";
import { Module } from "@nestjs/common";
import { BadgesService } from "./badges.service.js";
import { BadgesController } from "./badges.controller.js";
import { ProductUsersController } from "./product-users.controller.js";
import { PortalBadgesController } from "./portal-badges.controller.js";

@Module({
  controllers: [
    BadgesController,
    ProductUsersController,
    PortalBadgesController,
  ],
  providers: [BadgesService, UserThrottlerGuard],
  exports: [BadgesService],
})
export class BadgesModule {}
