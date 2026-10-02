import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { createDb } from "@userhq/db";
import { loadEnv } from "./env.js";
import { createAuth } from "./auth/auth.js";
import { AppModule, configureApp } from "./app.module.js";
import { assertWritable } from "./uploads/storage.js";

async function bootstrap() {
  const env = loadEnv();
  const { db, pool } = createDb(env.DATABASE_URL);
  const auth = createAuth(db, env);

  try {
    await assertWritable(env.UPLOAD_DIR);
  } catch (err: any) {
    console.error(`uploads: ${err?.message || err}`);
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register({ env, db, pool, auth }),
    { bodyParser: false }
  );
  configureApp(app, env);

  await app.listen(env.PORT, "0.0.0.0");
  console.log(`api: listening on :${env.PORT}`);
}

bootstrap();
