import {
  Controller,
  Put,
  Delete,
  UseGuards,
  UseInterceptors,
  SerializeOptions,
  HttpCode,
  HttpStatus,
  Req,
  Param,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { z } from "zod";
import { Throttle } from "@nestjs/throttler";
import { VoteResultSchema, type VoteResult } from "@userhq/types";
import { CurrentUser } from "../auth/decorators.js";
import { ApiException } from "../common/api-error.filter.js";
import { PortalGuard } from "../portal/portal.guard.js";
import { VotesService } from "./votes.service.js";
import { UserThrottlerGuard } from "./throttle.js";

const postNumberParamSchema = z.coerce.number().int().positive();

@Controller("portal/:ws/:product/posts/:number/vote")
@UseGuards(PortalGuard)
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class PortalVotesController {
  constructor(private readonly votesService: VotesService) {}

  @Put()
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ schema: VoteResultSchema })
  async putVote(
    @Req() req: any,
    @Param("number") rawNumber: string,
    @CurrentUser() user: any
  ): Promise<VoteResult> {
    const parseResult = postNumberParamSchema.safeParse(rawNumber);
    if (!parseResult.success) {
      throw new ApiException("post_not_found", 404, "Not found.");
    }
    return this.votesService.setVote(
      req.portal.productId,
      parseResult.data,
      user.id,
      true
    );
  }

  @Delete()
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @SerializeOptions({ schema: VoteResultSchema })
  async deleteVote(
    @Req() req: any,
    @Param("number") rawNumber: string,
    @CurrentUser() user: any
  ): Promise<VoteResult> {
    const parseResult = postNumberParamSchema.safeParse(rawNumber);
    if (!parseResult.success) {
      throw new ApiException("post_not_found", 404, "Not found.");
    }
    return this.votesService.setVote(
      req.portal.productId,
      parseResult.data,
      user.id,
      false
    );
  }
}
