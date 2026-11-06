import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ORIGIN = "https://app.example.test";
const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

function loadWorker(clientUrls: string[] = []) {
  const listeners: Record<string, (event: any) => void> = {};
  const clients = clientUrls.map((url) => ({ url, focus: vi.fn(async () => url) }));
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: (event: any) => void) => { listeners[type] = fn; },
    skipWaiting: vi.fn(),
    registration: { showNotification: vi.fn(async () => undefined) },
    clients: {
      claim: vi.fn(),
      matchAll: vi.fn(async () => clients),
      openWindow: vi.fn(async () => undefined),
    },
  };
  vm.runInNewContext(source, { self, URL, JSON });
  return { listeners, self, clients };
}

function push(payload: unknown) {
  const { listeners, self } = loadWorker();
  listeners.push({ data: { json: () => payload, text: () => "" }, waitUntil: () => undefined });
  return self;
}

async function click(url: string | undefined, clientUrls: string[] = []) {
  const { listeners, self, clients } = loadWorker(clientUrls);
  const close = vi.fn();
  const waits: Promise<unknown>[] = [];
  listeners.notificationclick({ notification: { close, data: url === undefined ? {} : { url } }, waitUntil: (p: Promise<unknown>) => waits.push(p) });
  await Promise.all(waits);
  return { self, clients, close };
}

describe("service worker push display", () => {
  it("passes tag through and sets renotify only with a non-empty string tag", () => {
    const tagged = push({ title: "T", body: "B", url: "/a/b/p/1-x", tag: "post-1", renotify: true });
    expect(tagged.registration.showNotification).toHaveBeenCalledWith("T", {
      body: "B", icon: "/favicon.ico", badge: "/favicon.ico", tag: "post-1", renotify: true, data: { url: "/a/b/p/1-x" },
    });
    const untagged = push({ title: "T", body: "B", renotify: true });
    const options = (untagged.registration.showNotification.mock.calls as any[][])[0][1];
    expect(options).not.toHaveProperty("tag");
    expect(options).not.toHaveProperty("renotify");
    const empty = push({ title: "T", tag: "", renotify: true });
    expect((empty.registration.showNotification.mock.calls as any[][])[0][1]).not.toHaveProperty("renotify");
  });

  it("falls back to default title and body", () => {
    const self = push({});
    expect(self.registration.showNotification).toHaveBeenCalledWith("UserHQ Notification", expect.objectContaining({ body: "", data: { url: "/" } }));
  });
});

describe("service worker notification click", () => {
  it("closes the notification and opens the resolved absolute url for a relative path", async () => {
    const { self, close } = await click("/ws/prod/p/3-hello");
    expect(close).toHaveBeenCalledOnce();
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/ws/prod/p/3-hello`);
  });

  it("focuses an open client on the exact page and does not open a window", async () => {
    const { self, clients } = await click("/ws/prod/p/3-hello", [`${ORIGIN}/other`, `${ORIGIN}/ws/prod/p/3-hello`]);
    expect(clients[1].focus).toHaveBeenCalledOnce();
    expect(clients[0].focus).not.toHaveBeenCalled();
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it("never navigates or focuses an unrelated existing client", async () => {
    const { self, clients } = await click("/ws/prod/p/3-hello", [`${ORIGIN}/other`]);
    expect(clients[0].focus).not.toHaveBeenCalled();
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/ws/prod/p/3-hello`);
  });

  it.each(["https://evil.example/steal", "//evil.example/steal", "http://[bad"])("falls back to the origin root for %s", async (raw) => {
    const { self } = await click(raw);
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });

  it("opens the origin root when the notification has no url", async () => {
    const { self } = await click(undefined);
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/`);
  });
});
