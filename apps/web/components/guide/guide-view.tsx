"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/context";
import {
  getGuideMarkdown,
  getGuideNavSections,
  getGuideHeader,
  getGuideQuickLinks,
} from "@/content/guide";
import { GuideMarkdownRenderer } from "./guide-markdown-renderer";

interface GuideViewProps {
  workspaces: Array<{ slug: string; name: string; role: string }>;
  isPlatformOwner?: boolean;
}

export function GuideView({ workspaces }: GuideViewProps) {
  const { locale, dir } = useI18n();
  const [activeSection, setActiveSection] = React.useState("overview");
  const [navSearch, setNavSearch] = React.useState("");

  const navSections = React.useMemo(() => getGuideNavSections(locale), [locale]);
  const headerInfo = React.useMemo(() => getGuideHeader(locale), [locale]);
  const quickLinks = React.useMemo(() => getGuideQuickLinks(locale), [locale]);
  const markdownContent = React.useMemo(() => getGuideMarkdown(locale), [locale]);

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
  }, [markdownContent]);

  const filteredSections = React.useMemo(() => {
    if (!navSearch.trim()) return navSections;
    const q = navSearch.toLowerCase();
    return navSections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
        ),
      }))
      .filter((sec) => sec.items.length > 0);
  }, [navSections, navSearch]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div
      dir={dir}
      className="min-h-screen bg-background text-foreground flex flex-col"
    >
      {/* Top Breadcrumb Header */}
      <div className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <nav className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link
              href="/"
              className="hover:text-foreground transition-colors font-medium"
            >
              {headerInfo.breadcrumbHome}
            </Link>
            <ChevronRight className="size-3.5 rtl:rotate-180" />
            <span className="text-foreground font-semibold">
              {headerInfo.breadcrumbCurrent}
            </span>
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Navigation Sidebar */}
          <aside className="lg:col-span-3 sticky top-16 hidden lg:flex lg:flex-col max-h-[calc(100vh-5rem)] space-y-3">
            <div className="relative shrink-0 pr-1 rtl:pr-0 rtl:pl-1">
              <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder={headerInfo.searchPlaceholder}
                value={navSearch}
                onChange={(e) => setNavSearch(e.target.value)}
                className="w-full pl-8 pr-3 rtl:pr-8 rtl:pl-3 py-1.5 text-xs bg-muted/40 border border-border rounded-lg placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <nav className="space-y-5 text-xs overflow-y-auto pr-2 rtl:pr-0 rtl:pl-2 pb-6 flex-1">
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
                            "w-full text-left rtl:text-right px-2.5 py-1.5 rounded-lg flex items-center gap-2 transition-all font-medium",
                            isActive
                              ? "bg-[var(--primary)]/10 text-[var(--primary-text)] font-semibold shadow-xs"
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-3.5 shrink-0",
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
                  {headerInfo.title}
                </h1>
                <p className="text-base text-muted-foreground max-w-3xl leading-relaxed">
                  {headerInfo.subtitle}
                </p>
              </div>

              {/* Quick Navigation Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                {quickLinks.map((ql) => {
                  const Icon = ql.icon;
                  return (
                    <button
                      key={ql.id}
                      type="button"
                      onClick={() => scrollTo(ql.id)}
                      className="p-4 rounded-xl border border-border bg-card hover:border-[var(--primary)]/40 hover:bg-card/80 transition-all text-left rtl:text-right space-y-1.5 group shadow-xs"
                    >
                      <Icon
                        className={cn(
                          "size-4 group-hover:scale-110 transition-transform",
                          ql.iconColor
                        )}
                      />
                      <div className="font-semibold text-xs text-foreground">
                        {ql.title}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-snug">
                        {ql.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Markdown rendered sections */}
            <GuideMarkdownRenderer
              content={markdownContent}
              workspaces={workspaces}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
