"use client";

import * as React from "react";
import {
  Layers,
  ShieldCheck,
  Inbox,
  MessageSquare,
  MapPin,
  Globe,
  Route,
  BookOpen,
  Palette,
  KeyRound,
  Code2,
  Webhook,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SwaggerExplorer } from "./swagger-explorer";

interface GuideMarkdownRendererProps {
  content: string;
  workspaces: Array<{ slug: string; name: string; role: string }>;
}

const SECTION_ICONS: Record<string, { icon: LucideIcon; color: string }> = {
  overview: { icon: Layers, color: "text-[var(--primary-text)]" },
  "roles-permissions": { icon: ShieldCheck, color: "text-emerald-500" },
  "requests-inbox": { icon: Inbox, color: "text-[var(--primary-text)]" },
  "comments-attention": { icon: MessageSquare, color: "text-emerald-500" },
  "author-location": { icon: MapPin, color: "text-rose-500" },
  "customer-portals": { icon: Globe, color: "text-blue-500" },
  "roadmap-changelog": { icon: Route, color: "text-[var(--primary-text)]" },
  "faq-system": { icon: BookOpen, color: "text-indigo-500" },
  "themes-push": { icon: Palette, color: "text-amber-500" },
  "api-overview": { icon: KeyRound, color: "text-blue-500" },
  "swagger-explorer": { icon: Code2, color: "text-emerald-500" },
  "webhooks-hmac": { icon: Webhook, color: "text-purple-500" },
};

function renderInlineMarkdown(text: string): React.ReactNode {
  // Parses inline `code` and **bold**
  const parts: React.ReactNode[] = [];
  // Regex to split on `code` or **bold**
  const regex = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-foreground"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

interface ParsedCard {
  title: string;
  description: string;
}

function parseCardItems(block: string): ParsedCard[] {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "));
  const cards: ParsedCard[] = [];

  for (const line of lines) {
    const raw = line.slice(2).trim(); // remove "- "
    const boldMatch = /^\*\*([^*]+)\*\*:\s*(.*)$/.exec(raw);
    if (boldMatch && boldMatch[1] && boldMatch[2]) {
      cards.push({
        title: boldMatch[1].trim(),
        description: boldMatch[2].trim(),
      });
    } else {
      cards.push({
        title: "",
        description: raw,
      });
    }
  }

  return cards;
}

export function GuideMarkdownRenderer({
  content,
  workspaces,
}: GuideMarkdownRendererProps): React.JSX.Element {
  // Split into sections using <!-- section: ID -->
  const sectionChunks = content.split(/<!--\s*section:\s*([\w-]+)\s*-->/g);

  // When split by capturing group, array is: [preface, id1, content1, id2, content2, ...]
  const sections: Array<{ id: string; body: string }> = [];
  for (let i = 1; i < sectionChunks.length; i += 2) {
    const id = sectionChunks[i];
    const body = sectionChunks[i + 1] || "";
    if (id) {
      sections.push({ id, body: body.trim() });
    }
  }

  return (
    <div className="space-y-12 min-w-0">
      {sections.map(({ id, body }) => {
        const iconConfig = SECTION_ICONS[id];
        const Icon = iconConfig?.icon;
        const iconColor = iconConfig?.color || "text-foreground";

        // Parse body elements: headings, code blocks, cards, stages, paragraphs, lists
        const elements: React.ReactNode[] = [];

        // Normalize newlines
        let rest = body;

        // Extract ## Section Heading
        const headingMatch = /^##\s+([^\n]+)/.exec(rest);
        let sectionTitle = "";
        if (headingMatch && headingMatch[1]) {
          sectionTitle = headingMatch[1].trim();
          rest = rest.slice(headingMatch[0].length).trim();
        }

        // Now process blocks in rest
        const blockTokens = rest.split(/(<cards>[\s\S]*?<\/cards>|<stages>[\s\S]*?<\/stages>|```[\s\S]*?```|\[component:[\w-]+\])/g);

        let elemKey = 0;
        for (const token of blockTokens) {
          const trimmed = token.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith("<cards>") && trimmed.endsWith("</cards>")) {
            const inner = trimmed.slice("<cards>".length, -("</cards>".length)).trim();
            const cards = parseCardItems(inner);
            const gridCols =
              cards.length === 2
                ? "grid-cols-1 md:grid-cols-2"
                : cards.length >= 3
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                : "grid-cols-1";

            elements.push(
              <div key={`cards-${elemKey++}`} className={cn("grid gap-3 text-xs", gridCols)}>
                {cards.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-border bg-card/60 space-y-2"
                  >
                    {c.title && (
                      <span className="font-bold text-foreground text-sm block">
                        {renderInlineMarkdown(c.title)}
                      </span>
                    )}
                    <p className="text-muted-foreground leading-relaxed">
                      {renderInlineMarkdown(c.description)}
                    </p>
                  </div>
                ))}
              </div>
            );
          } else if (trimmed.startsWith("<stages>") && trimmed.endsWith("</stages>")) {
            const inner = trimmed.slice("<stages>".length, -("</stages>".length)).trim();
            const stages = parseCardItems(inner);
            elements.push(
              <div
                key={`stages-${elemKey++}`}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"
              >
                {stages.map((stg, idx) => {
                  const isNeedsAttention = idx === 0;
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "p-4 rounded-xl border space-y-1.5",
                        isNeedsAttention
                          ? "border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/10"
                          : "border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/10"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            isNeedsAttention ? "bg-amber-500" : "bg-emerald-500"
                          )}
                        />
                        <span className="font-semibold text-foreground text-xs">
                          {renderInlineMarkdown(stg.title)}
                        </span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">
                        {renderInlineMarkdown(stg.description)}
                      </p>
                    </div>
                  );
                })}
              </div>
            );
          } else if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
            const codeLines = trimmed.slice(3, -3).trim().split("\n");
            // first line might be language
            const firstLine = codeLines[0] || "";
            const isLang = /^[a-zA-Z0-9_-]+$/.test(firstLine.trim());
            const code = isLang ? codeLines.slice(1).join("\n") : codeLines.join("\n");

            elements.push(
              <div key={`code-${elemKey++}`} className="space-y-2">
                <pre className="p-3.5 rounded-lg border border-border bg-muted/40 font-mono text-xs text-foreground overflow-x-auto">
                  <code>{code}</code>
                </pre>
              </div>
            );
          } else if (trimmed === "[component:swagger-explorer]") {
            elements.push(
              <div key={`comp-swagger-${elemKey++}`} className="pt-2">
                <SwaggerExplorer workspaces={workspaces} />
              </div>
            );
          } else {
            // General text blocks containing subheadings, lists, or paragraphs
            const subChunks = trimmed.split("\n\n");
            for (const chunk of subChunks) {
              const cTrimmed = chunk.trim();
              if (!cTrimmed) continue;

              if (cTrimmed.startsWith("### ")) {
                elements.push(
                  <h3
                    key={`h3-${elemKey++}`}
                    className="text-base font-semibold text-foreground pt-1"
                  >
                    {renderInlineMarkdown(cTrimmed.slice(4))}
                  </h3>
                );
              } else if (cTrimmed.startsWith("- ")) {
                const listItems = cTrimmed
                  .split("\n")
                  .map((l) => l.trim())
                  .filter((l) => l.startsWith("- "));

                elements.push(
                  <div
                    key={`list-${elemKey++}`}
                    className="p-4 rounded-xl border border-border bg-card/60 space-y-2 text-xs"
                  >
                    <ul className="list-disc pl-5 rtl:pr-5 rtl:pl-0 space-y-1.5 text-muted-foreground">
                      {listItems.map((li, liIdx) => (
                        <li key={liIdx}>{renderInlineMarkdown(li.slice(2).trim())}</li>
                      ))}
                    </ul>
                  </div>
                );
              } else {
                elements.push(
                  <p
                    key={`p-${elemKey++}`}
                    className="text-sm text-muted-foreground leading-relaxed"
                  >
                    {renderInlineMarkdown(cTrimmed)}
                  </p>
                );
              }
            }
          }
        }

        return (
          <section key={id} id={id} className="scroll-mt-20 space-y-4">
            {sectionTitle && (
              <div className="border-b border-border pb-2 flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  {Icon && <Icon className={cn("size-5", iconColor)} />}
                  <span>{sectionTitle}</span>
                </h2>
                {id === "swagger-explorer" && (
                  <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    OpenAPI 3.1
                  </span>
                )}
              </div>
            )}
            <div className="space-y-4">{elements}</div>
          </section>
        );
      })}
    </div>
  );
}
