import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { z } from "zod";
import {
  NotificationListResponseSchema,
  UnreadNotificationCountResponseSchema,
  MarkReadResponseSchema,
  MarkReadInputSchema,
  type NotificationListResponse,
  type UnreadNotificationCountResponse,
  type MarkReadResponse,
  type MarkReadInput,
} from "@userhq/types";
import { CurrentUser } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { NotificationsService } from "./notifications.service.js";

const UuidParamSchema = z.string().uuid();

@Controller("notifications")
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("unread-count")
  @SerializeOptions({ schema: UnreadNotificationCountResponseSchema })
  async getUnreadCount(
    @CurrentUser() user: { id: string }
  ): Promise<UnreadNotificationCountResponse> {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Get()
  @SerializeOptions({ schema: NotificationListResponseSchema })
  async listNotifications(
    @CurrentUser() user: { id: string },
    @Query("cursor") cursor?: string
  ): Promise<NotificationListResponse> {
    return this.notificationsService.listNotifications(user.id, cursor);
  }

  @Post("mark-read")
  @SerializeOptions({ schema: MarkReadResponseSchema })
  async markRead(
    @CurrentUser() user: { id: string },
    @Body({ schema: MarkReadInputSchema }) input: MarkReadInput
  ): Promise<MarkReadResponse> {
    return this.notificationsService.markRead(user.id, input.notificationIds);
  }

  @Post(":postId/read")
  @SerializeOptions({ schema: MarkReadResponseSchema })
  async markPostRead(
    @CurrentUser() user: { id: string },
    @Param("postId") rawPostId: string
  ): Promise<MarkReadResponse> {
    const parsed = UuidParamSchema.safeParse(rawPostId);
    if (!parsed.success) {
      throw new ApiException("validation_failed", 400, "Invalid post ID.");
    }
    return this.notificationsService.markPostRead(user.id, parsed.data);
  }
}
