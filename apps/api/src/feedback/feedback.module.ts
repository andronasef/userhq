import { Module } from "@nestjs/common";
import { CategoriesController } from "./categories.controller.js";
import { PortalPostsController } from "./portal-posts.controller.js";
import { PortalVotesController } from "./portal-votes.controller.js";
import { PostsService } from "./posts.service.js";
import { VotesService } from "./votes.service.js";
import { PortalGuard } from "../portal/portal.guard.js";
import { TenantGuard } from "../tenancy/tenant.guard.js";

@Module({
  controllers: [
    PortalPostsController,
    PortalVotesController,
    CategoriesController,
  ],
  providers: [PostsService, VotesService, PortalGuard, TenantGuard],
  exports: [PostsService, VotesService],
})
export class FeedbackModule {}

