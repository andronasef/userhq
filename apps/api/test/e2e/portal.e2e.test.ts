import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { createDb, schema } from "@userhq/db";
import { eq } from "drizzle-orm";

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:8080";
const databaseUrl = process.env.E2E_DATABASE_URL!;

function countOccurrences(str: string, substr: string): number {
  return str.split(substr).length - 1;
}

describe("Portal E2E (Plan 02-02)", () => {
  let dbInstance: ReturnType<typeof createDb>;
  let wsSlug: string;
  let pSlug: string;
  let pName: string;
  let wsId: string;
  let prodId: string;

  let suspendedWsSlug: string;
  let suspendedProdSlug: string;
  let suspendedProdName: string;
  let suspendedWsId: string;
  let suspendedProdId: string;

  let deletedProdSlug: string;
  let deletedProdId: string;

  beforeAll(async () => {
    dbInstance = createDb(databaseUrl);

    const rand = randomBytes(4).toString("hex");
    wsSlug = `ws-${rand}`;
    pSlug = `prod-${rand}`;
    pName = `Product ${rand}`;

    const [ws] = await dbInstance.db
      .insert(schema.workspaces)
      .values({
        slug: wsSlug,
        name: `Acme ${rand}`,
      })
      .returning();
    wsId = ws.id;

    const [prod] = await dbInstance.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: pSlug,
        name: pName,
      })
      .returning();
    prodId = prod.id;

    // Soft-deleted product
    deletedProdSlug = `del-${rand}`;
    const [delProd] = await dbInstance.db
      .insert(schema.products)
      .values({
        workspaceId: ws.id,
        slug: deletedProdSlug,
        name: `Deleted ${rand}`,
        deletedAt: new Date(),
      })
      .returning();
    deletedProdId = delProd.id;

    // Suspended workspace
    const sRand = randomBytes(4).toString("hex");
    suspendedWsSlug = `sus-ws-${sRand}`;
    suspendedProdSlug = `sus-prod-${sRand}`;
    suspendedProdName = `SuspendedProduct ${sRand}`;

    const [susWs] = await dbInstance.db
      .insert(schema.workspaces)
      .values({
        slug: suspendedWsSlug,
        name: `Suspended Acme ${sRand}`,
        suspendedAt: new Date(),
      })
      .returning();
    suspendedWsId = susWs.id;

    const [susProd] = await dbInstance.db
      .insert(schema.products)
      .values({
        workspaceId: susWs.id,
        slug: suspendedProdSlug,
        name: suspendedProdName,
      })
      .returning();
    suspendedProdId = susProd.id;
  });

  afterAll(async () => {
    if (dbInstance) {
      if (prodId) {
        await dbInstance.db
          .delete(schema.products)
          .where(eq(schema.products.id, prodId));
      }
      if (deletedProdId) {
        await dbInstance.db
          .delete(schema.products)
          .where(eq(schema.products.id, deletedProdId));
      }
      if (wsId) {
        await dbInstance.db
          .delete(schema.workspaces)
          .where(eq(schema.workspaces.id, wsId));
      }
      if (suspendedProdId) {
        await dbInstance.db
          .delete(schema.products)
          .where(eq(schema.products.id, suspendedProdId));
      }
      if (suspendedWsId) {
        await dbInstance.db
          .delete(schema.workspaces)
          .where(eq(schema.workspaces.id, suspendedWsId));
      }
      if (dbInstance.pool) {
        await dbInstance.pool.end();
      }
    }
  });

  it("signed-out visitor opens /{ws}/{product} and gets portal shell", async () => {
    const res = await fetch(`${baseUrl}/${wsSlug}/${pSlug}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain(pName);
    expect(html).toContain("is getting set up");
    expect(html).toMatch(/Powered by.*UserHQ/);
    expect(countOccurrences(html, 'data-shell="portal"')).toBe(1);
    expect(countOccurrences(html, 'data-shell="app"')).toBe(0);
  });

  it("unknown product returns 404 containing Page not found", async () => {
    const res = await fetch(`${baseUrl}/${wsSlug}/no-such-product`);
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("Page not found");
    expect(countOccurrences(html, 'data-shell="app"')).toBe(1);
    expect(countOccurrences(html, 'data-shell="portal"')).toBe(0);
  });

  it("soft-deleted product returns 404 containing Page not found", async () => {
    const res = await fetch(`${baseUrl}/${wsSlug}/${deletedProdSlug}`);
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("Page not found");
    expect(countOccurrences(html, 'data-shell="app"')).toBe(1);
    expect(countOccurrences(html, 'data-shell="portal"')).toBe(0);
  });

  it("suspended workspace renders This page is unavailable with no branding", async () => {
    const res = await fetch(`${baseUrl}/${suspendedWsSlug}/${suspendedProdSlug}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("This page is unavailable");
    expect(html).toContain("This portal isn&#x27;t available right now. Check back later.");
    expect(html).not.toContain(suspendedProdName);
    expect(countOccurrences(html, 'data-shell="app"')).toBe(1);
    expect(countOccurrences(html, 'data-shell="portal"')).toBe(0);
  });

  it("static /login route beats dynamic [ws]", async () => {
    const res = await fetch(`${baseUrl}/login`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Sign in to UserHQ");
    expect(countOccurrences(html, 'data-shell="app"')).toBe(1);
    expect(countOccurrences(html, 'data-shell="portal"')).toBe(0);
  });

  describe("Directory /{ws} (Plan 02-10)", () => {
    let dirWsSlug: string;
    let dirWsId: string;
    let prod1Slug: string;
    let prod1Name: string;
    let prod2Slug: string;
    let prod2Name: string;

    let singleWsSlug: string;
    let singleWsId: string;
    let singleProdSlug: string;

    let emptyWsSlug: string;
    let emptyWsId: string;

    let disabledWsSlug: string;
    let disabledWsId: string;

    beforeAll(async () => {
      const rand1 = randomBytes(4).toString("hex");
      dirWsSlug = `dir-e2e-${rand1}`;
      const [w1] = await dbInstance.db
        .insert(schema.workspaces)
        .values({
          slug: dirWsSlug,
          name: `Directory WS ${rand1}`,
          directoryEnabled: true,
        })
        .returning();
      dirWsId = w1.id;

      prod1Slug = `p1-${rand1}`;
      prod1Name = `Alpha Product ${rand1}`;
      prod2Slug = `p2-${rand1}`;
      prod2Name = `Beta Product ${rand1}`;

      await dbInstance.db.insert(schema.products).values([
        {
          workspaceId: w1.id,
          slug: prod1Slug,
          name: prod1Name,
          tagline: "Alpha tagline",
        },
        {
          workspaceId: w1.id,
          slug: prod2Slug,
          name: prod2Name,
          tagline: "Beta tagline",
        },
      ]);

      // Single product workspace
      const rand2 = randomBytes(4).toString("hex");
      singleWsSlug = `single-e2e-${rand2}`;
      singleProdSlug = `only-prod-${rand2}`;
      const [w2] = await dbInstance.db
        .insert(schema.workspaces)
        .values({
          slug: singleWsSlug,
          name: `Single WS ${rand2}`,
          directoryEnabled: true,
        })
        .returning();
      singleWsId = w2.id;

      await dbInstance.db.insert(schema.products).values({
        workspaceId: w2.id,
        slug: singleProdSlug,
        name: `Single Product ${rand2}`,
      });

      // Zero products workspace
      const rand3 = randomBytes(4).toString("hex");
      emptyWsSlug = `empty-e2e-${rand3}`;
      const [w3] = await dbInstance.db
        .insert(schema.workspaces)
        .values({
          slug: emptyWsSlug,
          name: `Empty WS ${rand3}`,
          directoryEnabled: true,
        })
        .returning();
      emptyWsId = w3.id;

      // Disabled directory with website
      const rand4 = randomBytes(4).toString("hex");
      disabledWsSlug = `disabled-e2e-${rand4}`;
      const [w4] = await dbInstance.db
        .insert(schema.workspaces)
        .values({
          slug: disabledWsSlug,
          name: `Disabled WS ${rand4}`,
          directoryEnabled: false,
          websiteUrl: "https://example.com/company",
        })
        .returning();
      disabledWsId = w4.id;
    });

    afterAll(async () => {
      const wsIds = [dirWsId, singleWsId, emptyWsId, disabledWsId].filter(Boolean);
      for (const wid of wsIds) {
        await dbInstance.db
          .delete(schema.statuses)
          .where(eq(schema.statuses.productId, prodId));
        await dbInstance.db
          .delete(schema.products)
          .where(eq(schema.products.workspaceId, wid));
        await dbInstance.db
          .delete(schema.workspaces)
          .where(eq(schema.workspaces.id, wid));
      }
    });

    it("workspace with 2 live products renders directory card grid containing both names", async () => {
      const res = await fetch(`${baseUrl}/${dirWsSlug}`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain(prod1Name);
      expect(html).toContain(prod2Name);
      expect(html).toContain("Alpha tagline");
      expect(html).toContain("Beta tagline");
    });

    it("workspace with 1 live product redirects (307) to that product portal", async () => {
      const res = await fetch(`${baseUrl}/${singleWsSlug}`, {
        redirect: "manual",
      });
      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toBe(`/${singleWsSlug}/${singleProdSlug}`);
    });

    it("workspace with 0 products renders empty state 'hasn't published any products'", async () => {
      const res = await fetch(`${baseUrl}/${emptyWsSlug}`);
      expect(res.status).toBe(200);
      const html = await res.text();
      expect(html).toContain("No products yet");
      expect(html).toContain("hasn&#x27;t published any products");
    });

    it("workspace with directory disabled redirects to its websiteUrl", async () => {
      const res = await fetch(`${baseUrl}/${disabledWsSlug}`, {
        redirect: "manual",
      });
      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toBe("https://example.com/company");
    });
  });
});
