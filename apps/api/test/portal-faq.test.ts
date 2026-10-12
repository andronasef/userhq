import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { schema } from "@userhq/db";
import { generateKeyBetween } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("Public Portal FAQ API (Plan 05-02 Task 2)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let adminUser: { cookie: string; userId: string };
  let wsSlug: string;
  let wsId: string;
  let prodSlug: string;
  let prodId: string;

  const validAnswer = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Answer content for public portal." }],
      },
    ],
  };

  beforeAll(async () => {
    testApp = await createTestApp();

    adminUser = await signedInCookie(testApp.test, {
      name: "Portal FAQ Admin",
      email: "portal-admin@faq.test",
      emailVerified: true,
    });

    wsSlug = "ws-portal-faq";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "Portal FAQ Workspace",
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: ws.id,
      userId: adminUser.userId,
      role: "owner",
    });

    prodSlug = "portal-faq-prod";
    const [prod] = await testApp.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: prodSlug,
        name: "Portal FAQ Product",
      })
      .returning();
    prodId = prod.id;

    // Seed 2 categories with ranks
    const rank1 = generateKeyBetween(null, null);
    const rank2 = generateKeyBetween(rank1, null);

    const [cat1] = await testApp.db
      .insert(schema.faqCategories)
      .values({
        productId: prodId,
        name: "General Questions",
        rank: rank1,
      })
      .returning();

    const [cat2] = await testApp.db
      .insert(schema.faqCategories)
      .values({
        productId: prodId,
        name: "Billing FAQ",
        rank: rank2,
      })
      .returning();

    // Seed questions in cat1
    const qRank1 = generateKeyBetween(null, null);
    const qRank2 = generateKeyBetween(qRank1, null);

    await testApp.db.insert(schema.faqQuestions).values([
      {
        productId: prodId,
        categoryId: cat1.id,
        question: "What is UserHQ?",
        answer: validAnswer,
        rank: qRank1,
      },
      {
        productId: prodId,
        categoryId: cat1.id,
        question: "How do I sign up?",
        answer: validAnswer,
        rank: qRank2,
      },
    ]);

    // Seed question in cat2
    await testApp.db.insert(schema.faqQuestions).values({
      productId: prodId,
      categoryId: cat2.id,
      question: "Do you offer refunds?",
      answer: validAnswer,
      rank: generateKeyBetween(null, null),
    });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("returns public categories and questions ordered by rank asc (FAQ-06)", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/faq`);

    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(2);

    // 1st category
    expect(res.body.categories[0].name).toBe("General Questions");
    expect(res.body.categories[0].questions).toHaveLength(2);
    expect(res.body.categories[0].questions[0].question).toBe("What is UserHQ?");
    expect(res.body.categories[0].questions[1].question).toBe("How do I sign up?");
    expect(res.body.categories[0].questions[0].answer).toEqual(validAnswer);

    // 2nd category
    expect(res.body.categories[1].name).toBe("Billing FAQ");
    expect(res.body.categories[1].questions).toHaveLength(1);
    expect(res.body.categories[1].questions[0].question).toBe("Do you offer refunds?");
  });

  it("returns 404 for non-existent workspace or product", async () => {
    const res = await request(testApp.http)
      .get(`/api/v1/portal/nonexistent-workspace/${prodSlug}/faq`);

    expect(res.status).toBe(404);
  });

  it("returns 403 when workspace is suspended", async () => {
    await testApp.db
      .update(schema.workspaces)
      .set({ suspendedAt: new Date() })
      .where(eq(schema.workspaces.id, wsId));

    const res = await request(testApp.http)
      .get(`/api/v1/portal/${wsSlug}/${prodSlug}/faq`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("workspace_suspended");

    // Revert suspension
    await testApp.db
      .update(schema.workspaces)
      .set({ suspendedAt: null })
      .where(eq(schema.workspaces.id, wsId));
  });
});
