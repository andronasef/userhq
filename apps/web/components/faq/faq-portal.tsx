"use client";

import * as React from "react";
import Link from "next/link";
import { HelpCircle } from "lucide-react";
import type { PublicFaqCategory, RichTextDoc } from "@userhq/types";
import { EmptyState } from "../empty-state";
import { Button } from "../ui/button";
import { FaqSearchBar } from "./faq-search-bar";
import { FaqSidebarNav } from "./faq-sidebar-nav";
import { FaqSection } from "./faq-section";
import { FaqNotFoundPrompt } from "./faq-not-found-prompt";

export interface FaqPortalProps {
  ws: string;
  product: string;
  categories: PublicFaqCategory[];
}

export function extractTextFromRichText(doc: RichTextDoc | null | undefined): string {
  if (!doc) return "";
  let text = "";
  const traverse = (node: any) => {
    if (typeof node?.text === "string") {
      text += node.text + " ";
    }
    if (Array.isArray(node?.content)) {
      for (const child of node.content) {
        traverse(child);
      }
    }
  };
  traverse(doc);
  return text.trim();
}

export function FaqPortal({
  ws,
  product,
  categories,
}: FaqPortalProps): React.JSX.Element {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [openQuestions, setOpenQuestions] = React.useState<Set<string>>(new Set());
  const [closedInSearch, setClosedInSearch] = React.useState<Set<string>>(new Set());
  const [activeHashId, setActiveHashId] = React.useState<string | null>(null);
  const [activeCategoryId, setActiveCategoryId] = React.useState<string | null>(
    categories[0]?.id ?? null
  );

  // Deep-link hash detection (#q-[id])
  React.useEffect(() => {
    const handleHash = () => {
      if (typeof window === "undefined") return;
      const hash = window.location.hash;
      const match = hash.match(/^#q-([a-zA-Z0-9_-]+)$/);
      if (match) {
        const questionId = match[1];
        setOpenQuestions((prev) => new Set([...prev, questionId]));
        setActiveHashId(questionId);

        setTimeout(() => {
          const el = document.getElementById(`q-${questionId}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth" });
          }
        }, 50);

        const timer = setTimeout(() => {
          setActiveHashId(null);
        }, 1500);
        return () => clearTimeout(timer);
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const totalQuestionsCount = React.useMemo(() => {
    return categories.reduce((sum, cat) => sum + cat.questions.length, 0);
  }, [categories]);

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;

  // Filter categories and questions
  const filteredCategories = React.useMemo(() => {
    if (!isSearching) {
      return categories;
    }

    return categories
      .map((cat) => {
        const matchingQuestions = cat.questions.filter((q) => {
          const inQuestion = q.question.toLowerCase().includes(trimmedQuery);
          const inAnswer = extractTextFromRichText(q.answer)
            .toLowerCase()
            .includes(trimmedQuery);
          return inQuestion || inAnswer;
        });

        return {
          ...cat,
          questions: matchingQuestions,
        };
      })
      .filter((cat) => cat.questions.length > 0);
  }, [categories, isSearching, trimmedQuery]);

  const matchCount = React.useMemo(() => {
    return filteredCategories.reduce((sum, cat) => sum + cat.questions.length, 0);
  }, [filteredCategories]);

  // When query changes, reset closed-in-search set
  const handleQueryChange = (val: string) => {
    setSearchQuery(val);
    setClosedInSearch(new Set());
  };

  const handleToggleQuestion = (questionId: string) => {
    if (isSearching) {
      setClosedInSearch((prev) => {
        const next = new Set(prev);
        if (next.has(questionId)) {
          next.delete(questionId);
        } else {
          next.add(questionId);
        }
        return next;
      });
    } else {
      setOpenQuestions((prev) => {
        const next = new Set(prev);
        if (next.has(questionId)) {
          next.delete(questionId);
        } else {
          next.add(questionId);
        }
        return next;
      });
    }
  };

  // Determine currently open questions set
  const effectiveOpenQuestions = React.useMemo(() => {
    if (isSearching) {
      const openSet = new Set<string>();
      for (const cat of filteredCategories) {
        for (const q of cat.questions) {
          if (!closedInSearch.has(q.id)) {
            openSet.add(q.id);
          }
        }
      }
      return openSet;
    }
    return openQuestions;
  }, [isSearching, filteredCategories, closedInSearch, openQuestions]);

  // Empty Portal State
  if (totalQuestionsCount === 0 || categories.length === 0) {
    return (
      <EmptyState
        icon={<HelpCircle className="size-6 text-muted-foreground" aria-hidden="true" />}
        title="No frequently asked questions yet"
        body="Self-serve help articles and common questions will appear here soon."
        action={
          <Button asChild variant="default">
            <Link href={`/${ws}/${product}`}>Explore feedback</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <FaqSearchBar
        value={searchQuery}
        onChange={handleQueryChange}
        matchCount={matchCount}
      />

      {isSearching && matchCount === 0 ? (
        <FaqNotFoundPrompt ws={ws} product={product} query={searchQuery} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <FaqSidebarNav
            categories={filteredCategories}
            activeCategoryId={activeCategoryId}
            onSelectCategory={setActiveCategoryId}
          />

          <div className="lg:col-span-8 space-y-10">
            {filteredCategories.map((category) => (
              <FaqSection
                key={category.id}
                category={category}
                searchQuery={searchQuery}
                openQuestions={effectiveOpenQuestions}
                onToggleQuestion={handleToggleQuestion}
                activeHashId={activeHashId}
              />
            ))}

            <FaqNotFoundPrompt
              ws={ws}
              product={product}
              query={searchQuery}
              className="mt-12"
            />
          </div>
        </div>
      )}
    </div>
  );
}
