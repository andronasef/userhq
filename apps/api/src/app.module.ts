import {
  Module,
  type DynamicModule,
  type OnApplicationShutdown,
  Injectable,
  Inject,
} from "@nestjs/common";
import { APP_GUARD, APP_FILTER, APP_PIPE } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import type pg from "pg";
import { AuthModule } from "@thallesp/nestjs-better-auth";
import { DB, type Db } from "@userhq/db";
import { ENV, type Env } from "./env.js";
import { AUTH, type Auth } from "./auth/auth.js";
import { HealthController } from "./health/health.controller.js";
import { MeController } from "./auth/me.controller.js";
import { OriginGuard, SessionGuard } from "./auth/guards.js";
import { ApiErrorFilter } from "./common/api-error.filter.js";
import { validationPipe } from "./common/validation.js";

import { UploadsModule } from "./uploads/uploads.module.js";
import { PortalModule } from "./portal/portal.module.js";
import { WorkspacesModule } from "./workspaces/workspaces.module.js";
import { InvitesModule } from "./invites/invites.module.js";
import { PlatformModule } from "./platform/platform.module.js";
import { ProductsModule } from "./products/products.module.js";
import { FeedbackModule } from "./feedback/feedback.module.js";

const DB_POOL = Symbol.for("@userhq/api/db-pool");

@Injectable()
export class DbLifecycleService implements OnApplicationShutdown {
  constructor(@Inject(DB_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}

@Module({})
export class AppModule {
  static register(deps: {
    env: Env;
    db: Db;
    pool: pg.Pool;
    auth: Auth;
  }): DynamicModule {
    return {
      module: AppModule,
      global: true,
      imports: [
        AuthModule.forRoot({
          auth: deps.auth,
          disableGlobalAuthGuard: true,
          bodyParser: {
            json: { limit: "100kb" },
          },
        }),
        UploadsModule,
        PortalModule,
        WorkspacesModule,
        InvitesModule,
        PlatformModule,
        ProductsModule,
        FeedbackModule,
      ],
      controllers: [HealthController, MeController],
      providers: [
        {
          provide: ENV,
          useValue: deps.env,
        },
        {
          provide: DB,
          useValue: deps.db,
        },
        {
          provide: DB_POOL,
          useValue: deps.pool,
        },
        {
          provide: AUTH,
          useValue: deps.auth,
        },
        DbLifecycleService,
        {
          provide: APP_GUARD,
          useClass: OriginGuard,
        },
        {
          provide: APP_GUARD,
          useClass: SessionGuard,
        },
        {
          provide: APP_PIPE,
          useValue: validationPipe,
        },
        {
          provide: APP_FILTER,
          useClass: ApiErrorFilter,
        },
      ],
      exports: [ENV, DB, AUTH],
    };
  }
}

export function configureApp(app: NestExpressApplication, env: Env): void {
  app.setGlobalPrefix("api/v1");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.enableShutdownHooks();

  app.useStaticAssets(env.UPLOAD_DIR, {
    prefix: "/uploads",
    immutable: true,
    maxAge: "365d",
    index: false,
    redirect: false,
    dotfiles: "deny",
    fallthrough: false,
    setHeaders: (res: any) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'");
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    },
  });
}
