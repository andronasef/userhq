import {
  Controller,
  Put,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { z } from "zod";
import {
  StatusChangeInputSchema,
  StatusChangeResultSchema,
  type StatusChangeInput,
  type StatusChangeResult,
} from "@userhq/types";
import { TenantGuard, type Tenant } from "../tenancy/tenant.guard.js";
import { CurrentTenant } from "../tenancy/current-tenant.decorator.js";
import { CurrentUser } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { ModerationService } from "./moderation.service.js";

const postNumberParamSchema = z.coerce.number().int().positive();

@Controller("workspaces/:ws/products/:product/posts")
@UseGuards(TenantGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class AdminPostsController {
  constructor(private readonly moderationService: ModerationService) {}

  @Put(":number/status")
  @SerializeOptions({ schema: StatusChangeResultSchema })
  async changeStatus(
    @CurrentTenant() tenant: Tenant,
    @CurrentUser() user: any,
    @Param("number") number: string,
    @Body({ schema: StatusChangeInputSchema }) input: StatusChangeInput
  ): Promise<StatusChangeResult> {
    const parsedNumber = postNumberParamSchema.safeParse(number);
    if (!parsedNumber.success) {
      throw new ApiException(
        "post_not_found",
        404,
        "This post was removed or merged. Go back to the board."
      );
    }

    return this.moderationService.changeStatus(
      { workspaceId: tenant.workspaceId, productId: tenant.productId! },
      user,
      parsedNumber.data,
      input
    );
  }
}
