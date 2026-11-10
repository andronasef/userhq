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
import { getDictionary } from "../../lib/i18n";
import { getRequestLocale } from "../../lib/i18n/server";

export default async function HomePage(): Promise<React.JSX.Element> {
  const [me, locale] = await Promise.all([getMe(), getRequestLocale()]);
  const dict = getDictionary(locale);

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
              {dict.landing.heroHeading}
            </h1>
            <p className="max-w-[56ch] text-base sm:text-xl leading-relaxed text-muted-foreground text-balance font-normal">
              {dict.landing.heroSubtitle}
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
                {dict.landing.requestAccess}
                <ArrowRight className="size-4 ml-2" aria-hidden="true" />
              </a>
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{dict.landing.inviteOnly}</span>
              <span className="text-border" aria-hidden="true">·</span>
              <span>{dict.landing.alreadyInvited}</span>
              <Link
                href="/login"
                className="font-medium text-foreground underline underline-offset-4 hover:text-[var(--primary-text)] transition-colors"
              >
                {dict.ui.signIn}
              </Link>
            </div>
          </div>
        </section>

        {/* INTERACTIVE PRODUCT SHOWCASE */}
        <section aria-label={dict.showcase.interactivePreview} className="flex flex-col gap-4">
          <ProductShowcase />
        </section>

        {/* STORY / THE FEEDBACK LOOP CLOSED */}
        <section aria-labelledby="story-heading" className="flex flex-col gap-10 sm:gap-14 pt-4">
          <div className="flex flex-col gap-3 max-w-2xl">
            <h2
              id="story-heading"
              className="text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-foreground"
            >
              {dict.landing.storyHeading}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {dict.landing.storyLead}
            </p>
          </div>

          <div className="flex flex-col gap-6 sm:gap-8">
            {/* Step 1: Collect & Prioritize */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center rounded-2xl border border-border bg-card p-6 sm:p-8">
              <div className="md:col-span-6 flex flex-col gap-3">
                <h3 className="text-lg sm:text-xl font-semibold text-foreground">
                  {dict.landing.step1Title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {dict.landing.step1Desc}
                </p>
                <div className="mt-1 flex flex-col gap-1.5 text-xs text-foreground font-medium">
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--primary-text)] shrink-0" aria-hidden="true" />
                    <span>{dict.landing.step1Feature1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--primary-text)] shrink-0" aria-hidden="true" />
                    <span>{dict.landing.step1Feature2}</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-6 rounded-xl border border-border bg-background p-4 sm:p-5 flex flex-col gap-3 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border">
                  <span>{dict.landing.step1CardLabel}</span>
                  <span className="font-semibold text-[var(--primary-text)]">{dict.landing.step1CardVotes}</span>
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {dict.landing.step1MockTitle}
                </div>
                <p className="text-xs text-muted-foreground">
                  {dict.landing.step1MockMeta}
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
                  {dict.landing.step2Title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {dict.landing.step2Desc}
                </p>
                <div className="mt-1 flex flex-col gap-1.5 text-xs text-foreground font-medium">
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--primary-text)] shrink-0" aria-hidden="true" />
                    <span>{dict.landing.step2Feature1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--primary-text)] shrink-0" aria-hidden="true" />
                    <span>{dict.landing.step2Feature2}</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-6 md:order-1 rounded-xl border border-border bg-background p-4 sm:p-5 flex flex-col gap-3 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border">
                  <span>{dict.landing.step2CardLabel}</span>
                  <span className="rounded-full bg-[var(--brand-selection)] px-2 py-0.5 text-xs font-semibold text-[var(--primary-text)]">
                    {dict.portal.inProgress}
                  </span>
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {dict.landing.step2MockTitle}
                </div>
                <p className="text-xs text-muted-foreground">
                  {dict.landing.step2MockMeta}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="size-2 rounded-full bg-[var(--primary)]" />
                  <span className="text-xs font-medium text-foreground">{dict.landing.step2Milestone}</span>
                </div>
              </div>
            </div>

            {/* Step 3: Ship & Close the Loop */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center rounded-2xl border border-border bg-card p-6 sm:p-8">
              <div className="md:col-span-6 flex flex-col gap-3">
                <h3 className="text-lg sm:text-xl font-semibold text-foreground">
                  {dict.landing.step3Title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {dict.landing.step3Desc}
                </p>
                <div className="mt-1 flex flex-col gap-1.5 text-xs text-foreground font-medium">
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--primary-text)] shrink-0" aria-hidden="true" />
                    <span>{dict.landing.step3Feature1}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="size-4 text-[var(--primary-text)] shrink-0" aria-hidden="true" />
                    <span>{dict.landing.step3Feature2}</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-6 rounded-xl border border-border bg-background p-4 sm:p-5 flex flex-col gap-3 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border">
                  <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-xs font-semibold text-white">
                    {dict.portal.completed}
                  </span>
                  <span>{dict.landing.step3ReleaseSent}</span>
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {dict.landing.step3MockTitle}
                </div>
                <p className="text-xs text-muted-foreground">
                  {dict.landing.step3MockMeta}
                </p>
                <div className="inline-flex items-center gap-2 text-xs font-medium text-[var(--primary-text)]">
                  <span>{dict.landing.step3LoopCompleted}</span>
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
              {dict.landing.foundationsHeading}
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {dict.landing.foundationsDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-7 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-[var(--primary-text)]">
                  <Palette className="size-4" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {dict.landing.brandFirstTitle}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {dict.landing.brandFirstDesc}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 sm:p-7 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-[var(--primary-text)]">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {dict.landing.publicTransparencyTitle}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {dict.landing.publicTransparencyDesc}
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
              {dict.landing.inviteOnly}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {dict.landing.ctaBody}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button size="lg" className="h-11 px-6 font-semibold" asChild>
              <a href="mailto:hello@increasinglab.com?subject=UserHQ%20Access%20Request">
                {dict.landing.requestAccess}
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
              {dict.common.byAuthor.split("{author}")[0]}
              <a
                href="https://increasinglabs.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline underline-offset-4 hover:text-[var(--primary-text)] transition-colors"
              >
                Increasing Labs
              </a>
              {dict.common.byAuthor.split("{author}")[1] ?? ""}
            </span>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="mailto:hello@increasinglab.com?subject=UserHQ%20Access%20Request"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              <Mail className="size-3 text-[var(--primary-text)]" aria-hidden="true" />
              hello@increasinglab.com
            </a>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              {dict.landing.privacy}
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              {dict.landing.terms}
            </Link>
            <Link href="/login" className="hover:text-foreground transition-colors">
              {dict.ui.signIn}
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
              {dict.landing.setupWorkspaceHeading}
            </h1>
            <p className="text-base text-muted-foreground">
              {dict.landing.setupWorkspaceDesc}
            </p>
          </div>
          <div>
            <Button variant="default" size="lg" asChild>
              <Link href="/dashboard/new">{dict.landing.createWorkspace}</Link>
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold leading-tight">
              {dict.landing.inviteOnly}
            </h1>
            <p className="text-base text-muted-foreground">
              {dict.landing.inviteOnlyDesc}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-semibold text-foreground">{dict.landing.needInvite}</span>
              <span className="text-muted-foreground">
                {dict.landing.reachOutTo}
              </span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href="mailto:hello@increasinglab.com?subject=UserHQ%20Access%20Request">
                <Mail className="size-3.5 mr-1.5 text-[var(--primary-text)]" aria-hidden="true" />
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
            {dict.landing.testImageUploads}
          </Link>
        </div>
      )}
    </div>
  );
}
