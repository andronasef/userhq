import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { createDb, runMigrations, schema } from "../../../packages/db/dist/index.js";
const require = createRequire(new URL("../../../apps/api/package.json", import.meta.url));
const pg = require("pg");
const name = `userhq_analytics_report_${Date.now()}`;
const admin = new pg.Client({ connectionString: "postgres://userhq:userhq@127.0.0.1:5432/postgres" });
await admin.connect(); await admin.query(`CREATE DATABASE ${name}`);
let pool;
try {
  const url = `postgres://userhq:userhq@127.0.0.1:5432/${name}`;
  await runMigrations({ connectionString: url });
  const connection = createDb(url); pool = connection.pool; pool.on("error", error => console.error("fixture pool:", error.code)); const db = connection.db;
  await db.insert(schema.user).values([{ id: "operator", name: "Synthetic admin", email: "admin@fixture.invalid" }, { id: "customer", name: "Synthetic customer", email: "customer@fixture.invalid" }]);
  const workspaceIds = [randomUUID(), randomUUID()]; const productIds = [randomUUID(), randomUUID()]; const statusIds = [randomUUID(), randomUUID()];
  for (let i = 0; i < 2; i++) {
    await db.insert(schema.workspaces).values({ id: workspaceIds[i], name: "Fixture", slug: `fixture-${i}` });
    await db.insert(schema.workspaceMembers).values({ workspaceId: workspaceIds[i], userId: "operator", role: "owner" });
    await db.insert(schema.products).values({ id: productIds[i], workspaceId: workspaceIds[i], name: "Fixture", slug: "core", accentColor: "#000000" });
    await db.insert(schema.statuses).values({ id: statusIds[i], productId: productIds[i], name: "Open", type: "review", position: 0, color: "#888888" });
  }
  const time = new Date(Date.now() - 7200000); const reply = new Date(time.getTime() + 3600000);
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  await db.insert(schema.posts).values([
    { id: ids[0], productId: productIds[0], number: 1, title: "Unanswered", authorId: "customer", statusId: statusIds[0], createdAt: time },
    { id: ids[1], productId: productIds[0], number: 2, title: "Answered", authorId: "customer", statusId: statusIds[0], createdAt: time },
    { id: ids[2], productId: productIds[1], number: 1, title: "Team post", authorId: "operator", statusId: statusIds[1], createdAt: time },
  ]);
  await db.insert(schema.votes).values({ postId: ids[2], userId: "customer", createdAt: time });
  await db.insert(schema.comments).values([
    { postId: ids[1], authorId: "operator", isAdmin: true, body: "Synthetic reply", createdAt: reply },
    { postId: ids[2], authorId: "operator", isAdmin: true, body: "Synthetic reply", createdAt: reply },
  ]);
  const result = spawnSync(process.execPath, ["apps/api/dist/scripts/analytics-report.js"], { env: { ...process.env, DATABASE_URL: url, NEW_RELIC_ENABLED: "false" }, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr); const report = JSON.parse(result.stdout);
  assert.equal(report.external_requests, 2); assert.equal(report.unanswered_requests, 1); assert.equal(report.acknowledged_requests, 1);
  assert.equal(report.median_response_hours, 1); assert.equal(report.activated_workspaces, 2); assert.equal(report.workspaces_with_external_contribution, 2);
  console.log("PASS: unanswered denominator, exact response duration and vote-only workspace activation");
} catch (error) { console.error("fixture failure:", error.message); throw error; }
finally { if (pool) await pool.end(); await admin.query(`DROP DATABASE ${name}`); await admin.end(); }
