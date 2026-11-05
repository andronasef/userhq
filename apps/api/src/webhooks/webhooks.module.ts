import { Module } from "@nestjs/common";
import { WebhooksController } from "./webhooks.controller.js";
import { WebhookService } from "./webhook.service.js";
import { WebhookWorker } from "./webhook.worker.js";

@Module({
  controllers: [WebhooksController],
  providers: [WebhookService, WebhookWorker],
  exports: [WebhookService, WebhookWorker],
})
export class WebhooksModule {}
