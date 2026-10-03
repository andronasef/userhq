import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  UseInterceptors,
  SerializeOptions,
} from "@nestjs/common";
import { StandardSchemaSerializerInterceptor } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DB, type Db } from "@userhq/db";
import { HealthResponseSchema, type HealthResponse } from "@userhq/types";
import { Public } from "../auth/decorators.js";

@Controller("health")
@Public()
@UseInterceptors(StandardSchemaSerializerInterceptor)
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  @SerializeOptions({ schema: HealthResponseSchema })
  async check(): Promise<HealthResponse> {
    try {
      await this.db.execute(sql`select 1`);
      return { status: "ok", db: "up" };
    } catch {
      throw new HttpException(
        { status: "error", db: "down" },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }
}
