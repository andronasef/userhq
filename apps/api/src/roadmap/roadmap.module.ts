import { Module } from "@nestjs/common";
import { RoadmapService } from "./roadmap.service.js";
import { RoadmapController } from "./roadmap.controller.js";
import { PortalRoadmapController } from "./portal-roadmap.controller.js";

@Module({
  controllers: [RoadmapController, PortalRoadmapController],
  providers: [RoadmapService],
  exports: [RoadmapService],
})
export class RoadmapModule {}
