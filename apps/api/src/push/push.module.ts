import { Module } from "@nestjs/common";
import { PushController } from "./push.controller.js";
import { PushFollowController } from "./push-follow.controller.js";
import { PushService } from "./push.service.js";
import { PushWorker } from "./push.worker.js";

@Module({
  controllers: [PushController, PushFollowController],
  providers: [PushService, PushWorker],
  exports: [PushService, PushWorker],
})
export class PushModule {}
