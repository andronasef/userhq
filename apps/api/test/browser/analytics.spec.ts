import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../../../..");
const read = (p: string) => readFileSync(path.join(root, p), "utf8");
function browserModule(p: string, name: string): string {
  const code = ts.transpileModule(read(p), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  return `(function(){var exports={};var require=function(name){return name==='next/navigation'?{useRouter:function(){return {push:function(){document.body.innerHTML='<p>UNSAFE PRIVATE RENDER</p>'},replace:function(){},refresh:function(){}}}}:window.__route};${code};window.${name}=exports;})();`;
}
let server: Server;
let origin: string;
const proofs: string[] = [];
test.beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url?.startsWith("/~partytown/")) {
      try {
        res.setHeader(
          "Content-Type",
          req.url.endsWith("html") ? "text/html" : "text/javascript",
        );
        res.end(read(`apps/web/public${req.url}`));
      } catch {
        res.statusCode = 404;
        res.end();
      }
      return;
    }
    if (req.url === "/proof") {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        proofs.push(body);
        res.end("ok");
      });
      return;
    }
    res.setHeader("Content-Type", "text/html");
    const privatePage = req.url?.startsWith("/dashboard");
    res.end(
      `<!doctype html><html><head></head><body><p id="screen">${privatePage ? "Private" : "Public"}</p><a id="private" href="/dashboard/acme">Dashboard</a><a id="public" href="/acme/widget">Portal</a><script>window.documentIdentity=Math.random();${browserModule("apps/web/lib/analytics-route.ts", "__route")}${browserModule("apps/web/lib/analytics-navigation.ts", "__navigation")}window.__navigation.installAnalyticsNavigationBoundary();</script></body></html>`,
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test("GTM bootstrap and forwarded events execute in a real Partytown worker", async ({
  page,
}) => {
  proofs.length = 0;
  await page.route("https://www.googletagmanager.com/**", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `window.dataLayer=window.dataLayer||[];var send=function(event){fetch('/proof',{method:'POST',body:JSON.stringify({stack:new Error('worker-proof').stack,event:event})})};window.dataLayer.forEach(send);window.dataLayer.push=function(event){send(event);return 1};`,
    }),
  );
  await page.goto(origin + "/acme/widget");
  await page.addScriptTag({
    content: `window.partytown={forward:['dataLayer.push'],fallbackTimeout:0};window.dataLayer=[];window.dataLayer.push({event:'userhq_event',event_name:'vote_added'});`,
  });
  await page.evaluate(() => {
    const script = document.createElement("script");
    script.type = "text/partytown";
    script.src = "https://www.googletagmanager.com/gtm.js?id=GTM-TNBWG655";
    document.head.appendChild(script);
  });
  await page.addScriptTag({
    content: read("apps/web/public/~partytown/partytown.js"),
  });
  await page.evaluate(() =>
    (window as any).dataLayer.push({
      event: "userhq_event",
      event_name: "vote_added",
    }),
  );
  await expect
    .poll(() =>
      proofs.some((p) => JSON.parse(p).event?.event_name === "vote_added"),
    )
    .toBe(true);
  const result = proofs
    .map((p) => JSON.parse(p))
    .find((p) => p.event?.event_name === "vote_added");
  expect(page.workers().length).toBeGreaterThan(0);
  expect(result.stack).toMatch(/blob:|partytown-ww/);
  expect(result.event.event_name).toBe("vote_added");
});

test("anchor, programmatic and history navigation replace the public document before private rendering", async ({
  page,
}) => {
  await page.goto(origin + "/acme/widget");
  let id = await page.evaluate(() => (window as any).documentIdentity);
  await page.locator("#private").click();
  await expect(page.locator("#screen")).toHaveText("Private");
  expect(await page.evaluate(() => (window as any).documentIdentity)).not.toBe(
    id,
  );
  await page.goBack();
  await expect(page.locator("#screen")).toHaveText("Public");
  id = await page.evaluate(() => (window as any).documentIdentity);
  await page.evaluate(() =>
    (window as any).__navigation.useAnalyticsRouter().push("/dashboard/acme"),
  );
  await expect(page.locator("#screen")).toHaveText("Private");
  expect(await page.evaluate(() => (window as any).documentIdentity)).not.toBe(
    id,
  );
});
