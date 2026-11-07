import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { z } from "zod";
import {
  createWebhookSubscriptionSchema,
  type CreateWebhookSubscriptionInput,
  updateWebhookSubscriptionSchema,
  type UpdateWebhookSubscriptionInput,
  webhookSubscriptionSchema,
  type WebhookSubscription,
  webhookSubscriptionWithSecretSchema,
  type WebhookSubscriptionWithSecret,
  webhookSubscriptionListResponseSchema,
  type WebhookSubscriptionListResponse,
  webhookDeliveryListResponseSchema,
  type WebhookDeliveryListResponse,
  webhookDeliverySchema,
  type WebhookDelivery,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { CurrentUser } from "../auth/decorators.js";
import { RequireScopes } from "../api-keys/api-key.decorator.js";
import { WebhookService } from "./webhook.service.js";
import { ApiException } from "../common/api-error.filter.js";
import { Throttle } from "@nestjs/throttler";
import { UserThrottlerGuard } from "../feedback/throttle.js";

const uuidParamSchema = z.string().uuid();
const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

@Controller("workspaces/:ws/webhooks")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class WebhooksController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get()
  @RequireScopes("webhooks:read")
  @SerializeOptions({ schema: webhookSubscriptionListResponseSchema })
  async listSubscriptions(
    @CurrentTenant() tenant: Tenant
  ): Promise<WebhookSubscriptionListResponse> {
    const subscriptions = await this.webhookService.listSubscriptions(
      tenant.workspaceId
    );
    return { subscriptions };
  }

  @Post()
  @RequireScopes("webhooks:write")
  @HttpCode(201)
  @SerializeOptions({ schema: webhookSubscriptionWithSecretSchema })
  async createSubscription(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Body({ schema: createWebhookSubscriptionSchema })
    input: CreateWebhookSubscriptionInput
  ): Promise<WebhookSubscriptionWithSecret> {
    return this.webhookService.createSubscription(
      tenant.workspaceId,
      user?.id ?? null,
      input
    );
  }

  @Get(":id")
  @RequireScopes("webhooks:read")
  @SerializeOptions({ schema: webhookSubscriptionSchema })
  async getSubscription(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string
  ): Promise<WebhookSubscription> {
    const parsed = uuidParamSchema.safeParse(id);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Webhook subscription not found.");
    }
    return this.webhookService.getSubscription(tenant.workspaceId, parsed.data);
  }

  @Patch(":id")
  @RequireScopes("webhooks:write")
  @SerializeOptions({ schema: webhookSubscriptionSchema })
  async updateSubscription(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string,
    @Body({ schema: updateWebhookSubscriptionSchema })
    input: UpdateWebhookSubscriptionInput
  ): Promise<WebhookSubscription> {
    const parsed = uuidParamSchema.safeParse(id);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Webhook subscription not found.");
    }
    return this.webhookService.updateSubscription(
      tenant.workspaceId,
      parsed.data,
      input
    );
  }

  @Delete(":id")
  @RequireScopes("webhooks:write")
  @HttpCode(204)
  async deleteSubscription(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string
  ): Promise<void> {
    const parsed = uuidParamSchema.safeParse(id);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Webhook subscription not found.");
    }
    return this.webhookService.deleteSubscription(tenant.workspaceId, parsed.data);
  }

  // Deliberately no @RequireScopes: unscoped handlers are session-only, so no API key can rotate a secret.
  @Post(":id/rotate-secret")
  @HttpCode(200)
  @SerializeOptions({ schema: webhookSubscriptionWithSecretSchema })
  async rotateSecret(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string
  ): Promise<WebhookSubscriptionWithSecret> {
    const parsed = uuidParamSchema.safeParse(id);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Webhook subscription not found.");
    }
    return this.webhookService.rotateSecret(tenant.workspaceId, parsed.data);
  }

  @Post(":id/ping")
  @RequireScopes("webhooks:write")
  async pingSubscription(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string
  ): Promise<{ enqueued: boolean; deliveryId: string }> {
    const parsed = uuidParamSchema.safeParse(id);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Webhook subscription not found.");
    }
    return this.webhookService.pingSubscription(tenant.workspaceId, parsed.data);
  }

  @Get(":id/deliveries")
  @RequireScopes("webhooks:read")
  @SerializeOptions({ schema: webhookDeliveryListResponseSchema })
  async listDeliveries(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string,
    @Query({ schema: paginationQuerySchema })
    query: { page: number; limit: number }
  ): Promise<WebhookDeliveryListResponse> {
    const parsed = uuidParamSchema.safeParse(id);
    if (!parsed.success) {
      throw new ApiException("not_found", 404, "Webhook subscription not found.");
    }
    return this.webhookService.listDeliveries(
      tenant.workspaceId,
      parsed.data,
      query.page,
      query.limit
    );
  }

  @Post(":id/deliveries/:deliveryId/redeliver")
  @HttpCode(200)
  @RequireScopes("webhooks:write")
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @SerializeOptions({ schema: webhookDeliverySchema })
  async redeliver(
    @CurrentTenant() tenant: Tenant,
    @Param("id") id: string,
    @Param("deliveryId") deliveryId: string
  ): Promise<WebhookDelivery> {
    const parsedId = uuidParamSchema.safeParse(id);
    const parsedDelivery = uuidParamSchema.safeParse(deliveryId);
    if (!parsedId.success || !parsedDelivery.success) {
      throw new ApiException("not_found", 404, "Delivery not found.");
    }
    return this.webhookService.retryDelivery(
      tenant.workspaceId,
      parsedId.data,
      parsedDelivery.data
    );
  }
}
