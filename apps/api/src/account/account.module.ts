import { Module } from "@nestjs/common";
import { AccountController } from "./account.controller.js";
import { UserThrottlerGuard } from "../feedback/throttle.js";

@Module({
  controllers: [AccountController],
  providers: [UserThrottlerGuard],
  exports: [],
})
export class AccountModule {}
