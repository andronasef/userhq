import * as React from "react";
import type { PublicFaqCategory } from "@userhq/types";
import { Badge } from "../ui/badge";
import { FaqAccordionItem } from "./faq-accordion-item";

export interface FaqSectionProps {
  category: PublicFaqCategory;
  searchQuery: string;
  openQuestions: Set<string>;
  onToggleQuestion: (questionId: string) => void;
  activeHashId: string | null;
}

export function FaqSection({
  category,
  searchQuery,
  openQuestions,
  onToggleQuestion,
  activeHashId,
}: FaqSectionProps): React.JSX.Element {
  return (
    <section id={category.id} className="scroll-mt-24 space-y-3">
      <div className="pb-2 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          {category.name}
        </h2>
        <Badge variant="neutral" className="tabular-nums text-xs">
          {category.questions.length}{" "}
          {category.questions.length === 1 ? "question" : "questions"}
        </Badge>
      </div>

      <div className="divide-y divide-border border border-border rounded-lg overflow-hidden bg-background shadow-2xs">
        {category.questions.map((question) => (
          <FaqAccordionItem
            key={question.id}
            question={question}
            searchQuery={searchQuery}
            isOpen={openQuestions.has(question.id)}
            onToggle={() => onToggleQuestion(question.id)}
            isHighlighted={activeHashId === question.id}
          />
        ))}
      </div>
    </section>
  );
}
