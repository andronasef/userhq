import {
  Controller,
  Get,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { MeResponseSchema, type MeResponse } from "@userhq/types";
import { Public, CurrentUser } from "./decorators.js";

@Controller("me")
@Public()
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class MeController {
  @Get()
  @SerializeOptions({ schema: MeResponseSchema })
  getMe(@CurrentUser() user: any): MeResponse {
    if (!user) {
      return MeResponseSchema.parse({ user: null });
    }
    const publicUser = {
      id: user.id,
      name: user.name,
      image: user.image ?? null,
    };
    return MeResponseSchema.parse({ user: publicUser });
  }
}
