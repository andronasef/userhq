import { Module } from "@nestjs/common";
import { ApiKeyService } from "./api-key.service.js";
import { ApiKeysController } from "./api-keys.controller.js";

@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeyService],
  exports: [ApiKeyService],
})
export class ApiKeysModule {}
