import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { schema } from "@userhq/db";
import { API_KEY_SCOPES } from "@userhq/types";
import { createTestApp, signedInCookie } from "./support/test-app.js";
import { startReceiver, receiverNetwork } from "./support/webhook-receiver.js";
import { verifyWebhookSignature } from "../src/webhooks/signature.js";
import { WebhookWorker } from "../src/webhooks/webhook.worker.js";

const SECRET_RE = /^whsec_[A-Za-z0-9_-]+$/;

describe("Webhook signing secret: shown once, rotated by sessions only (quick-261107-s6l)", () => {
  let testApp: Awaited<ReturnType<typeof createTestApp>>;
  let receiver: Awaited<ReturnType<typeof startReceiver>>;
  let worker: WebhookWorker;
  let owner: { cookie: string; userId: string };
  let other: { cookie: string; userId: string };
  let wsSlug: string;
  let otherSlug: string;
  const base = () => `/api/v1/workspaces/${wsSlug}/webhooks`;
  const asOwner = (r: request.Test) => r.set("Cookie", owner.cookie).set("Origin", testApp.env.PUBLIC_URL);

  const storedSecret = async (id: string) => {
    const [row] = await testApp.db
      .select({ secret: schema.webhookSubscriptions.secret })
      .from(schema.webhookSubscriptions)
      .where(eq(schema.webhookSubscriptions.id, id));
    return row.secret;
  };

  const makeKey = async (scopes: string[]) => {
    const res = await asOwner(request(testApp.http).post(`/api/v1/workspaces/${wsSlug}/api-keys`)).send({
      name: `key ${scopes.join(",")}`.slice(0, 90),
      scopes,
    });
    expect(res.status).toBe(201);
    return res.body.token as string;
  };

  beforeAll(async () => {
    receiver = await startReceiver((req) => ({ status: req.path === "/retry" ? 503 : 200 }));
    testApp = await createTestApp({ outboundNetwork: receiverNetwork({ deadlineMs: 2000 }) });
    worker = testApp.app.get(WebhookWorker);

    owner = await signedInCookie(testApp.test, { name: "Owner", email: "owner@secrets.test", emailVerified: true });
    other = await signedInCookie(testApp.test, { name: "Other", email: "other@secrets.test", emailVerified: true });

    wsSlug = `ws-sec-${Date.now()}`;
    otherSlug = `ws-sec-other-${Date.now()}`;
    const [ws] = await testApp.db.insert(schema.workspaces).values({ name: "Secrets", slug: wsSlug }).returning();
    const [ws2] = await testApp.db.insert(schema.workspaces).values({ name: "Other", slug: otherSlug }).returning();
    await testApp.db.insert(schema.workspaceMembers).values([
      { workspaceId: ws.id, userId: owner.userId, role: "owner" },
      { workspaceId: ws2.id, userId: other.userId, role: "owner" },
    ]);
  });

  afterAll(async () => {
    await testApp?.close();
    await receiver?.close();
  });

  it("returns the secret on create and rotate only, never on any read", async () => {
    const created = await asOwner(request(testApp.http).post(base())).send({ url: receiver.url, events: ["*"] });
    expect(created.status).toBe(201);
    const first = created.body.secret as string;
    expect(first).toMatch(SECRET_RE);
    const id = created.body.id as string;
    expect(await storedSecret(id)).toBe(first);

    await asOwner(request(testApp.http).post(`${base()}/${id}/ping`)).expect(201);

    const reads = [
      await asOwner(request(testApp.http).get(base())),
      await asOwner(request(testApp.http).get(`${base()}/${id}`)),
      await asOwner(request(testApp.http).patch(`${base()}/${id}`)).send({ description: "renamed" }),
      await asOwner(request(testApp.http).get(`${base()}/${id}/deliveries`)),
    ];
    for (const res of reads) {
      expect(res.status).toBe(200);
      expect(res.text).not.toContain(first);
      expect(res.text).not.toContain("whsec_");
      expect(res.text).not.toContain('"secret"');
    }

    const rotated = await asOwner(request(testApp.http).post(`${base()}/${id}/rotate-secret`));
    expect(rotated.status).toBe(200);
    expect(rotated.body.id).toBe(id);
    expect(rotated.body.url).toBe(receiver.url);
    expect(rotated.body.secret).toMatch(SECRET_RE);
    expect(rotated.body.secret).not.toBe(first);
    expect(await storedSecret(id)).toBe(rotated.body.secret);

    const after = await asOwner(request(testApp.http).get(`${base()}/${id}`));
    expect(after.text).not.toContain(rotated.body.secret);
    expect(after.text).not.toContain("whsec_");
  });

  it("refuses rotation by any API key, even one holding every scope, and leaves the secret alone", async () => {
    const created = await asOwner(request(testApp.http).post(base())).send({ url: receiver.url, events: ["*"] });
    const id = created.body.id as string;
    const before = await storedSecret(id);
    const everyScope = await makeKey([...API_KEY_SCOPES]);
    const adminOnly = await makeKey(["admin"]);

    for (const token of [everyScope, adminOnly]) {
      const res = await request(testApp.http)
        .post(`${base()}/${id}/rotate-secret`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe("api_key_route_forbidden");
      expect(res.text).not.toContain("whsec_");
      expect(await storedSecret(id)).toBe(before);
    }
  });

  it("returns 404 for a foreign workspace's endpoint and for a non-uuid id", async () => {
    const created = await asOwner(request(testApp.http).post(base())).send({ url: receiver.url, events: ["*"] });
    const id = created.body.id as string;
    const before = await storedSecret(id);

    const foreign = await request(testApp.http)
      .post(`/api/v1/workspaces/${otherSlug}/webhooks/${id}/rotate-secret`)
      .set("Cookie", other.cookie)
      .set("Origin", testApp.env.PUBLIC_URL);
    expect(foreign.status).toBe(404);
    expect(foreign.body.code).toBe("not_found");
    expect(await storedSecret(id)).toBe(before);

    const bad = await asOwner(request(testApp.http).post(`${base()}/not-a-uuid/rotate-secret`));
    expect(bad.status).toBe(404);
  });

  it("signs the next delivery with the rotated secret, including a retry of an earlier failure", async () => {
    const created = await asOwner(request(testApp.http).post(base())).send({ url: receiver.url, events: ["*"] });
    const id = created.body.id as string;
    const oldSecret = created.body.secret as string;

    const ping1 = await asOwner(request(testApp.http).post(`${base()}/${id}/ping`)).expect(201);
    await worker.runOnce(new Date());
    const first = receiver.requests.filter((r) => r.deliveryId === ping1.body.deliveryId);
    expect(first).toHaveLength(1);
    expect(verifyWebhookSignature(first[0].body, first[0].headers["x-userhq-signature"] as string, oldSecret)).toBe(true);

    // A delivery that failed with 503 before the rotation (pending, attempts 1).
    const failing = await asOwner(request(testApp.http).post(base())).send({
      url: receiver.url.replace("/hook", "/retry"),
      events: ["*"],
    });
    const failId = failing.body.id as string;
    const failOld = failing.body.secret as string;
    const ping2 = await asOwner(request(testApp.http).post(`${base()}/${failId}/ping`)).expect(201);
    const t0 = new Date();
    await worker.runOnce(t0);
    const [afterFail] = await testApp.db
      .select()
      .from(schema.webhookDeliveries)
      .where(eq(schema.webhookDeliveries.id, ping2.body.deliveryId));
    expect(afterFail).toMatchObject({ status: "pending", attempts: 1 });

    const rotated = await asOwner(request(testApp.http).post(`${base()}/${id}/rotate-secret`)).expect(200);
    const rotatedFail = await asOwner(request(testApp.http).post(`${base()}/${failId}/rotate-secret`)).expect(200);

    // A new ping after rotation verifies with the new secret only.
    const ping3 = await asOwner(request(testApp.http).post(`${base()}/${id}/ping`)).expect(201);
    await worker.runOnce(new Date(t0.getTime() + 60_000));
    const [after] = receiver.requests.filter((r) => r.deliveryId === ping3.body.deliveryId);
    const sig = after.headers["x-userhq-signature"] as string;
    expect(verifyWebhookSignature(after.body, sig, rotated.body.secret)).toBe(true);
    expect(verifyWebhookSignature(after.body, sig, oldSecret)).toBe(false);

    // The retry of the earlier failure is signed with the rotated secret too.
    await worker.runOnce(new Date(t0.getTime() + 3 * 60_000));
    const retries = receiver.requests.filter((r) => r.deliveryId === ping2.body.deliveryId);
    expect(retries.length).toBeGreaterThanOrEqual(2);
    const last = retries[retries.length - 1];
    const lastSig = last.headers["x-userhq-signature"] as string;
    expect(verifyWebhookSignature(last.body, lastSig, rotatedFail.body.secret)).toBe(true);
    expect(verifyWebhookSignature(last.body, lastSig, failOld)).toBe(false);
  });
});
