import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  Inject,
  StandardSchemaSerializerInterceptor,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";
import {
  AttributeInputSchema,
  AttributeResponseSchema,
  type AttributeInput,
  type AttributeResponse,
} from "@userhq/types";
import { ENV, type Env } from "../env.js";
import { Public } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { PortalGuard } from "../portal/portal.guard.js";
import { PortalFeature } from "../portal/product-features.js";
import { UserThrottlerGuard } from "../feedback/throttle.js";
import {
  attributionCookieName,
  attributionCookieOptions,
} from "./attribution.js";
import { BadgesService } from "./badges.service.js";

@Controller("portal/:ws/:product/badges")
@Public()
@PortalFeature("exempt")
@UseGuards(PortalGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalBadgesController {
  constructor(
    private readonly badgesService: BadgesService,
    @Inject(ENV) private readonly env: Env,
  ) {}
  @Post("attribute")
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @SerializeOptions({ schema: AttributeResponseSchema })
  async attributeVisitor(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Body({ schema: AttributeInputSchema }) input: AttributeInput,
  ): Promise<AttributeResponse> {
    const productId = req.portal?.productId;
    if (!productId) throw new ApiException("not_found", 404, "Not found.");
    const { matchedBadges, matchedEntries, scrubKeys } =
      await this.badgesService.evaluateAttribution(
        productId,
        input.searchParams,
        req.user?.id,
      );
    if (req.user?.id) {
      const { present } = await this.badgesService.bindPendingAttribution(
        productId,
        req.user.id,
        req.headers.cookie,
      );
      if (present)
        res.clearCookie(
          attributionCookieName(productId),
          attributionCookieOptions(this.env),
        );
    } else if (matchedEntries.length) {
      res.cookie(
        attributionCookieName(productId),
        this.badgesService.buildAttributionCookie(
          productId,
          matchedEntries,
          req.headers.cookie,
        ),
        attributionCookieOptions(this.env),
      );
    }
    return { matchedBadges, scrubKeys };
  }
}
