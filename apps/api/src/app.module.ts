import {
  Module,
  type OnApplicationShutdown,
  Injectable,
  Inject,
} from "@nestjs/common";
import { DB, createDb } from "@userhq/db";
import type pg from "pg";
import { HealthController } from "./health/health.controller.js";

const DB_POOL = Symbol.for("@userhq/api/db-pool");

@Injectable()
export class DbLifecycleService implements OnApplicationShutdown {
  constructor(@Inject(DB_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}

function getDbInstance() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("api: DATABASE_URL environment variable is required");
  }
  return createDb(databaseUrl);
}

const dbInstance = getDbInstance();

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: DB_POOL,
      useValue: dbInstance.pool,
    },
    {
      provide: DB,
      useValue: dbInstance.db,
    },
    DbLifecycleService,
  ],
  exports: [DB],
})
export class AppModule {}
