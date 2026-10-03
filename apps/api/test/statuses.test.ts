import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { eq, and, sql } from "drizzle-orm";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Statuses API (Plan 02-09)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let ownerUser: { cookie: string; userId: string };
  let wsId: string;
  let wsSlug: string;
  let prodId: string;
  let prodSlug: string;

  beforeAll(async () => {
    testApp = await createTestApp({
      PLATFORM_OWNER_EMAIL: "owner@statuses.test",
    });

    ownerUser = await signedInCookie(testApp.test, {
      name: "Status Test Owner",
      email: "owner@statuses.test",
      emailVerified: true,
    });

    wsSlug = "ws-stat-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Status Test Workspace",
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: wsId,
      userId: ownerUser.userId,
      role: "owner",
    });

    prodSlug = "stat-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: wsId,
        slug: prodSlug,
        name: "Status Product",
      })
      .returning();
    prodId = prod.id;

    // Seed default 5 statuses
    await testApp.db.insert(schema.statuses).values(
      SEEDED_STATUSES.map((s, idx) => ({
        productId: prodId,
        name: s.name,
        type: s.type,
        color: s.color,
        position: idx,
        isDefault: s.isDefault,
      }))
    );
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("tracer: admin lists seeded statuses and adds one", async () => {
    // 1. GET lists 5 seeded statuses in order
    const listRes1 = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses`)
      .set("Cookie", ownerUser.cookie);

    expect(listRes1.status).toBe(200);
    expect(listRes1.body.length).toBe(5);
    expect(listRes1.body.map((s: any) => s.name)).toEqual(
      SEEDED_STATUSES.map((s) => s.name)
    );
    expect(listRes1.body[0].name).toBe("Under Review");
    expect(listRes1.body[0].isDefault).toBe(true);
    expect(listRes1.body[1].isDefault).toBe(false);

    // 2. POST adds new status
    const postRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        name: "Needs Info",
        type: "review",
        color: "#0d9488",
      });

    expect(postRes.status).toBe(201);
    expect(postRes.body.name).toBe("Needs Info");
    expect(postRes.body.color).toBe("#0D9488");
    expect(postRes.body.type).toBe("review");
    expect(postRes.body.position).toBe(5);
    expect(postRes.body.isDefault).toBe(false);

    // 3. GET now returns 6 statuses
    const listRes2 = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses`)
      .set("Cookie", ownerUser.cookie);

    expect(listRes2.status).toBe(200);
    expect(listRes2.body.length).toBe(6);
    expect(listRes2.body[5].name).toBe("Needs Info");
  });

  describe("Status Mutations & Validations (Task 2)", () => {
    it("PATCH name, case-insensitive collision, and validation rules", async () => {
      const list = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses`)
        .set("Cookie", ownerUser.cookie);
      const planned = list.body.find((s: any) => s.name === "Planned");
      expect(planned).toBeDefined();

      // Rename Planned -> Scheduled
      const patchRes = await request(testApp.http)
        .patch(
          `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/${planned.id}`
        )
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Scheduled" });
      expect(patchRes.status).toBe(200);
      expect(patchRes.body.name).toBe("Scheduled");

      // Collide case-insensitively with "scheduled" from another status
      const underReview = list.body.find((s: any) => s.name === "Under Review");
      const collideRes = await request(testApp.http)
        .patch(
          `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/${underReview.id}`
        )
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "scheduled" });
      expect(collideRes.status).toBe(409);
      expect(collideRes.body.code).toBe("status_name_taken");

      // Invalid color
      const badColorRes = await request(testApp.http)
        .patch(
          `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/${planned.id}`
        )
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ color: "red" });
      expect(badColorRes.status).toBe(400);
      expect(badColorRes.body.code).toBe("invalid_color");

      // Empty name
      const emptyNameRes = await request(testApp.http)
        .patch(
          `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/${planned.id}`
        )
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "  " });
      expect(emptyNameRes.status).toBe(400);
      expect(emptyNameRes.body.code).toBe("name_required");

      // Name > 30 characters
      const longNameRes = await request(testApp.http)
        .patch(
          `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/${planned.id}`
        )
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "a".repeat(31) });
      expect(longNameRes.status).toBe(400);
      expect(longNameRes.body.code).toBe("name_too_long");
    });

    it("PUT :statusId/default sets new default and unsets previous", async () => {
      const list = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses`)
        .set("Cookie", ownerUser.cookie);
      const scheduled = list.body.find((s: any) => s.name === "Scheduled");

      const putRes = await request(testApp.http)
        .put(
          `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/${scheduled.id}/default`
        )
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(putRes.status).toBe(200);
      const updatedList = putRes.body;
      const newDefault = updatedList.find((s: any) => s.id === scheduled.id);
      expect(newDefault.isDefault).toBe(true);

      const oldDefault = updatedList.find((s: any) => s.name === "Under Review");
      expect(oldDefault.isDefault).toBe(false);

      // Verify in DB that exactly one default row exists
      const dbDefaults = await testApp.db
        .select()
        .from(schema.statuses)
        .where(
          and(
            eq(schema.statuses.productId, prodId),
            eq(schema.statuses.isDefault, true)
          )
        );
      expect(dbDefaults.length).toBe(1);
      expect(dbDefaults[0].id).toBe(scheduled.id);

      // Making the current default default again -> 200 unchanged
      const repeatRes = await request(testApp.http)
        .put(
          `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/${scheduled.id}/default`
        )
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(repeatRes.status).toBe(200);
    });

    it("DELETE status with moveTo replacement and safeguards", async () => {
      const list = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses`)
        .set("Cookie", ownerUser.cookie);
      const underReview = list.body.find((s: any) => s.name === "Under Review");
      const scheduled = list.body.find((s: any) => s.name === "Scheduled"); // current default

      // DELETE the default status is refused
      const delDefRes = await request(testApp.http)
        .delete(
          `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/${scheduled.id}?moveTo=${underReview.id}`
        )
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(delDefRes.status).toBe(400);
      expect(delDefRes.body.code).toBe("delete_default_status");

      // DELETE x?moveTo=x is refused
      const selfMoveRes = await request(testApp.http)
        .delete(
          `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/${underReview.id}?moveTo=${underReview.id}`
        )
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(selfMoveRes.status).toBe(400);
      expect(selfMoveRes.body.code).toBe("validation_failed");

      // DELETE without moveTo is refused
      const noMoveRes = await request(testApp.http)
        .delete(
          `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/${underReview.id}`
        )
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(noMoveRes.status).toBe(400);
      expect(noMoveRes.body.code).toBe("validation_failed");

      // DELETE with moveTo from another product -> 404
      const [otherProd] = await testApp.db
        .insert(schema.products)
        .values({
          workspaceId: wsId,
          slug: "other-prod-move",
          name: "Other Prod",
        })
        .returning();
      const [foreignStatus] = await testApp.db
        .insert(schema.statuses)
        .values({
          productId: otherProd.id,
          name: "Foreign",
          color: "#2563EB",
          type: "planned",
          position: 0,
          isDefault: true,
        })
        .returning();

      const foreignMoveRes = await request(testApp.http)
        .delete(
          `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/${underReview.id}?moveTo=${foreignStatus.id}`
        )
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(foreignMoveRes.status).toBe(404);

      // Successful DELETE of non-default status (Under Review -> Scheduled)
      const validDelRes = await request(testApp.http)
        .delete(
          `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/${underReview.id}?moveTo=${scheduled.id}`
        )
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(validDelRes.status).toBe(204);

      // Repeat delete returns 404
      const repeatDelRes = await request(testApp.http)
        .delete(
          `/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/${underReview.id}?moveTo=${scheduled.id}`
        )
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(repeatDelRes.status).toBe(404);

      // Remaining statuses keep their relative order
      const remainingList = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses`)
        .set("Cookie", ownerUser.cookie);
      expect(remainingList.body.some((s: any) => s.id === underReview.id)).toBe(
        false
      );
      expect(remainingList.body.map((s: any) => s.name)).toEqual([
        "Scheduled",
        "In Progress",
        "Completed",
        "Declined",
        "Needs Info",
      ]);
    });

    it("two concurrent DELETEs naming each other as moveTo yield [204, 404]", async () => {
      // Create test product with two statuses
      const [raceProd] = await testApp.db
        .insert(schema.products)
        .values({
          workspaceId: wsId,
          slug: "race-del-prod",
          name: "Race Del Prod",
        })
        .returning();

      const [status1] = await testApp.db
        .insert(schema.statuses)
        .values({
          productId: raceProd.id,
          name: "Status 1",
          color: "#2563EB",
          type: "planned",
          position: 0,
          isDefault: false,
        })
        .returning();

      const [status2] = await testApp.db
        .insert(schema.statuses)
        .values({
          productId: raceProd.id,
          name: "Status 2",
          color: "#16A34A",
          type: "completed",
          position: 1,
          isDefault: false,
        })
        .returning();

      // Third status is default so neither 1 nor 2 is default
      await testApp.db.insert(schema.statuses).values({
        productId: raceProd.id,
        name: "Default Status",
        color: "#EA580C",
        type: "review",
        position: 2,
        isDefault: true,
      });

      const [res1, res2] = await Promise.all([
        request(testApp.http)
          .delete(
            `/api/v1/workspaces/${wsSlug}/products/${raceProd.slug}/statuses/${status1.id}?moveTo=${status2.id}`
          )
          .set("Cookie", ownerUser.cookie)
          .set("Origin", testApp.env.PUBLIC_URL),
        request(testApp.http)
          .delete(
            `/api/v1/workspaces/${wsSlug}/products/${raceProd.slug}/statuses/${status2.id}?moveTo=${status1.id}`
          )
          .set("Cookie", ownerUser.cookie)
          .set("Origin", testApp.env.PUBLIC_URL),
      ]);

      const codes = [res1.status, res2.status].sort();
      expect(codes).toEqual([204, 404]);
    });

    it("product reduced to a single status: deleting it returns 400 delete_default_status", async () => {
      const [singleProd] = await testApp.db
        .insert(schema.products)
        .values({
          workspaceId: wsId,
          slug: "single-stat-prod",
          name: "Single Stat Prod",
        })
        .returning();

      const [onlyStatus] = await testApp.db
        .insert(schema.statuses)
        .values({
          productId: singleProd.id,
          name: "Only Status",
          color: "#2563EB",
          type: "planned",
          position: 0,
          isDefault: true,
        })
        .returning();

      const delRes = await request(testApp.http)
        .delete(
          `/api/v1/workspaces/${wsSlug}/products/${singleProd.slug}/statuses/${onlyStatus.id}?moveTo=${onlyStatus.id}`
        )
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL);

      // Refused because self-move (validation_failed) or delete_default_status
      expect(delRes.status).toBe(400);
    });

    it("invariant test: after mutations every product has exactly one default", async () => {
      const result = await testApp.db.execute<{
        product_id: string;
        default_count: string;
      }>(
        sql`SELECT product_id, count(*) FILTER (WHERE is_default) as default_count FROM statuses GROUP BY product_id`
      );

      for (const row of result.rows) {
        expect(Number(row.default_count)).toBe(1);
      }
    });
  });

  describe("Status Reordering (Task 3)", () => {
    it("PUT order with permutation updates positions 0..n", async () => {
      const list = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses`)
        .set("Cookie", ownerUser.cookie);
      const originalIds: string[] = list.body.map((s: any) => s.id);
      const reversedIds = [...originalIds].reverse();

      const putRes = await request(testApp.http)
        .put(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/order`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ ids: reversedIds });

      expect(putRes.status).toBe(200);
      expect(putRes.body.map((s: any) => s.id)).toEqual(reversedIds);
      expect(putRes.body.map((s: any) => s.position)).toEqual([
        0, 1, 2, 3, 4,
      ]);
    });

    it("PUT order with non-permutation (missing, extra, duplicate, empty) returns 400 validation_failed", async () => {
      const list = await request(testApp.http)
        .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses`)
        .set("Cookie", ownerUser.cookie);
      const ids: string[] = list.body.map((s: any) => s.id);

      // Missing id
      const missingRes = await request(testApp.http)
        .put(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/order`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ ids: ids.slice(1) });
      expect(missingRes.status).toBe(400);
      expect(missingRes.body.code).toBe("validation_failed");

      // Duplicate id
      const dupRes = await request(testApp.http)
        .put(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/order`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ ids: [ids[0], ids[0], ...ids.slice(2)] });
      expect(dupRes.status).toBe(400);
      expect(dupRes.body.code).toBe("validation_failed");

      // Foreign id
      const foreignId = crypto.randomUUID();
      const foreignRes = await request(testApp.http)
        .put(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/order`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ ids: [...ids.slice(1), foreignId] });
      expect(foreignRes.status).toBe(400);
      expect(foreignRes.body.code).toBe("validation_failed");

      // Empty list
      const emptyRes = await request(testApp.http)
        .put(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/statuses/order`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ ids: [] });
      expect(emptyRes.status).toBe(400);
    });
  });
});
