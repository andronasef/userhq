import { Module } from "@nestjs/common";
import { CategoriesController } from "./categories.controller.js";
import { PortalPostsController } from "./portal-posts.controller.js";
import { PostsService } from "./posts.service.js";
import { PortalGuard } from "../portal/portal.guard.js";
import { TenantGuard } from "../tenancy/tenant.guard.js";

@Module({
  controllers: [PortalPostsController, CategoriesController],
  providers: [PostsService, PortalGuard, TenantGuard],
  exports: [PostsService],
})
export class FeedbackModule {}
