import { Module } from "@nestjs/common";
import { PortalPostsController } from "./portal-posts.controller.js";
import { PostsService } from "./posts.service.js";
import { PortalGuard } from "../portal/portal.guard.js";

@Module({
  controllers: [PortalPostsController],
  providers: [PostsService, PortalGuard],
  exports: [PostsService],
})
export class FeedbackModule {}
