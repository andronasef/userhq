import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { schema } from "@userhq/db";
import { generateKeyBetween } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";

describe("FAQ Admin API & LexoRank Reordering (Plan 05-02 Task 2)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let ownerUser: { cookie: string; userId: string };
  let otherUser: { cookie: string; userId: string };
  let wsSlug: string;
  let wsId: string;
  let prodSlug: string;

  const validAnswer = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: "Here is the comprehensive answer text." }],
      },
    ],
  };

  beforeAll(async () => {
    testApp = await createTestApp({
      PLATFORM_OWNER_EMAIL: "owner@faq.test",
    });

    ownerUser = await signedInCookie(testApp.test, {
      name: "FAQ Admin",
      email: "owner@faq.test",
      emailVerified: true,
    });

    otherUser = await signedInCookie(testApp.test, {
      name: "Other Tenant Admin",
      email: "other@faq.test",
      emailVerified: true,
    });

    wsSlug = "ws-faq-test";
    const [ws] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: "FAQ Workspace",
      })
      .returning();
    wsId = ws.id;

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: wsId,
      userId: ownerUser.userId,
      role: "owner",
    });

    prodSlug = "faq-product";
    await testApp.db.insert(schema.products).values({
      workspaceId: wsId,
      slug: prodSlug,
      name: "FAQ Product",
    });

    const [otherWs] = await testApp.db
      .insert(schema.workspaces)
      .values({
        slug: "ws-other-faq",
        name: "Other FAQ Workspace",
      })
      .returning();

    await testApp.db.insert(schema.workspaceMembers).values({
      workspaceId: otherWs.id,
      userId: otherUser.userId,
      role: "owner",
    });
  });

  afterAll(async () => {
    await testApp.close();
  });

  it("supports category CRUD and enforces uniqueness per product", async () => {
    // 1. Create Category
    const createRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/categories`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Billing & Plans" });

    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe("Billing & Plans");
    expect(createRes.body.rank).toBeDefined();
    expect(createRes.body.questions).toEqual([]);
    const categoryId = createRes.body.id;

    // 2. Reject duplicate category name (case-insensitive)
    const dupRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/categories`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "billing & plans" });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.code).toBe("category_name_taken");

    // 3. Update category name
    const updateRes = await request(testApp.http)
      .patch(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/categories/${categoryId}`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Billing & Invoicing" });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe("Billing & Invoicing");

    // 4. List categories
    const listRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/categories`)
      .set("Cookie", ownerUser.cookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(categoryId);

    // 5. Delete category
    const delRes = await request(testApp.http)
      .delete(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/categories/${categoryId}`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(delRes.status).toBe(204);
  });

  it("supports question CRUD, validation, and category cascading", async () => {
    // Create parent category
    const catRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/categories`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ name: "Account Management" });
    const categoryId = catRes.body.id;

    // 1. Create question
    const qRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/questions`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        categoryId,
        question: "How do I reset my password?",
        answer: validAnswer,
      });

    expect(qRes.status).toBe(201);
    expect(qRes.body.question).toBe("How do I reset my password?");
    expect(qRes.body.categoryId).toBe(categoryId);
    expect(qRes.body.rank).toBeDefined();
    const questionId = qRes.body.id;

    // 2. Reject create question with non-existent category
    const badCatRes = await request(testApp.http)
      .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/questions`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        categoryId: "00000000-0000-0000-0000-000000000000",
        question: "Does this fail gracefully?",
        answer: validAnswer,
      });

    expect(badCatRes.status).toBe(404);
    expect(badCatRes.body.code).toBe("category_not_found");

    // 3. Update question
    const updateQRes = await request(testApp.http)
      .patch(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/questions/${questionId}`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({
        question: "How do I securely reset my password?",
      });

    expect(updateQRes.status).toBe(200);
    expect(updateQRes.body.question).toBe("How do I securely reset my password?");

    // 4. Verify admin tree shows category with question
    const treeRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq`)
      .set("Cookie", ownerUser.cookie);

    expect(treeRes.status).toBe(200);
    const catInTree = treeRes.body.categories.find((c: any) => c.id === categoryId);
    expect(catInTree).toBeDefined();
    expect(catInTree.questions).toHaveLength(1);
    expect(catInTree.questions[0].id).toBe(questionId);

    // 5. Delete category cascades and removes questions
    const delCatRes = await request(testApp.http)
      .delete(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/categories/${categoryId}`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);

    expect(delCatRes.status).toBe(204);

    // Verify question is deleted from database
    const questionsInDb = await testApp.db
      .select()
      .from(schema.faqQuestions)
      .where(eq(schema.faqQuestions.id, questionId));
    expect(questionsInDb).toHaveLength(0);
  });

  it("reorders categories using LexoRank (FAQ-04)", async () => {
    // Create Cat A, Cat B, Cat C
    const catA = (
      await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/categories`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Category A" })
    ).body;

    const catB = (
      await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/categories`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Category B" })
    ).body;

    const catC = (
      await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/categories`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ name: "Category C" })
    ).body;

    // Initial order: [A, B, C]
    expect(catA.rank < catB.rank).toBe(true);
    expect(catB.rank < catC.rank).toBe(true);

    // Move C to be before A: targetRank = generateKeyBetween(null, catA.rank)
    const newRankC = generateKeyBetween(null, catA.rank);
    const reorderRes = await request(testApp.http)
      .patch(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/categories/${catC.id}/reorder`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ targetRank: newRankC });

    expect(reorderRes.status).toBe(200);
    expect(reorderRes.body.success).toBe(true);
    expect(reorderRes.body.rank).toBe(newRankC);

    // Fetch updated tree: order should now be [C, A, B]
    const treeRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq`)
      .set("Cookie", ownerUser.cookie);

    const categoryNames = treeRes.body.categories.map((c: any) => c.name);
    expect(categoryNames).toEqual(["Category C", "Category A", "Category B"]);
  });

  it("reorders questions within and across categories (FAQ-05)", async () => {
    // Fetch categories
    const listRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/categories`)
      .set("Cookie", ownerUser.cookie);

    const catC = listRes.body.find((c: any) => c.name === "Category C");
    const catA = listRes.body.find((c: any) => c.name === "Category A");

    // Create 3 questions in Cat C: Q1, Q2, Q3
    const q1 = (
      await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/questions`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ categoryId: catC.id, question: "Question 1 in C", answer: validAnswer })
    ).body;

    const q2 = (
      await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/questions`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ categoryId: catC.id, question: "Question 2 in C", answer: validAnswer })
    ).body;

    const q3 = (
      await request(testApp.http)
        .post(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/questions`)
        .set("Cookie", ownerUser.cookie)
        .set("Origin", testApp.env.PUBLIC_URL)
        .send({ categoryId: catC.id, question: "Question 3 in C", answer: validAnswer })
    ).body;

    // 1. Reorder within category: Move Q3 before Q1
    const newRankQ3 = generateKeyBetween(null, q1.rank);
    const reorderQRes = await request(testApp.http)
      .patch(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/questions/${q3.id}/reorder`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ targetRank: newRankQ3 });

    expect(reorderQRes.status).toBe(200);
    expect(reorderQRes.body.success).toBe(true);

    const tree1 = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq`)
      .set("Cookie", ownerUser.cookie);

    const cQuestions = tree1.body.categories.find((c: any) => c.id === catC.id).questions;
    expect(cQuestions.map((q: any) => q.id)).toEqual([q3.id, q1.id, q2.id]);

    // 2. Reorder across categories: Move Q1 from Cat C to Cat A
    const newRankQ1 = generateKeyBetween(null, null);
    const crossCatRes = await request(testApp.http)
      .patch(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/questions/${q1.id}/reorder`)
      .set("Cookie", ownerUser.cookie)
      .set("Origin", testApp.env.PUBLIC_URL)
      .send({ targetRank: newRankQ1, targetCategoryId: catA.id });

    expect(crossCatRes.status).toBe(200);
    expect(crossCatRes.body.success).toBe(true);
    expect(crossCatRes.body.categoryId).toBe(catA.id);

    const tree2 = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq`)
      .set("Cookie", ownerUser.cookie);

    const cQuestionsAfter = tree2.body.categories.find((c: any) => c.id === catC.id).questions;
    const aQuestionsAfter = tree2.body.categories.find((c: any) => c.id === catA.id).questions;

    expect(cQuestionsAfter.map((q: any) => q.id)).toEqual([q3.id, q2.id]);
    expect(aQuestionsAfter.map((q: any) => q.id)).toEqual([q1.id]);
  });

  it("enforces tenant isolation: another workspace user cannot access or modify FAQ", async () => {
    const listRes = await request(testApp.http)
      .get(`/api/v1/workspaces/${wsSlug}/products/${prodSlug}/faq/categories`)
      .set("Cookie", otherUser.cookie);

    expect(listRes.status).toBe(404);
  });
});
