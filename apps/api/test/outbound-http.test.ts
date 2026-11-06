import { beforeAll, afterAll, describe, expect, it } from "vitest";
import https from "node:https";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { LookupAddress } from "node:dns";
import { OutboundHttp, type OutboundNetwork } from "../src/common/outbound-http.js";

describe("Public outbound HTTPS boundary", () => {
  let server: https.Server;
  let port: number;
  const ca = readFileSync(new URL("./fixtures/outbound-test-cert.pem", import.meta.url));
  const key = readFileSync(new URL("./fixtures/outbound-test-key.pem", import.meta.url));
  const received: Array<{ host: string | undefined; path: string | undefined; body: string }> = [];
  beforeAll(async () => {
    server = https.createServer({ cert: ca, key }, (req, res) => {
      let body = "";
      req.on("data", chunk => { body += chunk; });
      req.on("end", () => {
        received.push({ host: req.headers.host, path: req.url, body });
        if (req.url === "/headers-stall") return;
        if (req.url === "/body-stall") { res.writeHead(200); res.write("started"); return; }
        if (req.url === "/redirect") { res.writeHead(302, { Location: "https://127.0.0.1/private" }); res.end(); return; }
        if (req.url === "/large") { res.end(Buffer.alloc(100_000, "x")); return; }
        res.end("accepted");
      });
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  function boundary(resolve: OutboundNetwork["resolve"] = async () => [{ address: "8.8.8.8", family: 4 }], deadlineMs = 1000) {
    const pins: string[] = [];
    let requests = 0;
    const network: OutboundNetwork = {
      deadlineMs, resolve,
      request: (url, options, response) => {
        requests++;
        expect(options.agent).toBe(false);
        expect(options.rejectUnauthorized).toBe(true);
        expect(options.servername).toBe(url.hostname);
        expect(options.autoSelectFamily).toBe(false);
        const lookup = options.lookup as any;
        lookup(url.hostname, {}, (_err: unknown, address: string, family: number) => {
          expect(family).toBe(4);
          pins.push(address);
        });
        // Only this test's external socket adapter maps the validated address to
        // a loopback TLS receiver. Hostname verification remains enabled.
        return https.request(url, {
          ...options, ca,
          lookup: (_hostname, _options, callback) => callback(null, "127.0.0.1", 4),
        }, response);
      },
    };
    return { client: new OutboundHttp(network), pins, requestCount: () => requests };
  }
  const url = (path: string) => `https://receiver.example.test:${port}${path}`;

  it("pins a validated public address while retaining HTTPS hostname identity", async () => {
    let calls = 0;
    const test = boundary(async () => [{ address: calls++ === 0 ? "8.8.8.8" : "127.0.0.1", family: 4 }]);
    expect(await test.client.post(url("/ok"), {}, "signed bytes")).toEqual({ statusCode: 200, body: "accepted" });
    expect(test.pins).toEqual(["8.8.8.8"]);
    expect(received.at(-1)).toEqual({ host: `receiver.example.test:${port}`, path: "/ok", body: "signed bytes" });
    await expect(test.client.post(url("/private"), {}, "secret")).rejects.toThrow("Outbound destination rejected");
    expect(test.requestCount()).toBe(1);
  });

  it("keeps certificate hostname verification enabled", async () => {
    const test = boundary();
    await expect(test.client.post(`https://wrong.example.test:${port}/ok`, {}, "secret"))
      .rejects.toThrow("Outbound request failed");
  });

  it("returns redirects without forwarding the payload to Location", async () => {
    const test = boundary();
    expect((await test.client.post(url("/redirect"), {}, "secret")).statusCode).toBe(302);
    expect(test.requestCount()).toBe(1);
  });

  it("bounds response allocation and closes an oversized response", async () => {
    const test = boundary();
    const result = await test.client.post(url("/large"), {}, "");
    expect(result.statusCode).toBe(200);
    expect(Buffer.byteLength(result.body)).toBe(8192);
  });

  it.each(["headers-stall", "body-stall"])("bounds a stalled %s exchange", async path => {
    const test = boundary(undefined, 150);
    await expect(test.client.post(url(`/${path}`), {}, "secret")).rejects.toThrow("Outbound delivery timed out");
  });

  it("bounds DNS and never opens a connection after late resolution", async () => {
    let complete!: (addresses: LookupAddress[]) => void;
    const test = boundary(() => new Promise(resolve => { complete = resolve; }), 20);
    await expect(test.client.post(url("/ok"), {}, "secret")).rejects.toThrow("Outbound delivery timed out");
    complete([{ address: "8.8.8.8", family: 4 }]);
    await new Promise<void>(resolve => setImmediate(resolve));
    expect(test.requestCount()).toBe(0);
  });

  it("bounds registration DNS and accepts ordinary public IPv6 literals", async () => {
    const test = boundary(() => new Promise(() => {}), 20);
    await expect(test.client.validateTarget(url("/ok"))).rejects.toMatchObject({ code: "invalid_url" });
    expect((await test.client.validateTarget("https://[2606:4700:4700::1111]/hook")).address.address)
      .toBe("2606:4700:4700::1111");
  });
});
