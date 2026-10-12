import { Module } from "@nestjs/common";
import { UploadsController } from "./uploads.controller.js";
import { UserThrottlerGuard } from "../feedback/throttle.js";

@Module({
  controllers: [UploadsController],
  providers: [UserThrottlerGuard],
})
export class UploadsModule {}
