import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import type { PublicBadgeChip } from "@userhq/types";
import { Public } from "../auth/decorators.js";
import { PortalGuard } from "../portal/portal.guard.js";
import { PortalFeature } from "../portal/product-features.js";
import { BadgesService } from "./badges.service.js";

const AttributeInputSchema = z.object({
  searchParams: z.record(z.string(), z.string()),
});

const ClaimInputSchema = z.object({
  badgeIds: z.array(z.string().uuid()),
});

@Controller("portal/:ws/:product/badges")
@Public()
@PortalFeature("exempt")
@UseGuards(PortalGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalBadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Post("attribute")
  async attributeVisitor(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Body() body: unknown
  ): Promise<{ matchedBadges: PublicBadgeChip[] }> {
    const productId = req.portal?.productId;
    if (!productId) {
      return { matchedBadges: [] };
    }

    const { searchParams } = AttributeInputSchema.parse(body);
    const userId = req.user?.id;

    const { matchedBadges, matchedBadgeIds } =
      await this.badgesService.evaluateAttribution(
        productId,
        searchParams,
        userId
      );

    if (matchedBadgeIds.length > 0) {
      const cookieName = `uhq_attr_${productId}`;
      // Cookie valid for 30 days
      res.cookie(cookieName, JSON.stringify(matchedBadgeIds), {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });
    }

    return { matchedBadges };
  }

  @Post("claim")
  async claimBadges(
    @Req() req: any,
    @Body() body: unknown
  ): Promise<{ success: boolean }> {
    const productId = req.portal?.productId;
    const userId = req.user?.id;
    if (!productId || !userId) {
      return { success: false };
    }

    const { badgeIds } = ClaimInputSchema.parse(body);
    for (const badgeId of badgeIds) {
      await this.badgesService.assignUserBadge(
        productId,
        userId,
        { badgeId },
        undefined
      );
    }

    return { success: true };
  }
}
