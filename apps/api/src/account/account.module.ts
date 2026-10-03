import { Module } from "@nestjs/common";
import { AccountController } from "./account.controller.js";
import { AccountService } from "./account.service.js";
import { UserThrottlerGuard } from "../feedback/throttle.js";

@Module({
  controllers: [AccountController],
  providers: [AccountService, UserThrottlerGuard],
  exports: [],
})
export class AccountModule {}
