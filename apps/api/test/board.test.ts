import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { schema } from "@userhq/db";
import { SEEDED_STATUSES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { prefixTsQuery } from "../src/feedback/search.js";

describe("Board Search, Filters, and Ranking (Plan 03-07)", () => {
  describe("prefixTsQuery unit tests", () => {
    it("converts single token to prefix query", () => {
      expect(prefixTsQuery("dar")).toBe("dar:*");
    });

    it("joins multiple tokens with stem AND prefix on last word", () => {
      expect(prefixTsQuery("exporting csv")).toBe("exporting & csv:*");
    });

    it("strips special syntax, quotes, operators, and parenthesis", () => {
      expect(prefixTsQuery('"unterminated - OR ) ( :* & |')).toBe(
        "unterminated & or:*"
      );
    });

    it("returns null for whitespace or empty query", () => {
      expect(prefixTsQuery("")).toBeNull();
      expect(prefixTsQuery("   ")).toBeNull();
      expect(prefixTsQuery("!@#$%^&*()")).toBeNull();
    });

    it("preserves non-Latin Unicode words case-folded", () => {
      expect(prefixTsQuery("Привет мир")).toBe("привет & мир:*");
    });
  });

  describe("Board API integration tests", () => {
    let testApp: Awaited<ReturnType<typeof createTestApp>>;
    let authorUser: { cookie: string; userId: string };
    let wsSlug: string;
    let wsId: string;
    let prodSlug: string;
    let prodId: string;
    let featureCatId: string;
    let bugCatId: string;
    let underReviewStatusId: string;
    let completedStatusId: string;

    beforeAll(async () => {
      testApp = await createTestApp();

      authorUser = await signedInCookie(testApp.test, {
        name: "Board Tester",
        email: "author@board.test",
        emailVerified: true,
      });

      wsSlug = `ws-board-${Date.now()}`;
      const [ws] = await testApp.db
        .insert(schema.workspaces)
        .values({
          slug: wsSlug,
          name: "Board Workspace",
        })
        .returning();
      wsId = ws.id;

      await testApp.db.insert(schema.workspaceMembers).values({
        workspaceId: wsId,
        userId: authorUser.userId,
        role: "owner",
      });

      prodSlug = "board-prod";
      const [prod] = await testApp.db
        .insert(schema.products)
        .values({
          workspaceId: wsId,
          slug: prodSlug,
          name: "Board Product",
          accentColor: "#2563EB",
        })
        .returning();
      prodId = prod.id;

      // Seed statuses
      const insertedStatuses = await testApp.db
        .insert(schema.statuses)
        .values(
          SEEDED_STATUSES.map((s, idx) => ({
            productId: prodId,
            name: s.name,
            type: s.type,
            color: s.color,
            position: idx,
            isDefault: s.type === "review",
          }))
        )
        .returning();

      underReviewStatusId = insertedStatuses.find(
        (s) => s.type === "review"
      )!.id;
      completedStatusId = insertedStatuses.find(
        (s) => s.type === "completed"
      )!.id;

      // Seed categories
      const [featCat] = await testApp.db
        .insert(schema.categories)
        .values({
          productId: prodId,
          name: "Feature Request",
        })
        .returning();
      featureCatId = featCat.id;

      const [bCat] = await testApp.db
        .insert(schema.categories)
        .values({
          productId: prodId,
          name: "Bug",
        })
        .returning();
      bugCatId = bCat.id;

      // Create posts:
      // Post 1: "Dark mode" (description: "Enable dark theme", category: Feature Request, status: underReview)
      // Post 2: "Export to CSV" (description: "Exporting is slow and tedious", category: Feature Request, status: underReview)
      // Post 3: "Only Title Bug" (description: null, category: Bug, status: underReview)
      // Post 4: "Completed Feature" (description: "All done", category: Feature Request, status: completed)
      // Post 5: "Widget Maker" (description: null, category: Feature Request, status: underReview, votes: 1)
      // Post 6: "Something else entirely" (description: "Use the widget maker tool", category: Feature Request, status: underReview, votes: 5)
      const insertPost = async (
        number: number,
        title: string,
        desc: string | null,
        catId: string,
        statusId: string,
        voteCount = 1
      ) => {
        const [post] = await testApp.db
          .insert(schema.posts)
          .values({
            productId: prodId,
            number,
            title,
            description: desc,
            categoryId: catId,
            statusId,
            authorId: authorUser.userId,
            voteCount,
          })
          .returning();
        return post;
      };

      await insertPost(
        1,
        "Dark mode",
        "Enable dark theme",
        featureCatId,
        underReviewStatusId
      );
      await insertPost(
        2,
        "Export to CSV",
        "Exporting is slow and tedious",
        featureCatId,
        underReviewStatusId
      );
      await insertPost(
        3,
        "Unique Bug",
        null,
        bugCatId,
        underReviewStatusId
      );
      await insertPost(
        4,
        "Completed Feature",
        "All done",
        featureCatId,
        completedStatusId
      );
      await insertPost(
        5,
        "Widget Maker",
        null,
        featureCatId,
        underReviewStatusId,
        1
      );
      await insertPost(
        6,
        "Something else entirely",
        "Use the widget maker tool",
        featureCatId,
        underReviewStatusId,
        5
      );
    });

    afterAll(async () => {
      await testApp.close();
    });

    it("asserts q=dar finds only Dark mode", async () => {
      const res = await request(testApp.http)
        .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts?q=dar`)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.posts[0].title).toBe("Dark mode");
    });

    it('asserts q="exporting csv" finds Export to CSV', async () => {
      const res = await request(testApp.http)
        .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts?q=exporting%20csv`)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.posts[0].title).toBe("Export to CSV");
    });

    it("asserts a search of only stop words returns empty posts array and no error", async () => {
      const res = await request(testApp.http)
        .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts?q=the`)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(200);
      expect(res.body.posts).toEqual([]);
      expect(res.body.nextCursor).toBeNull();
    });

    it("asserts title-only post (null details) is found by a title word", async () => {
      const res = await request(testApp.http)
        .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts?q=unique`)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(200);
      expect(res.body.posts).toHaveLength(1);
      expect(res.body.posts[0].title).toBe("Unique Bug");
    });

    it("asserts title hit outranks description-only hit under sort match", async () => {
      const res = await request(testApp.http)
        .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts?q=widget&sort=match`)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(200);
      expect(res.body.posts.length).toBeGreaterThanOrEqual(2);
      // Widget Maker has title match ('A' weight) while Something else entirely has description match ('B' weight)
      // Even though Something else has 5 votes and Widget Maker has 1 vote, title rank outranks description!
      expect(res.body.posts[0].title).toBe("Widget Maker");
      expect(res.body.posts[1].title).toBe("Something else entirely");
    });

    it("asserts status filtering: open by default, all shows completed, specific status id shows only that status", async () => {
      // Default (no status param) hides Completed Feature
      const openRes = await request(testApp.http)
        .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts`)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(openRes.status).toBe(200);
      const openTitles = openRes.body.posts.map((p: any) => p.title);
      expect(openTitles).not.toContain("Completed Feature");

      // status=all includes Completed Feature
      const allRes = await request(testApp.http)
        .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts?status=all`)
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(allRes.status).toBe(200);
      const allTitles = allRes.body.posts.map((p: any) => p.title);
      expect(allTitles).toContain("Completed Feature");

      // status={completedStatusId} returns only Completed Feature
      const completedRes = await request(testApp.http)
        .get(
          `/api/v1/portal/${wsSlug}/${prodSlug}/posts?status=${completedStatusId}`
        )
        .set("Origin", testApp.env.PUBLIC_URL);
      expect(completedRes.status).toBe(200);
      expect(completedRes.body.posts).toHaveLength(1);
      expect(completedRes.body.posts[0].title).toBe("Completed Feature");
    });

    it("asserts category filter returns only that category's posts", async () => {
      const catRes = await request(testApp.http)
        .get(
          `/api/v1/portal/${wsSlug}/${prodSlug}/posts?category=${bugCatId}`
        )
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(catRes.status).toBe(200);
      expect(catRes.body.posts).toHaveLength(1);
      expect(catRes.body.posts[0].title).toBe("Unique Bug");
    });

    it("asserts q over 100 characters returns 400 validation_failed", async () => {
      const longQ = "a".repeat(101);
      const res = await request(testApp.http)
        .get(`/api/v1/portal/${wsSlug}/${prodSlug}/posts?q=${longQ}`)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("validation_failed");
    });

    it("asserts GET /portal/:ws/:product returns statuses in position order with id, name, color, type", async () => {
      const res = await request(testApp.http)
        .get(`/api/v1/portal/${wsSlug}/${prodSlug}`)
        .set("Origin", testApp.env.PUBLIC_URL);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.statuses)).toBe(true);
      expect(res.body.statuses.length).toBe(SEEDED_STATUSES.length);
      for (const s of res.body.statuses) {
        expect(s).toHaveProperty("id");
        expect(s).toHaveProperty("name");
        expect(s).toHaveProperty("color");
        expect(s).toHaveProperty("type");
      }
      expect(res.body.statuses[0].name).toBe("Under Review");
    });
  });
});
