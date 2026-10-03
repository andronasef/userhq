import { Module } from "@nestjs/common";
import { EmailWorker } from "./worker.js";
import { UnsubscribeController } from "./unsubscribe.controller.js";
import { UserThrottlerGuard } from "../feedback/throttle.js";

@Module({
  controllers: [UnsubscribeController],
  providers: [EmailWorker, UserThrottlerGuard],
  exports: [EmailWorker],
})
export class EmailModule {}

