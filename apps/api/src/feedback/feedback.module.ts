import { Module } from "@nestjs/common";
import { CategoriesController } from "./categories.controller.js";
import { PortalPostsController } from "./portal-posts.controller.js";
import { PortalVotesController } from "./portal-votes.controller.js";
import { PortalCommentsController } from "./portal-comments.controller.js";
import { AdminPostsController } from "./admin-posts.controller.js";
import { AdminCommentsController } from "./admin-comments.controller.js";
import { PostsService } from "./posts.service.js";
import { VotesService } from "./votes.service.js";
import { CommentsService } from "./comments.service.js";
import { ModerationService } from "./moderation.service.js";
import { UserThrottlerGuard } from "./throttle.js";
import { PortalGuard } from "../portal/portal.guard.js";
import { TenantGuard } from "../tenancy/tenant.guard.js";

@Module({
  controllers: [
    PortalPostsController,
    PortalVotesController,
    PortalCommentsController,
    AdminPostsController,
    AdminCommentsController,
    CategoriesController,
  ],
  providers: [
    PostsService,
    VotesService,
    CommentsService,
    ModerationService,
    UserThrottlerGuard,
    PortalGuard,
    TenantGuard,
  ],
  exports: [
    PostsService,
    VotesService,
    CommentsService,
    ModerationService,
    UserThrottlerGuard,
  ],
})
export class FeedbackModule {}

