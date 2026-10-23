import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "../../lib/api-server";
import { isDevUploadEnabled } from "../../lib/dev-flags";
import { Button } from "../../components/ui/button";
import {
  ArrowRight,
  Palette,
  ShieldCheck,
  Check,
  Mail,
} from "lucide-react";
import { ProductShowcase } from "../../components/home/product-showcase";

export default async function HomePage(): Promise<React.JSX.Element> {
  const me = await getMe();

  if (!me.user) {
    return (
      <div className="welcome-entry flex flex-col gap-16 sm:gap-24 py-4 sm:py-8">
        {/* HERO SECTION - MAGIC UI / 21ST.DEV ELEVATED AESTHETIC */}
        <section
          aria-labelledby="hero-heading"
          className="relative flex flex-col items-center text-center pt-10 sm:pt-16 pb-6 gap-7 max-w-4xl mx-auto"
        >
          {/* Ambient Lighting & Geometric Dot Grid Background */}
          <div
            className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[120%] max-w-5xl h-[480px] -z-10 overflow-hidden"
            aria-hidden="true"
          >
            {/* Subtle Calm Teal bloom */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_25%,_rgba(8,127,117,0.12),_transparent_75%)]" />
            {/* Tactile dot matrix pattern with radial falloff */}
            <div
              className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(var(--ink)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_35%,#000_60%,transparent_100%)]"
            />
          </div>

          {/* Main Headline (Pure typographic confidence, no badge) */}
          <div className="flex flex-col items-center gap-4">
            <h1
              id="hero-heading"
              className="text-4xl sm:text-6xl lg:text-7xl font-bold leading-[1.06] tracking-[-0.038em] text-foreground text-balance max-w-3xl"
            >
              Good products start with listening.
            </h1>
            <p className="max-w-[56ch] text-base sm:text-xl leading-relaxed text-muted-foreground text-balance font-normal">
              Customer feedback, transparent roadmaps, and shipped changelogs in one calm home.
            </p>
          </div>

          {/* High-intent CTA: Request access to UserHQ */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <Button
              size="lg"
              className="h-12 px-7 text-base font-semibold shadow-md shadow-[rgba(8,127,117,0.18)] hover:shadow-lg transition-all"
              asChild
            >
              <a href="mailto:hello@increasinglab.com?subject=UserHQ%20Access%20Request">
                Request access to UserHQ
                <ArrowRight className="size-4 ml-2" aria-hidden="true" />
              </a>
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Workspace creation is invite-only.</span>
              <span className="text-border" aria-hidden="true">·</span>
              <span>Already invited?</span>
              <Link
                href="/login"
                className="font-medium text-foreground underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>

        {/* INTERACTIVE PRODUCT SHOWCASE */}
        <section aria-label="Interactive Product Preview" className="flex flex-col gap-4">
          <ProductShowcase />
        </section>

        {/* STORY / THE FEEDBACK LOOP CLOSED */}
        <section aria-labelledby="story-heading" className="flex flex-col gap-10 sm:gap-14 pt-4">
          <div className="flex flex-col gap-3 max-w-2xl">
            <h2
              id="story-heading"
              className="text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-foreground"
            >
              The complete feedback loop, closed.
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              When teams collect ideas but never follow up, customers stop contributing.
              UserHQ connects every stage of product planning directly to public delivery.
            </p>
          </div>

          <div className="flex flex-col gap-6 sm:gap-8">
            {/* Step 1: Collect & Prioritize */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center rounded-2xl border border-border bg-card p-6 sm:p-8">
              <div className="md:col-span-6 flex flex-col gap-3">
                <h3 className="text-lg sm:text-xl font-semibold text-foreground">
                  Listen without the noise
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Scattered Slack messages, emails, and support tickets make customer demand impossible to quantify.
                  UserHQ unifies incoming requests into a single, clean community board where users upvote existing ideas instead of filing duplicates.
                </p>
                <div className="mt-1 flex flex-col gap-1.5 text-xs text-foreground font-medium">
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--primary)] shrink-0" aria-hidden="true" />
                    <span>Single sign-on via Google & GitHub for authentic user votes</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--primary)] shrink-0" aria-hidden="true" />
                    <span>Custom categories to segment requests by product area</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-6 rounded-xl border border-border bg-background p-4 sm:p-5 flex flex-col gap-3 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border">
                  <span>Customer request</span>
                  <span className="font-semibold text-[var(--primary-text)]">84 upvotes</span>
                </div>
                <div className="text-sm font-semibold text-foreground">
                  Webhook notifications for post status changes
                </div>
                <p className="text-xs text-muted-foreground">
                  Requested by 12 teams · Status updated to Planned
                </p>
                <div className="inline-flex items-center gap-2 rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground font-mono">
                  <span>POST /api/v1/portal/acme/posts/142/vote</span>
                </div>
              </div>
            </div>

            {/* Step 2: Prioritize & Plan */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center rounded-2xl border border-border bg-card p-6 sm:p-8">
              <div className="md:col-span-6 md:order-2 flex flex-col gap-3">
                <h3 className="text-lg sm:text-xl font-semibold text-foreground">
                  Plan with clarity on the roadmap
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Bridge user demand with engineering reality. Move top-voted ideas onto your Kanban roadmap so customers can follow progress without cluttering your private sprint boards.
                </p>
                <div className="mt-1 flex flex-col gap-1.5 text-xs text-foreground font-medium">
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--primary)] shrink-0" aria-hidden="true" />
                    <span>Kanban lanes configured to match your development cycle</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--primary)] shrink-0" aria-hidden="true" />
                    <span>Public roadmaps stay sanitized while internal discussions remain private</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-6 md:order-1 rounded-xl border border-border bg-background p-4 sm:p-5 flex flex-col gap-3 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border">
                  <span>Roadmap lane</span>
                  <span className="rounded-full bg-[var(--brand-selection)] px-2 py-0.5 text-xs font-semibold text-[var(--primary-text)]">
                    In Progress
                  </span>
                </div>
                <div className="text-sm font-semibold text-foreground">
                  Keyboard shortcuts for rapid backlog triage
                </div>
                <p className="text-xs text-muted-foreground">
                  Assigned for Q4 2026 delivery · Linked to 62 community voters
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="size-2 rounded-full bg-[var(--primary)]" />
                  <span className="text-xs font-medium text-foreground">Active milestone</span>
                </div>
              </div>
            </div>

            {/* Step 3: Ship & Close the Loop */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center rounded-2xl border border-border bg-card p-6 sm:p-8">
              <div className="md:col-span-6 flex flex-col gap-3">
                <h3 className="text-lg sm:text-xl font-semibold text-foreground">
                  Ship releases and celebrate publicly
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  When work is done, publish changelog notes with rich text and images. Every customer who voted for or commented on the feature is notified automatically, proving their voice matters.
                </p>
                <div className="mt-1 flex flex-col gap-1.5 text-xs text-foreground font-medium">
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--primary)] shrink-0" aria-hidden="true" />
                    <span>Rich-text release notes with image attachments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--primary)] shrink-0" aria-hidden="true" />
                    <span>Automated email notifications to release subscribers</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-6 rounded-xl border border-border bg-background p-4 sm:p-5 flex flex-col gap-3 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border">
                  <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-xs font-semibold text-white">
                    Shipped
                  </span>
                  <span>Release notification sent</span>
                </div>
                <div className="text-sm font-semibold text-foreground">
                  Changelog v2.4.0 published
                </div>
                <p className="text-xs text-muted-foreground">
                  All 84 voters notified: &quot;A feature you requested is now live!&quot;
                </p>
                <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--primary-text)]">
                  <span>Loop completed: Idea → Roadmap → Shipped</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CORE FOUNDATIONS */}
        <section aria-labelledby="foundations-heading" className="flex flex-col gap-6 pt-2">
          <div className="flex flex-col gap-2 max-w-2xl">
            <h2
              id="foundations-heading"
              className="text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-foreground"
            >
              Built for clarity, trusted by your customers.
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Designed with quiet restraint so your product and your customers remain the focus.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-7 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-[var(--primary)]">
                  <Palette className="size-4" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  Brand-first customer portals
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Custom brand logos, tailored accent colors, and unique workspace slugs make portals feel like native parts of your application.
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 sm:p-7 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-[var(--primary)]">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  Public transparency, private control
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Customers see clear, curated roadmaps and release updates while internal estimation, draft statuses, and member permissions stay safe in your team dashboard.
              </p>
            </div>
          </div>
        </section>

        {/* CLOSING CALL TO ACTION - QUIET & CALM */}
        <section
          aria-labelledby="cta-heading"
          className="rounded-2xl border border-border bg-card p-6 sm:p-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6"
        >
          <div className="flex flex-col gap-2 max-w-xl">
            <h2
              id="cta-heading"
              className="text-xl sm:text-2xl font-semibold tracking-[-0.025em] text-foreground"
            >
              Workspace creation is invite-only.
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Built with care by{" "}
              <a
                href="https://increasinglabs.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-foreground underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
              >
                Increasing Labs
              </a>
              . Have an invite link? Sign in to get started. Want access for your team? Contact{" "}
              <a
                href="mailto:hello@increasinglab.com?subject=UserHQ%20Access%20Request"
                className="font-medium text-foreground underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
              >
                hello@increasinglab.com
              </a>.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button size="lg" className="h-11 px-6 font-semibold" asChild>
              <a href="mailto:hello@increasinglab.com?subject=UserHQ%20Access%20Request">
                Request access to UserHQ
                <ArrowRight className="size-4 ml-1.5" aria-hidden="true" />
              </a>
            </Button>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-border pt-6 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <img
              src="/brand/userhq-mark.svg"
              alt=""
              width={18}
              height={18}
              className="size-4.5"
            />
            <span className="font-semibold text-foreground">UserHQ</span>
            <span>·</span>
            <span>
              by{" "}
              <a
                href="https://increasinglabs.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
              >
                Increasing Labs
              </a>
            </span>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="mailto:hello@increasinglab.com?subject=UserHQ%20Access%20Request"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              <Mail className="size-3 text-[var(--primary)]" aria-hidden="true" />
              hello@increasinglab.com
            </a>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/login" className="hover:text-foreground transition-colors">
              Sign in
            </Link>
            <span>© 2026 Increasing Labs</span>
          </div>
        </footer>
      </div>
    );
  }

  if (me.workspaces.length === 1) {
    redirect(`/dashboard/${me.workspaces[0].slug}`);
  }

  if (me.workspaces.length >= 2) {
    redirect("/dashboard");
  }

  // 0 workspaces:
  return (
    <div className="flex flex-col gap-6">
      {me.canCreateWorkspace ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold leading-tight">
              Set up your workspace
            </h1>
            <p className="text-base text-muted-foreground">
              A workspace holds your products, your team, and the portals your
              customers visit.
            </p>
          </div>
          <div>
            <Button variant="default" size="lg" asChild>
              <Link href="/dashboard/new">Create workspace</Link>
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold leading-tight">
              Workspace creation is invite-only
            </h1>
            <p className="text-base text-muted-foreground">
              UserHQ is invite-only for now. If someone gave you an invite link,
              open it while signed in with the email it was created for.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-foreground">Need an invite?</span>
              <span className="text-muted-foreground">
                Reach out to{" "}
                <a
                  href="https://increasinglabs.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-4 hover:text-[var(--primary)] transition-colors"
                >
                  Increasing Labs
                </a>{" "}
                to request early access for your team.
              </span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="mailto:hello@increasinglab.com?subject=UserHQ%20Access%20Request">
                <Mail className="size-3.5 mr-1.5 text-[var(--primary)]" aria-hidden="true" />
                hello@increasinglab.com
              </a>
            </Button>
          </div>
        </div>
      )}

      {isDevUploadEnabled() && (
        <div className="pt-4 border-t border-border">
          <Link
            href="/dev/upload"
            className="text-foreground underline text-sm"
          >
            Test image uploads →
          </Link>
        </div>
      )}
    </div>
  );
}
