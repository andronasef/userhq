import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  UseInterceptors,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { CurrentUser, Public } from "../auth/decorators.js";
import { PushService } from "./push.service.js";
import {
  RegisterPushSubscriptionInputSchema,
  UpdatePushPreferencesInputSchema,
  type RegisterPushSubscriptionInput,
  type UpdatePushPreferencesInput,
  type PushSubscriptionResponse,
  type PushPreferences,
  type FollowedProductItem,
  type VapidPublicKeyResponse,
  type PushTestResponse,
} from "@userhq/types";

@Controller("push")
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PushController {
  constructor(private readonly pushService: PushService) {}

  @Public()
  @Get("vapid-public-key")
  getVapidPublicKey(): VapidPublicKeyResponse {
    return this.pushService.getVapidPublicKey();
  }

  @Post("subscriptions")
  @HttpCode(201)
  async registerSubscription(
    @CurrentUser() user: { id: string },
    @Body({ schema: RegisterPushSubscriptionInputSchema })
    body: RegisterPushSubscriptionInput
  ): Promise<PushSubscriptionResponse> {
    return this.pushService.registerSubscription(user.id, body);
  }

  @Delete("subscriptions")
  @HttpCode(200)
  async unregisterSubscription(
    @CurrentUser() user: { id: string },
    @Body("endpoint") bodyEndpoint?: string,
    @Query("endpoint") queryEndpoint?: string
  ): Promise<{ success: boolean }> {
    const endpoint = bodyEndpoint || queryEndpoint || "";
    return this.pushService.unregisterSubscription(user.id, endpoint);
  }

  @Get("preferences")
  async getPreferences(
    @CurrentUser() user: { id: string }
  ): Promise<PushPreferences> {
    return this.pushService.getPreferences(user.id);
  }

  @Patch("preferences")
  async updatePreferences(
    @CurrentUser() user: { id: string },
    @Body({ schema: UpdatePushPreferencesInputSchema })
    body: UpdatePushPreferencesInput
  ): Promise<PushPreferences> {
    return this.pushService.updatePreferences(user.id, body);
  }

  @Get("followed-products")
  async getFollowedProducts(
    @CurrentUser() user: { id: string }
  ): Promise<FollowedProductItem[]> {
    return this.pushService.getFollowedProducts(user.id);
  }

  @Post("followed-products/:productId")
  @HttpCode(200)
  async followProduct(
    @CurrentUser() user: { id: string },
    @Param("productId") productId: string
  ): Promise<{ success: boolean }> {
    return this.pushService.followProduct(user.id, productId);
  }

  @Delete("followed-products/:productId")
  @HttpCode(200)
  async unfollowProduct(
    @CurrentUser() user: { id: string },
    @Param("productId") productId: string
  ): Promise<{ success: boolean }> {
    return this.pushService.unfollowProduct(user.id, productId);
  }

  @Post("test")
  @HttpCode(200)
  async sendTestPush(
    @CurrentUser() user: { id: string }
  ): Promise<PushTestResponse> {
    return this.pushService.enqueueTestPush(user.id);
  }
}
