import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  openStack,
  mintSession,
  ownerSession,
  seedWorkspaceRows,
  cleanupWorkspaces,
  apiCall,
  baseUrl,
  type StackContext,
} from "../support/stack.js";

describe("Dashboard Frame & Navigation (Plan 02-04)", () => {
  let stack: StackContext;
  const workspaceIds: string[] = [];

  beforeAll(async () => {
    stack = await openStack();
  });

  afterAll(async () => {
    await cleanupWorkspaces(stack, workspaceIds);
    await stack.close();
  });

  it("renders dashboard header, switcher, sidebar, and products placeholder for members", async () => {
    const user = await mintSession(stack, { name: "Member User" });
    const betaSlug = `beta-${Date.now()}`;
    const alphaSlug = `alpha-${Date.now()}`;

    const wsBeta = await seedWorkspaceRows(stack, {
      userId: user.userId,
      name: "Beta Co",
      slug: betaSlug,
    });
    workspaceIds.push(wsBeta.id);

    const wsAlpha = await seedWorkspaceRows(stack, {
      userId: user.userId,
      name: "Alpha Co",
      slug: alphaSlug,
    });
    workspaceIds.push(wsAlpha.id);

    const res = await apiCall(`/dashboard/${betaSlug}`, {
      cookie: user.cookie,
    });
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain('aria-label="Switch workspace, current: Beta Co"');
    expect(html).toContain('aria-label="Open navigation"');
    expect(html).toContain('aria-label="Workspace"');
    expect(html).toContain("No products yet");
  });

  it("returns 404 for non-members without leaking workspace existence or sidebar", async () => {
    const member = await mintSession(stack, { name: "Owner User" });
    const secretSlug = `secret-${Date.now()}`;
    const ws = await seedWorkspaceRows(stack, {
      userId: member.userId,
      name: "Secret Co",
      slug: secretSlug,
    });
    workspaceIds.push(ws.id);

    const nonMember = await mintSession(stack, { name: "Non Member" });
    const res = await apiCall(`/dashboard/${secretSlug}`, {
      cookie: nonMember.cookie,
    });
    expect(res.status).toBe(404);
    const html = await res.text();

    expect(html).toContain("Page not found");
    expect(html).not.toContain('aria-label="Workspace"');
    expect(html).not.toContain("Secret Co");
  });

  it("signed-out requests to /dashboard and /dashboard/* get 307 to /login?next=<path>", async () => {
    const resRoot = await fetch(`${baseUrl}/dashboard`, { redirect: "manual" });
    expect(resRoot.status).toBe(307);
    expect(resRoot.headers.get("location")).toBe("/login?next=%2Fdashboard");

    const resSub = await fetch(`${baseUrl}/dashboard/some-workspace`, {
      redirect: "manual",
    });
    expect(resSub.status).toBe(307);
    expect(resSub.headers.get("location")).toBe(
      "/login?next=%2Fdashboard%2Fsome-workspace"
    );
  });

  it("signed-in user with 0 workspaces: / shows invite-only and menu lacks Dashboard link", async () => {
    const user = await mintSession(stack, { name: "Zero Workspaces" });
    const res = await fetch(`${baseUrl}/`, {
      headers: { Cookie: user.cookie },
    });
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain("Workspace creation is invite-only");
    expect(html).not.toContain("Create workspace");
    expect(html).not.toContain("<span>Dashboard</span>");
  });

  it("platform owner with 0 workspaces: / shows Set up your workspace and Create workspace button", async () => {
    const owner = await ownerSession(stack);
    const res = await fetch(`${baseUrl}/`, {
      headers: { Cookie: owner.cookie },
    });
    expect(res.status).toBe(200);
    const html = await res.text();

    expect(html).toContain("Set up your workspace");
    expect(html).toContain("Create workspace");
  });

  it("signed-in user with 1 workspace: / redirects to /dashboard/{ws}", async () => {
    const user = await mintSession(stack, { name: "One Workspace User" });
    const slug = `solo-${Date.now()}`;
    const ws = await seedWorkspaceRows(stack, {
      userId: user.userId,
      name: "Solo Co",
      slug,
    });
    workspaceIds.push(ws.id);

    const res = await fetch(`${baseUrl}/`, {
      headers: { Cookie: user.cookie },
      redirect: "manual",
    });
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.status).toBeLessThan(400);
    expect(res.headers.get("location")).toBe(`/dashboard/${slug}`);
  });

  it("signed-in user with 2 workspaces: / redirects to /dashboard and /dashboard lists sorted workspaces", async () => {
    const user = await mintSession(stack, { name: "Multi Workspace User" });
    const betaSlug = `multi-beta-${Date.now()}`;
    const alphaSlug = `multi-alpha-${Date.now()}`;

    const wsBeta = await seedWorkspaceRows(stack, {
      userId: user.userId,
      name: "Zeta Co",
      slug: betaSlug,
    });
    workspaceIds.push(wsBeta.id);

    const wsAlpha = await seedWorkspaceRows(stack, {
      userId: user.userId,
      name: "Alpha Co",
      slug: alphaSlug,
    });
    workspaceIds.push(wsAlpha.id);

    // 1. / redirects to /dashboard
    const resHome = await fetch(`${baseUrl}/`, {
      headers: { Cookie: user.cookie },
      redirect: "manual",
    });
    expect(resHome.status).toBeGreaterThanOrEqual(300);
    expect(resHome.status).toBeLessThan(400);
    expect(resHome.headers.get("location")).toBe("/dashboard");

    // 2. /dashboard lists sorted workspaces
    const resPicker = await fetch(`${baseUrl}/dashboard`, {
      headers: { Cookie: user.cookie },
    });
    expect(resPicker.status).toBe(200);
    const html = await resPicker.text();

    expect(html).toContain("Choose a workspace");
    expect(html.indexOf("Alpha Co")).toBeLessThan(html.indexOf("Zeta Co"));
    expect(html).toContain("Owner");
    expect(html).toContain("<span>Dashboard</span>");
  });

  it("/dashboard picker redirects to / with 0 workspaces and to /dashboard/{ws} with 1 workspace", async () => {
    const user0 = await mintSession(stack, { name: "Picker Zero" });
    const res0 = await fetch(`${baseUrl}/dashboard`, {
      headers: { Cookie: user0.cookie },
      redirect: "manual",
    });
    expect(res0.status).toBeGreaterThanOrEqual(300);
    expect(res0.status).toBeLessThan(400);
    expect(res0.headers.get("location")).toBe("/");

    const user1 = await mintSession(stack, { name: "Picker One" });
    const slug1 = `picker-one-${Date.now()}`;
    const ws1 = await seedWorkspaceRows(stack, {
      userId: user1.userId,
      name: "Picker One Co",
      slug: slug1,
    });
    workspaceIds.push(ws1.id);

    const res1 = await fetch(`${baseUrl}/dashboard`, {
      headers: { Cookie: user1.cookie },
      redirect: "manual",
    });
    expect(res1.status).toBeGreaterThanOrEqual(300);
    expect(res1.status).toBeLessThan(400);
    expect(res1.headers.get("location")).toBe(`/dashboard/${slug1}`);
  });
});
