import { Controller, Get, HttpException, HttpStatus, Inject } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DB, type Db } from "@userhq/db";
import { Public } from "../auth/decorators.js";

@Controller("health")
@Public()
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  async check() {
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
