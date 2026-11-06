import { Module } from "@nestjs/common";
import { PushController } from "./push.controller.js";
import { PushService } from "./push.service.js";
import { PushWorker } from "./push.worker.js";

@Module({
  controllers: [PushController],
  providers: [PushService, PushWorker],
  exports: [PushService, PushWorker],
})
export class PushModule {}
