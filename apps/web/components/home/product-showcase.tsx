"use client";

import * as React from "react";
import {
  MessagesSquare,
  Kanban,
  Megaphone,
  HelpCircle,
  ChevronUp,
  ChevronDown,
  Search,
  Check,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";

type ShowcaseTab = "feedback" | "roadmap" | "changelog" | "faq";

interface MockPost {
  id: string;
  number: number;
  title: string;
  description: string;
  category: string;
  status: { name: string; color: string };
  votes: number;
  comments: number;
}

const INITIAL_POSTS: MockPost[] = [
  {
    id: "post-1",
    number: 142,
    title: "Slack & Discord notifications for critical team alerts",
    description:
      "Send immediate webhook notifications to team channels whenever high-priority feedback is submitted or changes status.",
    category: "Integrations",
    status: { name: "Planned", color: "#087F75" },
    votes: 84,
    comments: 12,
  },
  {
    id: "post-2",
    number: 139,
    title: "Keyboard shortcuts for rapid backlog triage & status updates",
    description:
      "Navigate feedback lists with J/K, assign statuses with number keys, and toggle internal notes without touching the mouse.",
    category: "Usability",
    status: { name: "In Progress", color: "#066A62" },
    votes: 62,
    comments: 7,
  },
  {
    id: "post-3",
    number: 128,
    title: "Export customer feedback to CSV & JSON for custom analysis",
    description:
      "Allow workspace owners to download complete datasets including vote counts, timestamps, categories, and author details.",
    category: "Data",
    status: { name: "Under Review", color: "#53645F" },
    votes: 41,
    comments: 5,
  },
];

const ROADMAP_COLUMNS = [
  {
    title: "Under Consideration",
    color: "#53645F",
    items: [
      {
        title: "Custom domain mapping (feedback.yourcompany.com)",
        category: "Branding",
        votes: 119,
        quarter: "Evaluating",
      },
      {
        title: "Multi-language FAQ localization",
        category: "Content",
        votes: 38,
        quarter: "Evaluating",
      },
    ],
  },
  {
    title: "In Progress",
    color: "#066A62",
    items: [
      {
        title: "Keyboard shortcuts for rapid backlog triage",
        category: "Usability",
        votes: 62,
        quarter: "Q4 2026",
      },
      {
        title: "Automated email digest for subscribed voters",
        category: "Engagement",
        votes: 94,
        quarter: "Q4 2026",
      },
    ],
  },
  {
    title: "Shipped",
    color: "#087F75",
    items: [
      {
        title: "OAuth authentication via Google & GitHub",
        category: "Security",
        votes: 215,
        quarter: "Shipped",
      },
      {
        title: "Rich-text release notes editor with image attachments",
        category: "Changelog",
        votes: 148,
        quarter: "Shipped",
      },
    ],
  },
];

const FAQ_ITEMS: { question: string; answer: React.ReactNode }[] = [
  {
    question: "How can our team get an invitation to UserHQ?",
    answer: (
      <span>
        Workspace creation is currently invite-only during our preview period. If your team is interested in launching a portal, contact{" "}
        <a
          href="https://increasinglabs.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline underline-offset-2 hover:text-[var(--primary)] transition-colors"
        >
          Increasing Labs
        </a>{" "}
        at hello@increasinglab.com to request early access.
      </span>
    ),
  },
  {
    question: "How does voting work on public customer portals?",
    answer:
      "Customers sign in with their Google or GitHub account to cast one vote per post. They can withdraw their vote anytime, and they receive automated status updates as the post progresses through the roadmap.",
  },
  {
    question: "Can we keep internal team roadmap items private?",
    answer:
      "Yes. UserHQ gives your team private backlog boards and draft statuses. You choose exactly which items and statuses are published to the public portal and which remain internal.",
  },
  {
    question: "How are subscribers notified when a changelog entry is published?",
    answer:
      "When you publish a changelog entry, UserHQ sends email updates to subscribed customers and everyone who voted for linked roadmap items, closing the feedback loop automatically.",
  },
];

export function ProductShowcase(): React.JSX.Element {
  const [activeTab, setActiveTab] = React.useState<ShowcaseTab>("feedback");
  const [posts, setPosts] = React.useState<MockPost[]>(INITIAL_POSTS);
  const [votedPosts, setVotedPosts] = React.useState<Record<string, boolean>>({
    "post-1": false,
    "post-2": true,
    "post-3": false,
  });
  const [selectedCategory, setSelectedCategory] = React.useState<string>("All");
  const [subscribed, setSubscribed] = React.useState<boolean>(false);
  const [openFaqIndex, setOpenFaqIndex] = React.useState<number | null>(0);

  const toggleVote = (id: string) => {
    const isVoted = !!votedPosts[id];
    setVotedPosts((prev) => ({ ...prev, [id]: !isVoted }));
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, votes: isVoted ? p.votes - 1 : p.votes + 1 } : p,
      ),
    );
  };

  const filteredPosts =
    selectedCategory === "All"
      ? posts
      : posts.filter((p) => p.category === selectedCategory);

  return (
    <div className="relative w-full rounded-2xl border border-border/80 bg-card overflow-hidden shadow-2xl shadow-[rgba(8,127,117,0.08)] ring-1 ring-border/50">
      {/* Top highlight hairline */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent"
        aria-hidden="true"
      />

      {/* Top Application Browser Frame */}
      <div className="border-b border-border bg-muted/40 px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-3 rounded-full bg-border" />
            <span className="inline-flex size-3 rounded-full bg-border" />
            <span className="inline-flex size-3 rounded-full bg-border" />
            <div className="ml-3 inline-flex items-center gap-2 rounded-md border border-border/80 bg-background px-2.5 py-1 text-xs font-medium text-foreground">
              <span className="size-2 rounded-full bg-[var(--primary)]" />
              <span>{"/company-name"}</span>
            </div>
          </div>

          {/* Interactive Navigation Switcher */}
          <div
            role="tablist"
            aria-label="Product Showcase Views"
            className="flex items-center gap-1 rounded-lg border border-border bg-background p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "feedback"}
              onClick={() => setActiveTab("feedback")}
              className={cn(
                "motion-press inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeTab === "feedback"
                  ? "bg-[var(--brand-selection)] text-[var(--primary-text)] font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MessagesSquare className="size-3.5" aria-hidden="true" />
              <span>Feedback</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "roadmap"}
              onClick={() => setActiveTab("roadmap")}
              className={cn(
                "motion-press inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeTab === "roadmap"
                  ? "bg-[var(--brand-selection)] text-[var(--primary-text)] font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Kanban className="size-3.5" aria-hidden="true" />
              <span>Roadmap</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "changelog"}
              onClick={() => setActiveTab("changelog")}
              className={cn(
                "motion-press inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeTab === "changelog"
                  ? "bg-[var(--brand-selection)] text-[var(--primary-text)] font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Megaphone className="size-3.5" aria-hidden="true" />
              <span>Changelog</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "faq"}
              onClick={() => setActiveTab("faq")}
              className={cn(
                "motion-press inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                activeTab === "faq"
                  ? "bg-[var(--brand-selection)] text-[var(--primary-text)] font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <HelpCircle className="size-3.5" aria-hidden="true" />
              <span>Help Center</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Panels */}
      <div className="p-4 sm:p-6 min-h-[380px] bg-background">
        {/* VIEW 1: FEEDBACK BOARD */}
        {activeTab === "feedback" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div className="flex items-center gap-1.5">
                {["All", "Integrations", "Usability", "Data"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "motion-press rounded-full px-2.5 py-1 text-xs font-medium border transition-colors",
                      selectedCategory === cat
                        ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
                <Search className="size-3.5" aria-hidden="true" />
                <span>Search feedback...</span>
              </div>
            </div>

            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card overflow-hidden">
              {filteredPosts.map((post) => {
                const isVoted = !!votedPosts[post.id];
                return (
                  <li
                    key={post.id}
                    className="flex items-start gap-3 sm:gap-4 p-3.5 sm:p-4 hover:bg-muted/20 transition-colors"
                  >
                    {/* Interactive Upvote Button */}
                    <button
                      type="button"
                      onClick={() => toggleVote(post.id)}
                      aria-pressed={isVoted}
                      aria-label={`Upvote ${post.title}. Current count: ${post.votes}`}
                      className={cn(
                        "motion-press size-12 sm:w-12 sm:h-14 rounded-md border flex flex-col items-center justify-center gap-0.5 shrink-0 select-none transition-colors",
                        isVoted
                          ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                          : "border-border bg-background text-[var(--primary-text)] hover:bg-muted",
                      )}
                    >
                      <ChevronUp className="size-4 shrink-0" aria-hidden="true" />
                      <span className="text-xs sm:text-sm font-semibold tabular-nums leading-none">
                        {post.votes}
                      </span>
                    </button>

                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <h4 className="text-sm sm:text-base font-semibold text-foreground line-clamp-1">
                          {post.title}
                        </h4>
                        <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                          #{post.number}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                        {post.description}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusBadge
                          name={post.status.name}
                          color={post.status.color}
                        />
                        <Badge variant="neutral">{post.category}</Badge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {post.comments} comments
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
              <span>Click the arrow buttons to test community voting.</span>
              <span className="font-medium text-[var(--primary-text)]">
                Try filtering categories above
              </span>
            </div>
          </div>
        )}

        {/* VIEW 2: ROADMAP KANBAN */}
        {activeTab === "roadmap" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="text-xs text-muted-foreground">
                Public progress mapped directly to product development phases.
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-[#087F75]" />
                <span>Live board</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {ROADMAP_COLUMNS.map((col) => (
                <div
                  key={col.title}
                  className="flex flex-col rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: col.color }}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-semibold text-foreground">
                        {col.title}
                      </span>
                    </div>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                      {col.items.length}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-col gap-2.5">
                    {col.items.map((item) => (
                      <div
                        key={item.title}
                        className="rounded-md border border-border bg-background p-2.5 shadow-2xs hover:border-[var(--primary)] transition-colors"
                      >
                        <p className="text-xs font-medium text-foreground leading-snug line-clamp-2">
                          {item.title}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-muted-foreground font-mono">
                            {item.category}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary-text)]">
                            <ChevronUp className="size-3" aria-hidden="true" />
                            {item.votes}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground text-center pt-1">
              Teams control status definitions, column visibility, and whether items appear publicly.
            </p>
          </div>
        )}

        {/* VIEW 3: CHANGELOG TIMELINE */}
        {activeTab === "changelog" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-xs font-semibold text-white">
                  v2.4.0
                </span>
                <span className="text-xs text-muted-foreground">
                  Published October 2026
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSubscribed(!subscribed)}
                className={cn(
                  "motion-press inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors border",
                  subscribed
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                {subscribed ? (
                  <>
                    <Check className="size-3.5" aria-hidden="true" />
                    <span>Subscribed</span>
                  </>
                ) : (
                  <>
                    <Bell className="size-3.5" aria-hidden="true" />
                    <span>Subscribe to releases</span>
                  </>
                )}
              </button>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 sm:p-5 flex flex-col gap-3">
              <h4 className="text-base font-semibold text-foreground">
                Automated notification digests & rich changelog notes
              </h4>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                When you ship features requested by your community, UserHQ now automatically notifies every customer who upvoted or commented on the linked post.
              </p>

              <div className="rounded-md border border-border/70 bg-background p-3 flex flex-col gap-1.5 text-xs text-foreground">
                <div className="flex items-center gap-2 font-medium">
                  <span className="size-1.5 rounded-full bg-[var(--primary)]" />
                  <span>Subscribers receive a curated summary of completed improvements</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <span className="size-1.5 rounded-full bg-[var(--primary)]" />
                  <span>Inline image and video previews in release notes</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <span className="size-1.5 rounded-full bg-[var(--primary)]" />
                  <span>Roadmap cards automatically reflect &quot;Shipped&quot; status</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Close the loop: your customers know their voice directly shaped the product.
            </p>
          </div>
        )}

        {/* VIEW 4: FAQ / HELP CENTER */}
        {activeTab === "faq" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="text-xs text-muted-foreground">
                Integrated knowledge base prevents duplicate tickets before they start.
              </div>
              <span className="text-xs font-medium text-[var(--primary-text)]">
                Self-service FAQ
              </span>
            </div>

            <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card overflow-hidden">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div key={item.question} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                      className="flex items-center justify-between p-3.5 sm:p-4 text-left font-medium text-xs sm:text-sm text-foreground hover:bg-muted/20 transition-colors"
                    >
                      <span>{item.question}</span>
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                          isOpen && "rotate-180 text-[var(--primary)]",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    {isOpen && (
                      <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/50 bg-background/50">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Categorized, searchable, and manageable right from your admin dashboard.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
