"use client";

import * as React from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Code2,
  Globe,
  Inbox,
  KeyRound,
  Layers,
  MapPin,
  MessageSquare,
  Palette,
  Route,
  Search,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SwaggerExplorer } from "./swagger-explorer";

interface GuideViewProps {
  workspaces: Array<{ slug: string; name: string; role: string }>;
  isPlatformOwner?: boolean;
}

const NAV_SECTIONS = [
  {
    title: "Getting Started",
    items: [
      { id: "overview", label: "Overview & Structure", icon: Layers },
      { id: "roles-permissions", label: "Roles & Permissions", icon: ShieldCheck },
    ],
  },
  {
    title: "Triage & Feedback",
    items: [
      { id: "requests-inbox", label: "Requests (All Boards)", icon: Inbox },
      { id: "comments-attention", label: "Comments & Needs Attention", icon: MessageSquare },
      { id: "author-location", label: "Author Contact & Location", icon: MapPin },
    ],
  },
  {
    title: "Portals & Roadmaps",
    items: [
      { id: "customer-portals", label: "Public Customer Portals", icon: Globe },
      { id: "roadmap-changelog", label: "Roadmap & Release Notes", icon: Route },
      { id: "faq-system", label: "Self-Serve FAQ", icon: BookOpen },
    ],
  },
  {
    title: "Appearance & Alerts",
    items: [
      { id: "themes-push", label: "Themes & Web Push Alerts", icon: Palette },
    ],
  },
  {
    title: "Automation & API",
    items: [
      { id: "api-overview", label: "API Auth & Rate Limits", icon: KeyRound },
      { id: "swagger-explorer", label: "Interactive API Explorer", icon: Code2 },
      { id: "webhooks-hmac", label: "Webhooks & HMAC Signatures", icon: Webhook },
    ],
  },
];

export function GuideView({ workspaces }: GuideViewProps) {
  const [activeSection, setActiveSection] = React.useState("overview");
  const [navSearch, setNavSearch] = React.useState("");

  // Track active section on scroll
  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-80px 0px -60% 0px" }
    );

    const headings = document.querySelectorAll("section[id]");
    headings.forEach((heading) => observer.observe(heading));

    return () => observer.disconnect();
  }, []);

  const filteredSections = React.useMemo(() => {
    if (!navSearch.trim()) return NAV_SECTIONS;
    const q = navSearch.toLowerCase();
    return NAV_SECTIONS.map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => item.label.toLowerCase().includes(q)),
    })).filter((sec) => sec.items.length > 0);
  }, [navSearch]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Breadcrumb Header */}
      <div className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <nav className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              href="/"
              className="hover:text-foreground transition-colors font-medium"
            >
              UserHQ
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="text-foreground font-semibold">
              User Guide &amp; API Reference
            </span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Navigation Sidebar */}
          <aside className="lg:col-span-3 sticky top-16 hidden lg:flex lg:flex-col max-h-[calc(100vh-5rem)] space-y-3">
            <div className="relative shrink-0 pr-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search topics..."
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/40 border border-border rounded-lg placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <nav className="space-y-5 text-xs overflow-y-auto pr-2 pb-6 flex-1">
              {filteredSections.map((sec) => (
                <div key={sec.title} className="space-y-1.5">
                  <h3 className="font-semibold uppercase tracking-wider text-[11px] text-muted-foreground px-2">
                    {sec.title}
                  </h3>
                  <div className="space-y-0.5">
                    {sec.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeSection === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => scrollTo(item.id)}
                          className={cn(
                            "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-all font-medium",
                            isActive
                              ? "bg-[var(--primary)]/10 text-[var(--primary-text)] font-semibold shadow-xs"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-3.5",
                              isActive
                                ? "text-[var(--primary-text)]"
                                : "text-muted-foreground"
                            )}
                          />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          {/* Main Content Area */}
          <main className="lg:col-span-9 space-y-12 min-w-0">
            {/* Title & Quick Jump Cards */}
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                  UserHQ Platform &amp; API Guide
                </h1>
                <p className="text-base text-muted-foreground max-w-3xl leading-relaxed">
                  Everything you need to organize customer feedback, prioritize feature requests, publish public roadmaps, and automate your workflows.
                </p>
              </div>

              {/* Quick Navigation Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => scrollTo("requests-inbox")}
                  className="p-4 rounded-xl border border-border bg-card hover:border-[var(--primary)]/40 hover:bg-card/80 transition-all text-left space-y-1.5 group shadow-xs"
                >
                  <Inbox className="size-4 text-[var(--primary-text)] group-hover:scale-110 transition-transform" />
                  <div className="font-semibold text-xs text-foreground">
                    Requests Inbox
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-snug">
                    Triage customer feature requests across all your products.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => scrollTo("comments-attention")}
                  className="p-4 rounded-xl border border-border bg-card hover:border-[var(--primary)]/40 hover:bg-card/80 transition-all text-left space-y-1.5 group shadow-xs"
                >
                  <MessageSquare className="size-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                  <div className="font-semibold text-xs text-foreground">
                    Comments Inbox
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-snug">
                    Needs Attention queue and team conversation threads.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => scrollTo("swagger-explorer")}
                  className="p-4 rounded-xl border border-border bg-card hover:border-[var(--primary)]/40 hover:bg-card/80 transition-all text-left space-y-1.5 group shadow-xs"
                >
                  <Code2 className="size-4 text-blue-500 group-hover:scale-110 transition-transform" />
                  <div className="font-semibold text-xs text-foreground">
                    Interactive API Explorer
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-snug">
                    Test endpoints, copy schemas, and generate code snippets.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => scrollTo("webhooks-hmac")}
                  className="p-4 rounded-xl border border-border bg-card hover:border-[var(--primary)]/40 hover:bg-card/80 transition-all text-left space-y-1.5 group shadow-xs"
                >
                  <Webhook className="size-4 text-purple-500 group-hover:scale-110 transition-transform" />
                  <div className="font-semibold text-xs text-foreground">
                    Webhooks &amp; HMAC
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-snug">
                    Real-time event delivery and SHA-256 signatures.
                  </div>
                </button>
              </div>
            </div>

            {/* Section: Overview & Workspace Structure */}
            <section id="overview" className="scroll-mt-20 space-y-4">
              <div className="border-b border-border pb-2">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Layers className="size-5 text-[var(--primary-text)]" />
                  Overview &amp; Structure
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                UserHQ helps your team collect and act on feedback from your customers. Here is how your workspace is structured:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
                  <span className="font-bold text-foreground text-sm block">
                    1. Workspace
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    Your team&apos;s central home. Houses your team members, billing, API keys, webhooks, and the unified feedback inbox across all your products.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
                  <span className="font-bold text-foreground text-sm block">
                    2. Products
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    The individual apps or services you build (e.g. Web App, iOS App, API). Each product has its own feedback board, roadmap, changelog, categories, and custom branding.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card/60 space-y-2">
                  <span className="font-bold text-foreground text-sm block">
                    3. Customer Portals
                  </span>
                  <p className="text-muted-foreground leading-relaxed">
                    The branded portal your users visit to submit ideas, upvote feature requests, track your public roadmap, and read release announcements.
                  </p>
                </div>
              </div>
            </section>

            {/* Section: Roles & Permissions */}
            <section id="roles-permissions" className="scroll-mt-20 space-y-4">
              <div className="border-b border-border pb-2">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="size-5 text-emerald-500" />
                  Roles &amp; Team Permissions
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Collaborate with your entire team while maintaining control over workspace settings:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3.5 rounded-lg border border-border bg-card space-y-1">
                  <span className="font-bold text-foreground block">Workspace Owner</span>
                  <p className="text-muted-foreground">
                    Full workspace control: manage subscriptions, invite admins, create API keys, configure webhooks, and transfer ownership.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg border border-border bg-card space-y-1">
                  <span className="font-bold text-foreground block">Workspace Admin</span>
                  <p className="text-muted-foreground">
                    Can manage products, triage feedback, reply officially to customers, manage roadmap cards, and publish release notes.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg border border-border bg-card space-y-1">
                  <span className="font-bold text-foreground block">Workspace Member</span>
                  <p className="text-muted-foreground">
                    Can view feedback submissions, participate in internal team discussions, and track customer feature requests.
                  </p>
                </div>
              </div>
            </section>

            {/* Section: Requests Inbox */}
            <section id="requests-inbox" className="scroll-mt-20 space-y-4">
              <div className="border-b border-border pb-2">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Inbox className="size-5 text-[var(--primary-text)]" />
                  Requests (All Boards) &amp; Triage
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Located at <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">/dashboard/[ws]/requests</code>,
                the unified Requests inbox brings together all customer submissions from every product into a single high-performance triage view.
              </p>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-lg border border-border bg-card space-y-1">
                    <span className="font-semibold text-foreground">Multi-Dimension Filtering</span>
                    <p className="text-muted-foreground">
                      Filter instantly by Product, Status Phase (Backlog, In Progress, Completed), Category, Keyword search, and Date ranges.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg border border-border bg-card space-y-1">
                    <span className="font-semibold text-foreground">Fast Status Updates</span>
                    <p className="text-muted-foreground">
                      Move items between stages (Under Review, Planned, In Progress, Completed) with one click. Customers who upvoted the request are notified automatically.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section: Comments & Needs Attention */}
            <section id="comments-attention" className="scroll-mt-20 space-y-4">
              <div className="border-b border-border pb-2">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <MessageSquare className="size-5 text-emerald-500" />
                  Comments &amp; Needs Attention Inbox
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Located at <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">/dashboard/[ws]/comments</code>,
                this inbox acts like a responsive customer support desk for your feedback threads.
              </p>

              <div className="p-4 rounded-xl border border-border bg-card space-y-3 text-xs">
                <h4 className="font-semibold text-foreground text-sm">
                  Workflow Stages
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                      <span className="size-2 rounded-full bg-amber-500 inline-block animate-pulse" />
                      Needs Attention
                    </div>
                    <p className="text-muted-foreground">
                      Any customer comment that has not received an official team response. Highlighted with amber indicators so customer inquiries are never overlooked.
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5" />
                      Handled
                    </div>
                    <p className="text-muted-foreground">
                      Automatically cleared from the attention queue as soon as a team member replies with an official badge, or manually marked as handled.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section: Author Location & Contact */}
            <section id="author-location" className="scroll-mt-20 space-y-4">
              <div className="border-b border-border pb-2">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <MapPin className="size-5 text-rose-500" />
                  Author Contact &amp; Location Insights
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                To give your team valuable context on who is submitting feedback, request and comment cards in your dashboard display author details:
              </p>
              <div className="p-4 rounded-xl border border-border bg-card space-y-2 text-xs">
                <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                  <li>
                    <strong>Direct Email Reach-Out:</strong> Click the mailto button next to the author&apos;s name to quickly contact them for user interviews or follow-up questions.
                  </li>
                  <li>
                    <strong>Geographic Context:</strong> View the customer&apos;s approximate location (e.g. <code className="px-1 py-0.5 rounded bg-muted">London, United Kingdom [GB]</code>) to understand geographic usage trends.
                  </li>
                  <li>
                    <strong>Privacy by Design:</strong> Author email addresses and locations are strictly visible to workspace team members and are never displayed on public customer portals.
                  </li>
                </ul>
              </div>
            </section>

            {/* Section: Customer Portals */}
            <section id="customer-portals" className="scroll-mt-20 space-y-4">
              <div className="border-b border-border pb-2">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Globe className="size-5 text-blue-500" />
                  Public Customer Portals
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Every product in your workspace can have its own public portal at <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">/[ws]/[product]</code>.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-lg border border-border bg-card space-y-1">
                  <span className="font-semibold text-foreground">Modular Feature Toggles</span>
                  <p className="text-muted-foreground">
                    Independently enable or disable the Feedback Board, Roadmap, Changelog, or FAQ per product based on what you are ready to share.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg border border-border bg-card space-y-1">
                  <span className="font-semibold text-foreground">Custom Branding &amp; Colors</span>
                  <p className="text-muted-foreground">
                    Customize your portal with your logo, brand name, and custom accent color to create a seamless extension of your app.
                  </p>
                </div>
              </div>
            </section>

            {/* Section: Roadmap & Changelog */}
            <section id="roadmap-changelog" className="scroll-mt-20 space-y-4">
              <div className="border-b border-border pb-2">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Route className="size-5 text-[var(--primary-text)]" />
                  Roadmap Planning &amp; Release Notes
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <h3 className="font-semibold text-foreground text-sm">
                    Interactive Roadmap
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Organize feature development into visual columns (e.g. Under Consideration, Planned, In Progress). Link customer feedback directly to roadmap cards so subscribers stay informed as features advance.
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                  <h3 className="font-semibold text-foreground text-sm">
                    Changelog &amp; Release Announcements
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    Publish release notes tagged with categories (New Feature, Improvement, Bug Fix). Publishing a release note automatically closes the loop with customers who requested linked features.
                  </p>
                </div>
              </div>
            </section>

            {/* Section: FAQ System */}
            <section id="faq-system" className="scroll-mt-20 space-y-4">
              <div className="border-b border-border pb-2">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <BookOpen className="size-5 text-indigo-500" />
                  Self-Serve FAQ Knowledge Base
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Add frequently asked questions organized into categories on your product portal. Giving customers instant answers reduces duplicate feature submissions and common support requests.
              </p>
            </section>

            {/* Section: Themes & Push */}
            <section id="themes-push" className="scroll-mt-20 space-y-4">
              <div className="border-b border-border pb-2">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Palette className="size-5 text-amber-500" />
                  Themes &amp; Web Push Alerts
                </h2>
              </div>
              <div className="p-4 rounded-xl border border-border bg-card space-y-3 text-xs">
                <p className="text-muted-foreground leading-relaxed">
                  UserHQ includes four themes: <strong>System</strong>, <strong>Light</strong>, <strong>Dark</strong> (deep navy), and <strong>Charcoal</strong> (neutral near-black).
                  Team members can also enable browser Web Push notifications in <code className="px-1 py-0.5 rounded bg-muted">/account</code> to receive instant alerts when customers submit new feedback or comments.
                </p>
              </div>
            </section>

            {/* Section: API Overview */}
            <section id="api-overview" className="scroll-mt-20 space-y-4">
              <div className="border-b border-border pb-2">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <KeyRound className="size-5 text-blue-500" />
                  Automation API &amp; Authentication
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Connect external systems, CI/CD pipelines, Slack, Discord, Linear, GitHub, or custom internal dashboards using the UserHQ REST Automation API.
              </p>

              <div className="p-4 rounded-xl border border-border bg-card space-y-3 text-xs">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <ShieldCheck className="size-4 text-emerald-500" />
                  Authentication Header
                </div>
                <pre className="p-3 rounded-lg bg-muted/40 font-mono text-xs overflow-x-auto text-foreground">
                  Authorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx
                </pre>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-muted-foreground">
                  <div>
                    <strong className="text-foreground">Rate Limits:</strong> Generous 120 requests/minute allowance per API key with automatic token-bucket throttling.
                  </div>
                  <div>
                    <strong className="text-foreground">Scoped Permissions:</strong> Keys can be scoped to specific products and granted read/write permissions for specific resources.
                  </div>
                </div>
              </div>
            </section>

            {/* Section: Interactive Swagger Explorer */}
            <section id="swagger-explorer" className="scroll-mt-20 space-y-4">
              <div className="border-b border-border pb-2 flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Code2 className="size-5 text-emerald-500" />
                  Interactive API Explorer
                </h2>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  OpenAPI 3.1
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Test endpoints, inspect parameters, view request and response schemas, and generate instant code snippets in cURL, TypeScript, and Python.
              </p>

              {/* Mount the interactive Swagger Explorer */}
              <SwaggerExplorer workspaces={workspaces} />
            </section>

            {/* Section: Webhooks & HMAC */}
            <section id="webhooks-hmac" className="scroll-mt-20 space-y-4 pb-16">
              <div className="border-b border-border pb-2">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Webhook className="size-5 text-purple-500" />
                  Webhooks &amp; HMAC Signature Verification
                </h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                UserHQ delivers real-time HTTP POST events whenever requests are created, status changes occur, or comments arrive.
                Every delivery includes a secure HMAC-SHA256 signature in the <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">x-userhq-signature</code> header.
              </p>

              <div className="p-4 rounded-xl border border-border bg-card space-y-3 text-xs">
                <h4 className="font-semibold text-foreground">
                  Node.js / Express HMAC Verification Example
                </h4>
                <pre className="p-3.5 rounded-lg border border-border bg-muted/40 font-mono text-xs text-foreground overflow-x-auto">
{`import crypto from "crypto";

export function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedSignature)
  );
}`}
                </pre>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
