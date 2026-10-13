import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FaqCategoryDialog } from "../components/faq/faq-category-dialog";
import { FaqQuestionDialog } from "../components/faq/faq-question-dialog";
import { FaqQuestionItem } from "../components/faq/faq-question-item";
import { FaqCategoryItem } from "../components/faq/faq-category-item";
import { FaqManager } from "../components/faq/faq-manager";
import type { AdminFaqCategory, AdminFaqQuestion } from "@userhq/types";

// Mock @radix-ui/react-dialog so portal renders in static SSR environment
vi.mock("@radix-ui/react-dialog", () => ({
  Root: ({ children, open }: any) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  Trigger: ({ children }: any) => <div data-testid="dialog-trigger">{children}</div>,
  Portal: ({ children }: any) => <div data-testid="dialog-portal">{children}</div>,
  Overlay: ({ children }: any) => <div data-testid="dialog-overlay">{children}</div>,
  Content: ({ children, className }: any) => <div data-testid="dialog-content" className={className}>{children}</div>,
  Title: ({ children, className }: any) => <div data-testid="dialog-title" className={className}>{children}</div>,
  Description: ({ children, className }: any) => <div data-testid="dialog-desc" className={className}>{children}</div>,
  Close: ({ children }: any) => <div data-testid="dialog-close">{children}</div>,
}));

// Mock @radix-ui/react-dropdown-menu
vi.mock("@radix-ui/react-dropdown-menu", () => ({
  Root: ({ children }: any) => <div>{children}</div>,
  Trigger: ({ children }: any) => <div>{children}</div>,
  Content: ({ children }: any) => <div>{children}</div>,
  Item: ({ children, onClick }: any) => <button type="button" onClick={onClick}>{children}</button>,
  Separator: () => <hr />,
  Group: ({ children }: any) => <div>{children}</div>,
  Sub: ({ children }: any) => <div>{children}</div>,
  RadioGroup: ({ children }: any) => <div>{children}</div>,
  Label: ({ children }: any) => <div>{children}</div>,
  Portal: ({ children }: any) => <div>{children}</div>,
}));

// Mock @dnd-kit/react
vi.mock("@dnd-kit/react", () => ({
  DragDropProvider: ({ children }: any) => <div data-testid="drag-drop-provider">{children}</div>,
  useDroppable: () => ({ ref: () => {}, isDropTarget: false }),
}));

vi.mock("@dnd-kit/react/sortable", () => ({
  useSortable: () => ({
    ref: () => {},
    handleRef: () => {},
    isDragging: false,
  }),
}));

describe("FAQ Admin Studio & Management Components", () => {
  const sampleQuestion: AdminFaqQuestion = {
    id: "11111111-1111-4111-8111-111111111111",
    categoryId: "22222222-2222-4222-8222-222222222222",
    question: "How do I upgrade my subscription plan?",
    answer: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Navigate to your workspace billing settings and choose a tier.",
            },
          ],
        },
      ],
    },
    rank: "0|hzzzzz:",
    createdAt: "2026-10-15T10:00:00.000Z",
    updatedAt: "2026-10-15T10:00:00.000Z",
  };

  const sampleCategory: AdminFaqCategory = {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Billing & Plans",
    rank: "0|hzzzzz:",
    questions: [sampleQuestion],
    createdAt: "2026-10-15T09:00:00.000Z",
    updatedAt: "2026-10-15T09:00:00.000Z",
  };

  it("renders EmptyState in FaqManager when no categories exist", () => {
    const html = renderToStaticMarkup(
      <FaqManager
        ws="acme-ws"
        product="core-prod"
        initialCategories={[]}
      />
    );

    expect(html).toContain("No FAQ categories yet");
    expect(html).toContain(
      "Organize self-serve help articles and common questions for your customers."
    );
    expect(html).toContain("New category");
  });

  it("renders FaqManager with categories, questions, and action buttons", () => {
    const html = renderToStaticMarkup(
      <FaqManager
        ws="acme-ws"
        product="core-prod"
        initialCategories={[sampleCategory]}
      />
    );

    expect(html).toContain("Billing &amp; Plans");
    expect(html).toContain("How do I upgrade my subscription plan?");
    expect(html).toContain("Navigate to your workspace billing settings");
    expect(html).toContain("New category");
    expect(html).toContain("New question");
    expect(html).toContain("Drag categories or questions to reorder them");
  });

  it("renders FaqCategoryItem with question count badge and action buttons", () => {
    const html = renderToStaticMarkup(
      <FaqCategoryItem
        category={sampleCategory}
        index={0}
        ws="acme-ws"
        product="core-prod"
        onRename={() => {}}
        onDeleteCategory={() => {}}
        onAddQuestion={() => {}}
        onEditQuestion={() => {}}
        onDeleteQuestion={() => {}}
      />
    );

    expect(html).toContain("Billing &amp; Plans");
    expect(html).toContain("Add question");
    expect(html).toContain("Rename");
    expect(html).toContain("Delete");
    expect(html).toContain("How do I upgrade my subscription plan?");
  });

  it("renders FaqQuestionItem with drag handle, title, and preview", () => {
    const html = renderToStaticMarkup(
      <FaqQuestionItem
        question={sampleQuestion}
        index={0}
        ws="acme-ws"
        product="core-prod"
        onEdit={() => {}}
        onDelete={() => {}}
      />
    );

    expect(html).toContain("How do I upgrade my subscription plan?");
    expect(html).toContain(
      "Navigate to your workspace billing settings and choose a tier."
    );
    expect(html).toContain("aria-label=\"Drag to reorder question\"");
  });

  it("renders FaqCategoryDialog in create mode with empty fields", () => {
    const html = renderToStaticMarkup(
      <FaqCategoryDialog
        open={true}
        onOpenChange={() => {}}
        ws="acme-ws"
        product="core-prod"
        onSuccess={() => {}}
      />
    );

    expect(html).toContain("New category");
    expect(html).toContain(
      "Add an FAQ category to organize self-serve help articles."
    );
    expect(html).toContain("Category name");
  });

  it("renders FaqCategoryDialog in rename mode with prefilled name", () => {
    const html = renderToStaticMarkup(
      <FaqCategoryDialog
        open={true}
        onOpenChange={() => {}}
        category={sampleCategory}
        ws="acme-ws"
        product="core-prod"
        onSuccess={() => {}}
      />
    );

    expect(html).toContain("Rename category");
    expect(html).toContain("value=\"Billing &amp; Plans\"");
    expect(html).toContain("Save category");
  });

  it("renders FaqQuestionDialog in create mode with category select", () => {
    const html = renderToStaticMarkup(
      <FaqQuestionDialog
        open={true}
        onOpenChange={() => {}}
        categories={[sampleCategory]}
        ws="acme-ws"
        product="core-prod"
        onSuccess={() => {}}
      />
    );

    expect(html).toContain("New question");
    expect(html).toContain("Billing &amp; Plans");
    expect(html).toContain("Create question");
  });

  it("renders FaqQuestionDialog in edit mode with prefilled title", () => {
    const html = renderToStaticMarkup(
      <FaqQuestionDialog
        open={true}
        onOpenChange={() => {}}
        question={sampleQuestion}
        categories={[sampleCategory]}
        ws="acme-ws"
        product="core-prod"
        onSuccess={() => {}}
      />
    );

    expect(html).toContain("Edit question");
    expect(html).toContain(
      "value=\"How do I upgrade my subscription plan?\""
    );
    expect(html).toContain("Save question");
  });
});
