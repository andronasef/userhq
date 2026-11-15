import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
const require = createRequire(resolve("apps/api/package.json"));
const { chromium } = require("@playwright/test");
const tag = readFileSync("/tmp/userhq-clarity-tag.js", "utf8");
const recorder = readFileSync("/tmp/userhq-clarity-recorder.js", "utf8");
const bootstrap = readFileSync("apps/web/public/~partytown/partytown.js", "utf8");
const server = createServer((req, res) => {
  if (req.url.startsWith("/~partytown/")) {
    try { res.setHeader("Content-Type", req.url.endsWith("html") ? "text/html" : "text/javascript"); res.end(readFileSync(resolve("apps/web/public", "." + req.url))); }
    catch { res.statusCode = 404; res.end(); } return;
  }
  const worker = req.url === "/worker";
  res.setHeader("Content-Type", "text/html");
  res.end(`<!doctype html><html><head>${worker ? `<script>window.partytown={forward:['clarity'],fallbackTimeout:0};${bootstrap}</script>` : ""}<script type="${worker ? "text/partytown" : "text/javascript"}">window.clarity=window.clarity||function(){(window.clarity.q=window.clarity.q||[]).push(arguments)};${tag}</script></head><body data-clarity-mask="true"><button id="probe">Probe</button></body></html>`);
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const browser = await chromium.launch({ headless: true });
try {
  for (const mode of ["worker", "main"]) {
    const context = await browser.newContext();
    const calls = []; const errors = [];
    await context.route("https://**/*", async route => {
      const request = route.request();
      if (request.url().includes("scripts.clarity.ms")) await route.fulfill({ contentType: "text/javascript", body: recorder });
      else { if (request.method() === "POST") writeFileSync(`/tmp/userhq-clarity-${mode}-${calls.length}.payload`, request.postDataBuffer()); calls.push({ host: new URL(request.url()).hostname, method: request.method(), bytes: request.postDataBuffer()?.length ?? 0 }); await route.fulfill({ status: 204, headers: { "access-control-allow-origin": request.headers().origin || "*", "access-control-allow-credentials": "true" } }); }
    });
    const page = await context.newPage();
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}/${mode}`);
    await page.waitForTimeout(3500);
    await page.locator("#probe").click();
    await page.evaluate(() => { const n = document.createElement("p"); n.textContent = "Public synthetic mutation"; document.body.appendChild(n); });
    await page.evaluate(() => window.clarity?.("event", "compatibility_probe"));
    await page.waitForTimeout(5500);
    console.log(JSON.stringify({ mode, collectorCalls: calls, errors }));
    await context.close();
  }
} finally { await browser.close(); server.close(); }
