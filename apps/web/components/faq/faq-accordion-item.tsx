"use client";

import * as React from "react";
import { Link2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { PublicFaqQuestion } from "@userhq/types";
import { HighlightText } from "./faq-highlight";
import { RichTextViewer } from "../rich-text/rich-text-viewer";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

export interface FaqAccordionItemProps {
  question: PublicFaqQuestion;
  searchQuery: string;
  isOpen: boolean;
  onToggle: () => void;
  isHighlighted?: boolean;
}

export function FaqAccordionItem({
  question,
  searchQuery,
  isOpen,
  onToggle,
  isHighlighted = false,
}: FaqAccordionItemProps): React.JSX.Element {
  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${window.location.pathname}#q-${question.id}`
        : `#q-${question.id}`;

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
    }
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `#q-${question.id}`);
    }
    toast.success("Question link copied");
  };

  return (
    <div
      id={`q-${question.id}`}
      className={cn(
        "scroll-mt-24 transition-colors duration-300",
        isHighlighted && "ring-2 ring-primary/40 bg-primary/5",
      )}
    >
      <div className="relative">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={`faq-answer-${question.id}`}
          className="w-full flex items-center justify-between gap-3 p-4 text-left font-semibold text-sm sm:text-base text-foreground hover:bg-muted/30 transition-colors"
        >
          <span className="min-w-0 flex-1 pr-8">
            <HighlightText text={question.question} query={searchQuery} />
          </span>
          <ChevronDown
            className={cn(
              "motion-faq-chevron size-4 shrink-0 text-muted-foreground",
              isOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleCopyLink}
          className="absolute right-10 top-1/2 -translate-y-1/2 size-7 text-muted-foreground hover:text-foreground"
          aria-label="Copy link to question"
          title="Copy question link"
        >
          <Link2 className="size-3.5" aria-hidden="true" />
        </Button>
      </div>

      <div
        id={`faq-answer-${question.id}`}
        data-state={isOpen ? "open" : "closed"}
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={cn(
          "motion-faq-body grid",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="p-4 pt-1 text-sm sm:text-base text-muted-foreground leading-relaxed bg-background/50 border-t border-border/50 overflow-x-auto">
            <RichTextViewer content={question.answer} />
          </div>
        </div>
      </div>
    </div>
  );
}
